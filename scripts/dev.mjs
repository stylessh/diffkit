import { existsSync } from "node:fs";
import path from "node:path";
import {
  assertPortsFree,
  assertToolchain,
  DASHBOARD_PORT,
  DevSetupError,
  dashboardDir,
  runDevScript,
  warmUpDashboard,
} from "./dev-env.mjs";
import { linkWorktreeDevFiles } from "./link-worktree-dev-vars.mjs";

const NO_GITHUB_HINT =
  "No GitHub app yet? `pnpm dev:demo` runs everything against a local GitHub emulator.";

function assertLocalConfig() {
  if (existsSync(path.join(dashboardDir, ".dev.vars"))) {
    throw new DevSetupError(
      [
        "apps/dashboard/.dev.vars is the old Wrangler file name; Void reads .env.",
        "  mv apps/dashboard/.dev.vars apps/dashboard/.env",
      ].join("\n")
    );
  }
  if (!existsSync(path.join(dashboardDir, ".env"))) {
    throw new DevSetupError(
      [
        "apps/dashboard/.env is missing.",
        "  pnpm setup:github",
        "creates the GitHub apps and writes it (docs/local-dev.md).",
        NO_GITHUB_HINT,
      ].join("\n")
    );
  }
}

runDevScript("dev", async ({ log, supervisor }) => {
  assertToolchain();
  await linkWorktreeDevFiles();
  assertLocalConfig();
  await assertPortsFree([{ port: DASHBOARD_PORT, name: "dashboard" }]);

  const dashboard = supervisor.start(
    "dashboard",
    "33",
    ["exec", "vite", "dev", "--port", String(DASHBOARD_PORT), "--strictPort"],
    { cwd: dashboardDir }
  );
  await warmUpDashboard(log, dashboard);
});
