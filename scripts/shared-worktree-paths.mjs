import { execSync } from "node:child_process";
import path from "node:path";

function safeExec(command, cwd = process.cwd()) {
	return execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"] })
		.toString()
		.trim();
}

export function getRepoRoot(cwd = process.cwd()) {
	return safeExec("git rev-parse --show-toplevel", cwd);
}

export function getPrimaryWorktreeRoot(cwd = process.cwd()) {
	const repoRoot = getRepoRoot(cwd);
	const commonDirRaw = safeExec("git rev-parse --git-common-dir", cwd);
	const commonDir = path.isAbsolute(commonDirRaw)
		? commonDirRaw
		: path.resolve(repoRoot, commonDirRaw);

	return path.dirname(commonDir);
}

export function isWorktreeCheckout(cwd = process.cwd()) {
	return path.resolve(getRepoRoot(cwd)) !== path.resolve(getPrimaryWorktreeRoot(cwd));
}

export function getSharedWranglerStatePath(cwd = process.cwd()) {
	return path.join(getPrimaryWorktreeRoot(cwd), ".wrangler", "state");
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
	if (isWorktreeCheckout()) {
		console.log(getSharedWranglerStatePath());
	}
}
