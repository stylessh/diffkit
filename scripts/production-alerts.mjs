import { writeFileSync } from "node:fs";

const env = requireEnv([
  "HEALTH_URL",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "D1_DATABASE_ID",
  "WORKER_NAME",
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
]);

const ALERT_LABEL = "production-alert";
const D1_SIZE_ALERT_BYTES = 8 * 1000 * 1000 * 1000;
const D1_LIMIT_BYTES = 10 * 1000 * 1000 * 1000;
const ERROR_RATE_WINDOW_MS = 15 * 60 * 1000;
// Workers analytics lag a few minutes behind; a window ending now undercounts.
const ERROR_RATE_LAG_MS = 5 * 60 * 1000;
const ERROR_RATE_MIN_REQUESTS = 50;
const ERROR_RATE_THRESHOLD = 0.05;
const HEALTH_ATTEMPTS = 3;
const HEALTH_RETRY_MS = 20_000;

const runbook = (name) =>
  `https://github.com/${env.GITHUB_REPOSITORY}/blob/main/docs/runbooks/${name}`;

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Missing environment: ${missing.join(", ")}`);
    process.exit(1);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

async function guarded(title, evaluate) {
  try {
    return await evaluate(title);
  } catch (error) {
    return unknown(title, messageOf(error));
  }
}

function firing(title, body) {
  return { state: "firing", title, body };
}

function clear(title, detail) {
  return { state: "clear", title, detail };
}

function unknown(title, reason) {
  return { state: "unknown", title, reason };
}

function formatGB(bytes) {
  return `${(bytes / 1e9).toFixed(2)} GB`;
}

async function fetchHealth() {
  let last = { state: "unreachable", reason: "not attempted" };
  for (let attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, HEALTH_RETRY_MS));
    try {
      const response = await fetch(env.HEALTH_URL, { signal: AbortSignal.timeout(10_000) });
      const text = await response.text();
      const report = parseJson(text);
      if (response.status === 200 && report?.status === "ok") return { state: "healthy", report };
      last = report
        ? { state: "degraded", httpStatus: response.status, report }
        : { state: "unreachable", reason: `HTTP ${response.status}, non-JSON body: ${text.slice(0, 200)}` };
    } catch (error) {
      last = { state: "unreachable", reason: error instanceof Error ? error.message : String(error) };
    }
  }
  return last;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function evaluateWorkerHealth(result) {
  const title = "Production alert: /api/health is failing";
  if (result.state === "healthy") return clear(title, "200 ok");
  const evidence =
    result.state === "degraded"
      ? `HTTP ${result.httpStatus}:\n\n\`\`\`json\n${JSON.stringify(result.report, null, 2)}\n\`\`\``
      : `Unreachable: ${result.reason}`;
  return firing(
    title,
    `\`GET ${env.HEALTH_URL}\` failed ${HEALTH_ATTEMPTS} times in a row.\n\n${evidence}\n\nRunbooks: [deploy rollback](${runbook("deploy-rollback.md")}), [D1 full](${runbook("d1-full.md")}).`,
  );
}

async function evaluateD1Size(title) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}`,
    { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15_000) },
  );
  const payload = parseJson(await response.text());
  const sizeBytes = payload?.result?.file_size;
  if (!response.ok || typeof sizeBytes !== "number") {
    return unknown(title, `D1 API answered HTTP ${response.status}: ${JSON.stringify(payload?.errors ?? payload)}`);
  }
  const share = `${formatGB(sizeBytes)} of ${formatGB(D1_LIMIT_BYTES)} (${((sizeBytes / D1_LIMIT_BYTES) * 100).toFixed(1)}%)`;
  if (sizeBytes < D1_SIZE_ALERT_BYTES) return clear(title, share);
  return firing(
    title,
    `D1 database \`${payload.result.name}\` is at **${share}**. At 10 GB inserts fail and sign-in breaks (2026-11-08 incident).\n\nFollow the [D1 full runbook](${runbook("d1-full.md")}).`,
  );
}

