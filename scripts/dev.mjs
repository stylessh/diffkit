import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  assertPortsFree,
  assertToolchain,
  DASHBOARD_PORT,
  DevSetupError,
  dashboardDir,
  runDevScript,
  runStep,
  warmUpDashboard,
} from "./dev-env.mjs";
import { linkWorktreeDevFiles } from "./link-worktree-dev-vars.mjs";

const NO_GITHUB_HINT =
  "No GitHub app yet? `pnpm dev:demo` runs everything against a local GitHub emulator.";

function assertLocalConfig() {
  const wranglerConfig = path.join(dashboardDir, "wrangler.dev.jsonc");
  if (!existsSync(wranglerConfig)) {
    throw new DevSetupError(
      [
        "apps/dashboard/wrangler.dev.jsonc is missing.",
        "  cp apps/dashboard/wrangler.jsonc.example apps/dashboard/wrangler.dev.jsonc",
        "and fill in your Cloudflare ids (docs/local-dev.md).",
        NO_GITHUB_HINT,
      ].join("\n")
    );
  }
  if (readFileSync(wranglerConfig, "utf8").includes('"YOUR_')) {
    throw new DevSetupError(
      `apps/dashboard/wrangler.dev.jsonc still has YOUR_… placeholders. Fill them in (docs/local-dev.md).\n${NO_GITHUB_HINT}`
    );
  }
  if (!existsSync(path.join(dashboardDir, ".dev.vars"))) {
    throw new DevSetupError(
      [
        "apps/dashboard/.dev.vars is missing.",
        "  cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars",
        "and add your GitHub OAuth App and GitHub App credentials (docs/local-dev.md).",
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

  log("applying local D1 migrations");
  runStep("Applying D1 migrations", ["run", "migrate:local"], {
    cwd: dashboardDir,
    env: { CI: "true" },
  });

  const dashboard = supervisor.start(
    "dashboard",
    "33",
    ["exec", "vite", "dev", "--port", String(DASHBOARD_PORT), "--strictPort"],
    { cwd: dashboardDir }
  );
  await warmUpDashboard(log, dashboard);
});
