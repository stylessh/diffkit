import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Production deploy: `void deploy` applies D1 migrations (saving a Time Travel
// restore point first), uploads the Worker and checks /__void/ready. That only
// proves the Worker starts, so this script then waits for /login and
// /api/health (D1, KV, serving version) and rolls back if they never pass.

const config = {
  workerName: requireEnv("WORKER_NAME"),
  message: git(["log", "-1", "--pretty=format:%h %s"]),
  siteUrl: siteUrl(),
  healthGate: process.env.HEALTH_GATE === "skip" ? "skip" : "enforce",
  healthDeadlineMs: 120_000,
  healthIntervalMs: 5_000,
};

const SUCCESSFUL_PHASES = new Set(["verified", "unverified"]);
const PHASE_HEADLINE = {
  verified: "✅ Deployed and healthy",
  unverified: "⚠️ Deployed; health gate skipped",
  rolled_back: "❌ Health gate failed; rolled back",
  rollback_failed: "🚨 Health gate failed and rollback failed: production may be broken",
  failed: "❌ Deploy failed",
};

// Where the health gate looks: the custom domain when there is one, else the
// Worker's workers.dev URL.
function siteUrl() {
  if (process.env.DIFFKIT_DOMAIN) return `https://${process.env.DIFFKIT_DOMAIN}`;
  const subdomain = requireEnv("CLOUDFLARE_WORKERS_SUBDOMAIN").replace(/\.workers\.dev$/, "");
  return `https://${requireEnv("WORKER_NAME")}.${subdomain}.workers.dev`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function log(line) {
  console.log(`[deploy] ${line}`);
}

function exec(command, args, { capture = true } = {}) {
  const result = spawnSync("pnpm", ["exec", command, ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.slice(0, 2).join(" ")} exited ${result.status}\n${result.stderr ?? ""}${result.stdout ?? ""}`);
  }
  return result.stdout ?? "";
}

function servingVersionId() {
  const status = JSON.parse(exec("wrangler", ["deployments", "status", "--name", config.workerName, "--json"]));
  const [primary] = [...status.versions].sort((a, b) => b.percentage - a.percentage);
  if (!primary) throw new Error(`${config.workerName} has no deployed version`);
  return primary.version_id;
}

async function settle(deployed) {
  if (config.healthGate === "skip") {
    log("Health gate skipped (workflow_dispatch input).");
    return { ...deployed, phase: "unverified" };
  }

  const health = await waitForHealthy(deployed.versionId);
  if (health.status === "passed") return { ...deployed, phase: "verified", health };

  log(`Health gate failed; rolling back to ${deployed.previousVersionId}`);
  try {
    exec(
      "wrangler",
      ["rollback", deployed.previousVersionId, "--name", config.workerName, "--message", `Health gate failed for ${deployed.versionId}`, "--yes"],
      { capture: false },
    );
    const serving = servingVersionId();
    if (serving !== deployed.previousVersionId) {
      throw new Error(`after rollback ${serving} is serving, expected ${deployed.previousVersionId}`);
    }
    return { ...deployed, phase: "rolled_back", health };
  } catch (error) {
    return { ...deployed, phase: "rollback_failed", health, error: messageOf(error) };
  }
}

async function probe(path) {
  try {
    const response = await fetch(new URL(path, config.siteUrl), {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "Cache-Control": "no-cache" },
    });
    const body = await response.text();
    return { path, httpStatus: response.status, finalUrl: response.url, body };
  } catch (error) {
    return { path, httpStatus: 0, finalUrl: path, body: messageOf(error) };
  }
}

function judge(login, health, versionId) {
  if (login.httpStatus !== 200) return { verdict: "waiting", reason: `/login answered ${login.httpStatus}` };
  if (health.httpStatus !== 200) return { verdict: "waiting", reason: `/api/health answered ${health.httpStatus}: ${health.body.slice(0, 300)}` };
  let report;
  try {
    report = JSON.parse(health.body);
  } catch {
    return { verdict: "waiting", reason: `/api/health returned non-JSON: ${health.body.slice(0, 120)}` };
  }
  const servedVersion = report.version?.status === "known" ? report.version.id : "unknown";
  if (servedVersion !== versionId) return { verdict: "waiting", reason: `/api/health served version ${servedVersion}` };
  return { verdict: "healthy", report };
}

async function waitForHealthy(versionId) {
  const startedAt = Date.now();
  let attempts = 0;
  let last;
  while (Date.now() - startedAt < config.healthDeadlineMs) {
    attempts += 1;
    const [login, health] = await Promise.all([probe("/login"), probe("/api/health")]);
    last = { login: `${login.httpStatus} ${login.finalUrl}`, ...judge(login, health, versionId) };
    if (last.verdict === "healthy") {
      return { status: "passed", attempts, elapsedMs: Date.now() - startedAt, login: last.login, report: last.report };
    }
    log(`attempt ${attempts}: ${last.reason}`);
    await new Promise((done) => setTimeout(done, config.healthIntervalMs));
  }
  return { status: "failed", attempts, elapsedMs: Date.now() - startedAt, login: last.login, reason: last.reason };
}

function writeSummary(final) {
  const rows = [
    ["Phase", final.phase === "failed" ? `failed after \`${final.failedAfter}\`` : `\`${final.phase}\``],
    ["Commit", config.message],
    ["Previous version", final.previousVersionId ? `\`${final.previousVersionId}\`` : "—"],
    ["New version", final.versionId ? `\`${final.versionId}\`` : "not deployed"],
  ];
  if (final.health) {
    rows.push(
      ["Health gate", `${final.health.status} after ${final.health.attempts} attempt(s), ${(final.health.elapsedMs / 1000).toFixed(0)}s`],
      ["/login", final.health.login],
    );
    if (final.health.status === "failed") rows.push(["Last failure", final.health.reason]);
  }
  if (final.error) rows.push(["Error", final.error.split("\n")[0]]);

  const lines = [
    `## ${PHASE_HEADLINE[final.phase]}`,
    "",
    "| | |",
    "| --- | --- |",
    ...rows.map(([key, value]) => `| ${key} | ${String(value).replaceAll("|", "\\|")} |`),
  ];
  if (final.health?.status === "passed") {
    lines.push("", "<details><summary>/api/health</summary>", "", "```json", JSON.stringify(final.health.report, null, 2), "```", "</details>");
  }
  if (final.phase !== "verified") {
    lines.push(
      "",
      "If a migration damaged data, restore D1 to the point `void deploy` saved before migrating (its log above prints it; docs/runbooks/deploy-rollback.md): `void db restore --bookmark <bookmark>`",
    );
  }
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`, { flag: "a" });
}

function announce(final) {
  if (SUCCESSFUL_PHASES.has(final.phase)) return;
  const detail = final.error ?? final.health?.reason ?? "";
  console.log(`::error title=${PHASE_HEADLINE[final.phase]}::${detail.split("\n")[0]}`);
}

async function main() {
  let state = { phase: "starting" };
  try {
    state = { phase: "inspected", previousVersionId: servingVersionId() };
    log(`Serving version before deploy: ${state.previousVersionId}`);

    exec("void", ["deploy", "--platform", "cloudflare"], { capture: false });
    state = { ...state, phase: "deployed", versionId: servingVersionId() };
    if (state.versionId === state.previousVersionId) {
      throw new Error(`void deploy finished but ${state.versionId} is still serving`);
    }
    log(`Deployed version ${state.versionId}`);

    state = await settle(state);
  } catch (error) {
    state = { ...state, phase: "failed", failedAfter: state.phase, error: messageOf(error) };
  }

  writeSummary(state);
  announce(state);
  process.exit(SUCCESSFUL_PHASES.has(state.phase) ? 0 : 1);
}

await main();