function evaluateMaintenance(result) {
  const title = "Production alert: scheduled maintenance cron is not running cleanly";
  if (result.state === "unreachable") return unknown(title, "/api/health unreachable");
  const maintenance = result.report.maintenance;
  const explain = (meaning) =>
    firing(
      title,
      `The 5-minute cron (change-feed sweeper and D1 size check) ${meaning}\n\n\`\`\`json\n${JSON.stringify(maintenance, null, 2)}\n\`\`\`\n\nCheck the Worker's logs for \`"task":"scheduled-maintenance"\`. Without the sweeper \`github_change\` grows unbounded ([D1 full runbook](${runbook("d1-full.md")})).`,
    );

  switch (maintenance?.status) {
    case "recent":
      return maintenance.result === "ok"
        ? clear(title, `last run ${maintenance.lastRunAt}`)
        : explain("ran, but the sweep or the size check threw.");
    case "stale":
      return explain(`has not completed a run since ${maintenance.lastRunAt}.`);
    case "never_recorded":
      return explain("has not completed a run in the last 24 hours.");
    case "unreadable":
      return unknown(title, "/api/health could not read the heartbeat from KV");
    default:
      return unknown(title, `/api/health returned no maintenance status: ${JSON.stringify(maintenance)}`);
  }
}

