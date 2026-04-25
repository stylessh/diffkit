import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config.js";
import type {
  BuildIndexRequest,
  BuildIndexResponse,
  SearchRepoRuntimeState,
} from "./types.js";

const config = getConfig();

function repoCacheDir(owner: string, name: string) {
  return path.join(config.storageRoot, "repos", owner, `${name}.git`);
}

function buildOutputDir(owner: string, name: string) {
  return path.join(config.storageRoot, "builds", owner, name);
}

async function writePlaceholderIndexArtifacts({
  buildDir,
  headSha,
  owner,
  repo,
}: {
  buildDir: string;
  owner: string;
  repo: string;
  headSha: string;
}) {
  await fs.mkdir(buildDir, { recursive: true });
  const timestamp = new Date().toISOString();
  const indexPayload = {
    generated_at: timestamp,
    owner,
    repo,
    head_sha: headSha,
    note: "MVP placeholder artifact; replace with real livegrep index pipeline.",
  };
  await fs.writeFile(
    path.join(buildDir, "index.json"),
    JSON.stringify(indexPayload, null, 2),
    "utf8"
  );
}

export async function buildRepoIndex({
  body,
  repoState,
}: {
  body: BuildIndexRequest;
  repoState: SearchRepoRuntimeState;
}): Promise<BuildIndexResponse> {
  const repoDir = repoCacheDir(body.owner, body.name);
  const repoStats = await fs.stat(repoDir).catch(() => null);
  if (!repoStats?.isDirectory()) {
    throw new Error(
      `Mirror not found at ${repoDir}. Sync ${body.owner}/${body.name} first.`
    );
  }

  const selectedHead = body.head_sha || repoState.lastHeadSha;
  if (!selectedHead) {
    throw new Error("Missing head_sha and no synced head available.");
  }

  const buildDir = buildOutputDir(body.owner, body.name);
  await writePlaceholderIndexArtifacts({
    buildDir,
    owner: body.owner,
    repo: body.name,
    headSha: selectedHead,
  });

  const manifestKey = [
    "search/manifests",
    body.owner,
    body.name,
    `${Date.now()}-${selectedHead.slice(0, 12)}.json`,
  ].join("/");
  const manifestPath = path.join(config.storageRoot, manifestKey);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        repo: `${body.owner}/${body.name}`,
        repo_id: body.repo_id,
        head_sha: selectedHead,
        generated_at: new Date().toISOString(),
        build_dir: buildDir,
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    head_sha: selectedHead,
    manifest_r2_key: manifestKey,
  };
}
