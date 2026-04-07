import { spawnSync } from "node:child_process";
import { getSharedWranglerStatePath, isWorktreeCheckout } from "./shared-worktree-paths.mjs";

const databaseName = process.argv[2];

if (!databaseName) {
	console.error("Usage: node scripts/run-d1-migrations.mjs <database-name>");
	process.exit(1);
}

const args = ["exec", "wrangler", "d1", "migrations", "apply", databaseName, "--local"];

if (isWorktreeCheckout()) {
	args.push("--persist-to", getSharedWranglerStatePath());
}

const result = spawnSync("pnpm", args, {
	stdio: "inherit",
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 0);