async function evaluateErrorRate(title) {
  const end = Date.now() - ERROR_RATE_LAG_MS;
  const start = end - ERROR_RATE_WINDOW_MS;
  const query = `query ($account: String!, $script: String!, $start: Time!, $end: Time!) {
    viewer { accounts(filter: { accountTag: $account }) {
      workersInvocationsAdaptive(limit: 100, filter: { scriptName: $script, datetime_geq: $start, datetime_lt: $end }) {
        sum { requests errors }
        dimensions { httpResponseStatus }
      }
    } }
  }`;
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        account: env.CLOUDFLARE_ACCOUNT_ID,
        script: env.WORKER_NAME,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = parseJson(await response.text());
  const rows = payload?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
  if (!response.ok || payload?.errors?.length || !Array.isArray(rows)) {
    const errors = JSON.stringify(payload?.errors ?? payload);
    const permissionHint = /auth|permission|forbidden/i.test(errors)
      ? " The CLOUDFLARE_API_TOKEN secret needs Account Analytics: Read."
      : "";
    return unknown(title, `Workers analytics query failed (HTTP ${response.status}): ${errors}.${permissionHint}`);
  }
  const requests = rows.reduce((total, row) => total + row.sum.requests, 0);
  // `sum.errors` only counts invocations that threw; the Worker catches
  // errors and answers 500, so count 5xx responses as failures too.
  const errors = rows.reduce(
    (total, row) => total + (row.dimensions.httpResponseStatus >= 500 ? row.sum.requests : row.sum.errors),
    0,
  );
  const rate = requests === 0 ? 0 : errors / requests;
  const window = `${new Date(start).toISOString()} – ${new Date(end).toISOString()}`;
  const detail = `${errors} failed (5xx or exception) / ${requests} requests (${(rate * 100).toFixed(2)}%) in ${window}`;
  if (requests < ERROR_RATE_MIN_REQUESTS || rate < ERROR_RATE_THRESHOLD) return clear(title, detail);
  return firing(
    title,
    `Worker \`${env.WORKER_NAME}\`: **${detail}**.\n\nIf this started with a deploy, follow the [deploy rollback runbook](${runbook("deploy-rollback.md")}). Otherwise check Workers → ${env.WORKER_NAME} → Observability for the failing route.`,
  );
}

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok && response.status !== 422) {
    throw new Error(`GitHub ${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

let openAlertIssues;
async function openIssuesFor(check) {
  openAlertIssues ??= (await github(`/issues?state=open&labels=${ALERT_LABEL}&per_page=100`)).filter(
    (issue) => !issue.pull_request,
  );
  const titles = Object.values(issueTitles(check));
  return openAlertIssues.filter((issue) => titles.includes(issue.title));
}

function issueTitles(check) {
  return { firing: check.title, unknown: `${check.title} (check unavailable)` };
}

async function closeIssue(issue, comment) {
  await github(`/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) });
  await github(`/issues/${issue.number}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed", state_reason: "completed" }),
  });
}

async function reconcile(evaluation) {
  const runLink = `[the alert watchdog](${process.env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`;
  const open = await openIssuesFor(evaluation);
  const titles = issueTitles(evaluation);
  const firingIssue = open.find((issue) => issue.title === titles.firing);
  // A check that cannot be evaluated says nothing about recovery: keep a
  // firing issue open instead of churning it into an "unavailable" one.
  if (evaluation.state === "unknown" && firingIssue) return `open #${firingIssue.number} (check unavailable this run)`;
  const wantedTitle = evaluation.state === "clear" ? null : titles[evaluation.state];

  const outdated = open.filter((issue) => issue.title !== wantedTitle);
  for (const issue of outdated) {
    const comment =
      evaluation.state === "clear"
        ? `Recovered: ${evaluation.detail}. Closed by ${runLink}.`
        : `Superseded: this check is now \`${evaluation.state}\`. Closed by ${runLink}.`;
    await closeIssue(issue, comment);
  }
  const closed = outdated.map((issue) => `closed #${issue.number}`);

  if (!wantedTitle) return closed.join(", ") || "none";
  const current = open.find((issue) => issue.title === wantedTitle);
  if (current) return [...closed, `open #${current.number}`].join(", ");

  const body =
    evaluation.state === "firing"
      ? evaluation.body
      : `The alert watchdog cannot evaluate this check, so it is not protecting production:\n\n${evaluation.reason}`;
  await github("/labels", {
    method: "POST",
    body: JSON.stringify({ name: ALERT_LABEL, color: "b60205", description: "Opened by .github/workflows/production-alerts.yml" }),
  });
  const issue = await github("/issues", {
    method: "POST",
    body: JSON.stringify({
      title: wantedTitle,
      labels: [ALERT_LABEL],
      body: `${body}\n\n---\nOpened by ${runLink}, which runs every 15 minutes and closes this issue when the check recovers.`,
    }),
  });
  return [...closed, `opened #${issue.number}`].join(", ");
}

function writeSummary(results, outcomes) {
  const icon = { firing: "🔴", clear: "🟢", unknown: "⚪" };
  const lines = ["## Production alerts", "", "| Check | State | Detail | Issue |", "| --- | --- | --- | --- |"];
  results.forEach((result, index) => {
    const detail = result.state === "clear" ? result.detail : result.state === "unknown" ? result.reason : "see issue";
    lines.push(`| ${result.title.replace("Production alert: ", "")} | ${icon[result.state]} ${result.state} | ${detail.replaceAll("|", "\\|").replaceAll("\n", " ")} | ${outcomes[index]} |`);
  });
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`, { flag: "a" });
}

async function main() {
  const health = await fetchHealth();
  const evaluations = [
    evaluateWorkerHealth(health),
    await guarded("Production alert: D1 database above 8 GB", evaluateD1Size),
    evaluateMaintenance(health),
    await guarded("Production alert: Worker error rate above 5%", evaluateErrorRate),
  ];

  const actions = [];
  for (const evaluation of evaluations) {
    try {
      actions.push(await reconcile(evaluation));
    } catch (error) {
      actions.push(`reconcile failed: ${messageOf(error)}`);
    }
  }
  writeSummary(evaluations, actions);
  process.exit(actions.some((action) => action.startsWith("reconcile failed")) ? 1 : 0);
}

await main();
