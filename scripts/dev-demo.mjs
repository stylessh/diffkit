// `pnpm dev:demo` — run DiffKit locally with no GitHub account, app or network.
//
//   1. applies D1 migrations to the demo's own Miniflare state
//   2. starts the GitHub emulator (apps/emulator) and waits until it is seeded
//   3. starts the dashboard with CLOUDFLARE_ENV=demo (.dev.vars.demo)
//
// Flags: --reset (reseed the emulator and wipe demo D1/KV/R2 state)
// Ports are fixed: the emulator on :4001 (GITHUB_EMULATOR_URL in the committed
// .dev.vars.demo) and the dashboard on :3000 (the seeded OAuth callback URLs).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const dashboardDir = path.join(repoRoot, "apps/dashboard");
const demoStatePath = path.join(dashboardDir, ".wrangler/demo-state");
const emulatorPort = "4001";
const emulatorUrl = `http://localhost:${emulatorPort}`;
const reset = process.argv.includes("--reset");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const children = new Set();
let shuttingDown = false;

function log(message) {
  console.log(`\x1b[35m[dev:demo]\x1b[0m ${message}`);
}

function prefixStream(stream, label, color) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      process.stdout.write(`\x1b[${color}m[${label}]\x1b[0m ${line}\n`);
    }
  });
}

function start(label, color, args, options) {
  const child = spawn(pnpm, args, {
    cwd: repoRoot,
    env: { ...process.env, FORCE_COLOR: "1", ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  prefixStream(child.stdout, label, color);
  prefixStream(child.stderr, label, color);
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      log(`${label} exited (${signal ?? code}); stopping.`);
      // Any exit we did not ask for is a failure, even a clean one.
      shutdown(code || 1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function waitForEmulator(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${emulatorUrl}/_diffkit/health`);
      if (response.ok && (await response.json()).ready) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`GitHub emulator did not become ready at ${emulatorUrl}`);
}

async function main() {
  if (reset && existsSync(demoStatePath)) {
    log("--reset: wiping demo D1/KV/R2 state");
    rmSync(demoStatePath, { recursive: true, force: true });
  }

  log("applying D1 migrations to the demo database");
  const migrate = spawnSync(
    pnpm,
    [
      "--filter",
      "@diffkit/dashboard",
      "exec",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "-c",
      "wrangler.demo.jsonc",
      "--env",
      "demo",
      "--persist-to",
      demoStatePath,
    ],
    { cwd: repoRoot, stdio: "inherit", env: { ...process.env, CI: "true" } }
  );
  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }

  log(`starting GitHub emulator on ${emulatorUrl}`);
  start(
    "emulator",
    "36",
    ["--filter", "@diffkit/emulator", "start", ...(reset ? ["--reset"] : [])],
    { env: { EMULATOR_PORT: emulatorPort } }
  );
  await waitForEmulator();

  log("starting dashboard on http://localhost:3000");
  start(
    "dashboard",
    "33",
    [
      "--filter",
      "@diffkit/dashboard",
      "exec",
      "vite",
      "dev",
      "--port",
      "3000",
      "--strictPort",
    ],
    { env: { CLOUDFLARE_ENV: "demo" } }
  );
  log(
    'open http://localhost:3000 → "Continue with GitHub" → pick "nova" in the emulator'
  );
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
