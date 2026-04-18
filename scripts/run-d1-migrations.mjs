import { spawnSync } from "node:child_process";
import { resolveWranglerConfigPath } from "./resolve-wrangler-config-path.mts";
import {
  getSharedWranglerStatePath,
  isWorktreeCheckout,
} from "./shared-worktree-paths.mjs";

const PNPM_SCRIPT_EXT = /\.(c|m)?js$/u;

const databaseName = process.argv[2];
const mode = process.argv[3] ?? "--local";

if (!databaseName) {
  console.error(
    "Usage: node scripts/run-d1-migrations.mjs <database-name> [--local|--remote]"
  );
  process.exit(1);
}

if (mode !== "--local" && mode !== "--remote") {
  console.error(`Unsupported mode "${mode}". Use --local or --remote.`);
  process.exit(1);
}

const args = ["exec", "wrangler"];

let wranglerConfig = process.env.WRANGLER_CONFIG;
if (!wranglerConfig && mode === "--local") {
  wranglerConfig = resolveWranglerConfigPath({
    command: "serve",
    mode: "development",
    rootDir: process.cwd(),
  });
}
if (wranglerConfig) {
  args.push("-c", wranglerConfig);
}

args.push("d1", "migrations", "apply", databaseName, mode);

if (mode === "--local" && isWorktreeCheckout()) {
  args.push("--persist-to", getSharedWranglerStatePath());
}

function runPnpm(commandArgs) {
  const pnpmExecPath = process.env.npm_execpath;

  if (pnpmExecPath) {
    const shouldUseNode = PNPM_SCRIPT_EXT.test(pnpmExecPath);
    const command = shouldUseNode ? process.execPath : pnpmExecPath;
    const args = shouldUseNode ? [pnpmExecPath, ...commandArgs] : commandArgs;

    return spawnSync(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32" && !shouldUseNode,
    });
  }

  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  return spawnSync(pnpmCommand, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

const result = runPnpm(args);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
