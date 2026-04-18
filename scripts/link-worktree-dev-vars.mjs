// When this repo is opened through Git worktrees, only the main checkout usually
// keeps the real `.dev.vars` and `wrangler.dev.jsonc`. This script links those files
// into each worktree so every workspace sees the same local config during development.
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const PRIMARY_WORKTREE_LINK_PATHS = [
  "apps/dashboard/.dev.vars",
  "apps/dashboard/wrangler.dev.jsonc",
];

function safeExec(command, cwd) {
  return execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

async function fileExists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveRoots() {
  const repoRoot = safeExec("git rev-parse --show-toplevel", process.cwd());
  const commonDirRaw = safeExec(
    "git rev-parse --git-common-dir",
    process.cwd()
  );
  const commonDir = path.isAbsolute(commonDirRaw)
    ? commonDirRaw
    : path.resolve(repoRoot, commonDirRaw);
  const primaryRoot = path.dirname(commonDir);

  return { repoRoot, primaryRoot };
}

async function linkFromPrimaryWorktree(relPath, primaryRoot, repoRoot) {
  const source = path.join(primaryRoot, relPath);
  const target = path.join(repoRoot, relPath);
  const targetDir = path.dirname(target);

  if (!(await fileExists(source))) {
    return {
      status: "skipped",
      reason: `${relPath} (missing in main worktree)`,
    };
  }

  await fs.mkdir(targetDir, { recursive: true });

  const relativeSource = path.relative(targetDir, source);

  if (await fileExists(target)) {
    const stat = await fs.lstat(target);

    if (stat.isSymbolicLink()) {
      const currentTarget = await fs.readlink(target);

      if (currentTarget === relativeSource) {
        return { status: "unchanged" };
      }

      await fs.unlink(target);
    } else {
      return {
        status: "skipped",
        reason: `${relPath} (real file exists)`,
      };
    }
  }

  await fs.symlink(relativeSource, target);
  return { status: "linked", reason: relPath };
}

function printResults(linked, skipped) {
  if (linked.length > 0) {
    console.log("Linked from primary worktree:");
    for (const file of linked) {
      console.log(`  - ${file}`);
    }
  }

  if (skipped.length > 0) {
    console.log("Skipped:");
    for (const file of skipped) {
      console.log(`  - ${file}`);
    }
  }
}

async function main() {
  const { repoRoot, primaryRoot } = resolveRoots();

  if (path.resolve(repoRoot) === path.resolve(primaryRoot)) {
    return;
  }

  const linked = [];
  const skipped = [];

  for (const relPath of PRIMARY_WORKTREE_LINK_PATHS) {
    const result = await linkFromPrimaryWorktree(
      relPath,
      primaryRoot,
      repoRoot
    );

    if (result.status === "linked") {
      linked.push(result.reason);
    }

    if (result.status === "skipped") {
      skipped.push(result.reason);
    }
  }

  printResults(linked, skipped);
}

main().catch((error) => {
  console.error("worktree dev file link failed:", error.message);
  process.exit(1);
});
