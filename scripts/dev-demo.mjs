import { rmSync } from "node:fs";
import path from "node:path";
import {
  assertPortsFree,
  assertToolchain,
  DASHBOARD_PORT,
  DevSetupError,
  dashboardDir,
  emulatorDir,
  runDevScript,
  runStep,
  waitForResponse,
  warmUpDashboard,
} from "./dev-env.mjs";

const EMULATOR_PORT = 4001;
const EMULATOR_URL = `http://localhost:${EMULATOR_PORT}`;
const demoStatePath = path.join(dashboardDir, ".wrangler/demo-state");
const reset = process.argv.includes("--reset");

async function waitForSeededEmulator(emulator) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const response = await waitForResponse(`${EMULATOR_URL}/_diffkit/health`, {
      timeoutMs: deadline - Date.now(),
      abandon: emulator.exited,
    });
    if (response.ok && (await response.json()).ready) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new DevSetupError("The GitHub emulator never finished seeding.");
}

runDevScript("dev:demo", async ({ log, supervisor }) => {
  assertToolchain();
  await assertPortsFree([
    { port: DASHBOARD_PORT, name: "dashboard" },
    { port: EMULATOR_PORT, name: "GitHub emulator" },
  ]);

  if (reset) {
    log("--reset: wiping demo D1/KV/R2 state");
    rmSync(demoStatePath, { recursive: true, force: true });
  }

  log("applying D1 migrations to the demo database");
  runStep(
    "Applying demo D1 migrations",
    [
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
    { cwd: dashboardDir, env: { CI: "true" } }
  );

  log(`starting GitHub emulator on ${EMULATOR_URL}`);
  const emulator = supervisor.start(
    "emulator",
    "36",
    ["run", "start", ...(reset ? ["--reset"] : [])],
    { cwd: emulatorDir, env: { EMULATOR_PORT: String(EMULATOR_PORT) } }
  );
  await waitForSeededEmulator(emulator);

  log(`starting dashboard on port ${DASHBOARD_PORT}`);
  const dashboard = supervisor.start(
    "dashboard",
    "33",
    ["exec", "vite", "dev", "--port", String(DASHBOARD_PORT), "--strictPort"],
    { cwd: dashboardDir, env: { CLOUDFLARE_ENV: "demo" } }
  );
  await warmUpDashboard(log, dashboard);
  log('sign in: "Continue with GitHub", then pick "nova" in the emulator');
});
