import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const config = {
  workerName: requireEnv("WORKER_NAME"),
  databaseName: requireEnv("D1_DATABASE_NAME"),
  wranglerConfig: requireEnv("WRANGLER_CONFIG"),
  message: git(["log", "-1", "--pretty=format:%h %s"]),
  tag: git(["log", "-1", "--pretty=format:%h"]),
  siteUrl: process.env.SITE_URL ?? "https://diff-kit.com",
  healthGate: process.env.HEALTH_GATE === "skip" ? "skip" : "enforce",
  migrationTimeoutMs: Number(process.env.MIGRATION_TIMEOUT_SECONDS ?? 300) * 1000,
  healthDeadlineMs: 120_000,
  healthIntervalMs: 5_000,
};

const MIGRATIONS_SCRIPT = resolve(import.meta.dirname, "run-d1-migrations.mjs");
const SUCCESSFUL_PHASES = new Set(["verified", "unverified"]);
const PHASE_HEADLINE = {
  verified: "✅ Deployed and healthy",
  unverified: "⚠️ Deployed; health gate skipped",
  rolled_back: "❌ Health gate failed; rolled back",
  rollback_failed: "🚨 Health gate failed and rollback failed: production may be broken",
  failed: "❌ Deploy failed",
};

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

function wrangler(args, { capture = true, timeoutMs, env } = {}) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    timeout: timeoutMs,
    env: { ...process.env, ...env },
  });
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(`wrangler ${args.slice(0, 3).join(" ")} timed out after ${timeoutMs / 1000}s`);
  }
  if (result.status !== 0) {
    throw new Error(`wrangler ${args.slice(0, 3).join(" ")} exited ${result.status}\n${result.stderr ?? ""}${result.stdout ?? ""}`);
  }
  return result.stdout ?? "";
}

function currentVersionId() {
  const status = JSON.parse(wrangler(["deployments", "status", "--name", config.workerName, "--json"]));
  const [primary] = [...status.versions].sort((a, b) => b.percentage - a.percentage);
  if (!primary) throw new Error("No deployed version to roll back to");
  return primary.version_id;
}

function timeTravelBookmark() {
  const info = JSON.parse(wrangler(["d1", "time-travel", "info", config.databaseName, "--json"]));
  if (!info.bookmark) throw new Error(`No bookmark in time-travel info: ${JSON.stringify(info)}`);
  return info.bookmark;
}

function applyMigrations() {
  // A migration that rewrites a multi-GB table holds the deploy; on timeout the
  // statement may still finish server side, so check `wrangler d1 migrations list`.
  const result = spawnSync(process.execPath, ["--experimental-strip-types", MIGRATIONS_SCRIPT, "DB", "--remote"], {
    stdio: "inherit",
    timeout: config.migrationTimeoutMs,
    env: { ...process.env, WRANGLER_CONFIG: config.wranglerConfig },
  });
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(`D1 migrations timed out after ${config.migrationTimeoutMs / 1000}s`);
  }
  if (result.status !== 0) throw new Error(`D1 migrations exited ${result.status}`);
}

function deployWorker() {
  const outputFile = join(mkdtempSync(join(tmpdir(), "wrangler-output-")), "output.ndjson");
  wrangler(["deploy", "--message", config.message, "--tag", config.tag], {
    capture: false,
    env: { WRANGLER_OUTPUT_FILE_PATH: outputFile },
  });
  const deploy = readFileSync(outputFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((entry) => entry.type === "deploy");
  if (!deploy?.version_id) throw new Error("wrangler deploy wrote no version_id");
  return deploy.version_id;
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
    wrangler(
      ["rollback", deployed.previousVersionId, "--name", config.workerName, "--message", `Health gate failed for ${deployed.versionId} (${config.tag})`, "--yes"],
      { capture: false },
    );
    const servingVersionId = currentVersionId();
    if (servingVersionId !== deployed.previousVersionId) {
      throw new Error(`after rollback ${servingVersionId} is serving, expected ${deployed.previousVersionId}`);
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
    ["D1 bookmark (pre-migration)", final.bookmark ? `\`${final.bookmark}\`` : "—"],
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
  if (final.bookmark && final.phase !== "verified") {
    lines.push(
      "",
      `Restore D1 to its pre-migration state only if a migration damaged data (docs/runbooks/deploy-rollback.md): \`wrangler d1 time-travel restore ${config.databaseName} --bookmark ${final.bookmark}\``,
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
    state = { phase: "bookmarked", previousVersionId: currentVersionId(), bookmark: timeTravelBookmark() };
    log(`D1 Time Travel bookmark before migrations: ${state.bookmark}`);
    log(`Serving version before deploy: ${state.previousVersionId}`);

    applyMigrations();
    state = { ...state, phase: "migrated" };

    state = { ...state, phase: "deployed", versionId: deployWorker() };
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
