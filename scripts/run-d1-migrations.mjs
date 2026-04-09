import { spawnSync } from "node:child_process";
import { getSharedWranglerStatePath, isWorktreeCheckout } from "./shared-worktree-paths.mjs";

const databaseName = process.argv[2];
const mode = process.argv[3] ?? "--local";

if (!databaseName) {
	console.error(
		"Usage: node scripts/run-d1-migrations.mjs <database-name> [--local|--remote]",
	);
	process.exit(1);
}

if (mode !== "--local" && mode !== "--remote") {
	console.error(`Unsupported mode "${mode}". Use --local or --remote.`);
	process.exit(1);
}

const args = ["exec", "wrangler", "d1", "migrations", "apply", databaseName, mode];

if (mode === "--local" && isWorktreeCheckout()) {
	args.push("--persist-to", getSharedWranglerStatePath());
}

function runPnpm(commandArgs) {
	const pnpmExecPath = process.env.npm_execpath;

	if (pnpmExecPath) {
		const shouldUseNode = /\.(c|m)?js$/u.test(pnpmExecPath);
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
