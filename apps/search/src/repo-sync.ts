import { mkdir, rm } from "node:fs/promises";
import { runGit } from "./shell.js";
import { getRepoPaths, getRepoState, upsertRepoState } from "./state.js";

export async function syncRepository(params: {
  repoId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  githubToken: string;
}) {
  const { defaultBranch, githubToken, name, owner, repoId } = params;
  const paths = getRepoPaths(repoId);

  await mkdir(paths.repoDir, { recursive: true });
  const remote = `https://x-access-token:${encodeURIComponent(githubToken)}@github.com/${owner}/${name}.git`;

  const existing = await getRepoState(repoId);
  if (existing?.mirrorPath) {
    await runGit([
      "-C",
      paths.mirrorPath,
      "remote",
      "set-url",
      "origin",
      remote,
    ]);
  } else {
    await rm(paths.mirrorPath, { force: true });
    await runGit([
      "clone",
      "--mirror",
      "--filter=blob:none",
      remote,
      paths.mirrorPath,
    ]);
  }

  await runGit(["-C", paths.mirrorPath, "fetch", "--prune", "origin"]);
  const headSha = (
    await runGit([
      "-C",
      paths.mirrorPath,
      "rev-parse",
      `refs/remotes/origin/${defaultBranch}`,
    ])
  ).trim();

  await upsertRepoState({
    repoId,
    owner,
    name,
    defaultBranch,
    headSha,
    mirrorPath: paths.mirrorPath,
    updatedAt: Date.now(),
  });

  return {
    repo_id: repoId,
    head_sha: headSha,
  };
}
