import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config.js";
import type {
  RepoProvider,
  RepoRecord,
  SearchRepoRuntimeState,
  SearchState,
} from "./types.js";

function createInitialState(): SearchState {
  return {
    reposById: {},
    repoIdByRef: {},
    lastBuildVersion: null,
    lastBuildAt: null,
  };
}

function defaultRepoRecord({
  repoId,
  defaultBranch,
  name,
  owner,
  provider,
}: {
  repoId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  provider: RepoProvider;
}): RepoRecord {
  return {
    repoId,
    owner,
    name,
    provider,
    defaultBranch,
    mirrorPath: null,
    lastSyncedAt: null,
    lastSyncedHeadSha: null,
    lastIndexedAt: null,
    lastIndexedHeadSha: null,
    lastManifestPath: null,
  };
}

export class SearchStateStore {
  private readonly dataDir: string;
  private readonly stateFilePath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.stateFilePath = path.join(dataDir, "search-state.json");
  }

  private async ensureDataDir() {
    await mkdir(this.dataDir, { recursive: true });
  }

  async readState(): Promise<SearchState> {
    await this.ensureDataDir();
    try {
      const raw = await readFile(this.stateFilePath, "utf8");
      const parsed = JSON.parse(raw) as SearchState;
      return {
        reposById: parsed.reposById ?? {},
        repoIdByRef: parsed.repoIdByRef ?? {},
        lastBuildVersion: parsed.lastBuildVersion ?? null,
        lastBuildAt: parsed.lastBuildAt ?? null,
      };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return createInitialState();
      }
      throw error;
    }
  }

  private async writeState(state: SearchState) {
    await this.ensureDataDir();
    await writeFile(this.stateFilePath, JSON.stringify(state, null, 2), "utf8");
  }

  async withState<T>(
    updater: (state: SearchState) => Promise<T> | T
  ): Promise<T> {
    const state = await this.readState();
    const result = await updater(state);
    await this.writeState(state);
    return result;
  }

  upsertRepo(input: {
    owner: string;
    name: string;
    defaultBranch: string;
    provider: RepoProvider;
  }): Promise<RepoRecord> {
    return this.withState((state) => {
      const repoKey = `${input.owner}/${input.name}`;
      const repoId = state.repoIdByRef[repoKey] ?? repoKey;
      const existing = state.reposById[repoId];
      const next: RepoRecord = existing
        ? {
            ...existing,
            defaultBranch: input.defaultBranch,
            provider: input.provider,
          }
        : {
            ...defaultRepoRecord({
              repoId,
              owner: input.owner,
              name: input.name,
              defaultBranch: input.defaultBranch,
              provider: input.provider,
            }),
            mirrorPath: null,
          };
      state.reposById[repoId] = next;
      state.repoIdByRef[repoKey] = repoId;
      return next;
    });
  }

  updateRepo(
    repoId: string,
    updater: (repo: RepoRecord) => RepoRecord
  ): Promise<RepoRecord> {
    return this.withState((state) => {
      const repo = state.reposById[repoId];
      if (!repo) {
        throw new Error(`Repository ${repoId} not found in search state`);
      }
      const next = updater(repo);
      state.reposById[repoId] = next;
      state.repoIdByRef[repoRef(next.owner, next.name)] = repoId;
      return next;
    });
  }

  async setBuildVersion({
    buildVersion,
    lastBuildAt,
  }: {
    buildVersion: string;
    lastBuildAt: string;
  }) {
    await this.withState((state) => {
      state.lastBuildVersion = buildVersion;
      state.lastBuildAt = lastBuildAt;
    });
  }
}

const config = getConfig();
const stateStore = new SearchStateStore(config.storageRoot);

export function getRepoPaths(repoId: string) {
  const repoDir = path.join(config.storageRoot, "repos", repoId);
  return {
    repoDir,
    mirrorPath: path.join(repoDir, "mirror.git"),
  };
}

export function repoRef(owner: string, name: string) {
  return `${owner}/${name}`;
}

export async function ensureRepoRuntimeState(input: {
  repoId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  provider: RepoProvider;
}): Promise<SearchRepoRuntimeState> {
  const existing = await getRepoState(input.repoId);
  if (existing) {
    return existing;
  }
  const ref = repoRef(input.owner, input.name);
  const existingByRef = await getRepoRuntimeStateByRef(ref);
  if (existingByRef) {
    return existingByRef;
  }

  await stateStore.upsertRepo({
    owner: input.owner,
    name: input.name,
    defaultBranch: input.defaultBranch,
    provider: input.provider,
  });
  await stateStore.withState((state) => {
    const existingRecordId = state.repoIdByRef[ref];
    const existingRecord = existingRecordId
      ? state.reposById[existingRecordId]
      : null;
    state.reposById[input.repoId] = {
      repoId: input.repoId,
      provider: existingRecord?.provider ?? input.provider,
      owner: input.owner,
      name: input.name,
      defaultBranch: existingRecord?.defaultBranch ?? input.defaultBranch,
      mirrorPath: existingRecord?.mirrorPath ?? null,
      lastSyncedHeadSha: existingRecord?.lastSyncedHeadSha ?? null,
      lastIndexedHeadSha: existingRecord?.lastIndexedHeadSha ?? null,
      lastSyncedAt: existingRecord?.lastSyncedAt ?? null,
      lastIndexedAt: existingRecord?.lastIndexedAt ?? null,
      lastManifestPath: existingRecord?.lastManifestPath ?? null,
    };
    state.repoIdByRef[ref] = input.repoId;
  });

  const repo = await getRepoState(input.repoId);
  if (!repo) {
    throw new Error(`Failed to persist runtime state for repo ${input.repoId}`);
  }
  return {
    repoId: input.repoId,
    repoRef: repoRef(repo.owner, repo.name),
    owner: repo.owner,
    name: repo.name,
    defaultBranch: repo.defaultBranch,
    provider: repo.provider,
    lastHeadSha: repo.lastHeadSha,
    lastIndexedHeadSha: repo.lastIndexedHeadSha,
    lastSyncedAt: repo.lastSyncedAt,
    lastIndexedAt: repo.lastIndexedAt,
    mirrorPath: repo.mirrorPath,
  };
}

export async function getRepoRuntimeStateByRef(
  ref: string
): Promise<SearchRepoRuntimeState | null> {
  const state = await stateStore.readState();
  const repoId = state.repoIdByRef[ref];
  if (!repoId) {
    return null;
  }
  const repo = state.reposById[repoId];
  if (!repo) {
    return null;
  }
  return {
    repoId,
    repoRef: ref,
    owner: repo.owner,
    name: repo.name,
    defaultBranch: repo.defaultBranch,
    provider: repo.provider,
    lastHeadSha: repo.lastSyncedHeadSha,
    lastIndexedHeadSha: repo.lastIndexedHeadSha,
    lastSyncedAt: repo.lastSyncedAt,
    lastIndexedAt: repo.lastIndexedAt,
    mirrorPath: repo.mirrorPath,
  };
}

export async function getRepoState(
  repoId: string
): Promise<SearchRepoRuntimeState | null> {
  const state = await stateStore.readState();
  const repo = state.reposById[repoId];
  if (!repo) {
    return null;
  }
  return {
    repoId,
    repoRef: repoRef(repo.owner, repo.name),
    owner: repo.owner,
    name: repo.name,
    defaultBranch: repo.defaultBranch,
    provider: repo.provider,
    lastHeadSha: repo.lastSyncedHeadSha,
    lastIndexedHeadSha: repo.lastIndexedHeadSha,
    lastSyncedAt: repo.lastSyncedAt,
    lastIndexedAt: repo.lastIndexedAt,
    mirrorPath: repo.mirrorPath,
  };
}

export async function upsertRepoState(params: {
  repoId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  headSha: string;
  mirrorPath: string;
  updatedAt: number;
}): Promise<void> {
  await stateStore.withState((state) => {
    const ref = repoRef(params.owner, params.name);
    const existing = state.reposById[params.repoId];
    state.reposById[params.repoId] = {
      repoId: params.repoId,
      provider: existing?.provider ?? "github",
      owner: params.owner,
      name: params.name,
      defaultBranch: params.defaultBranch,
      mirrorPath: params.mirrorPath,
      lastSyncedHeadSha: params.headSha,
      lastIndexedHeadSha: existing?.lastIndexedHeadSha ?? null,
      lastSyncedAt: params.updatedAt,
      lastIndexedAt: existing?.lastIndexedAt ?? null,
      lastManifestPath: existing?.lastManifestPath ?? null,
    };
    state.repoIdByRef[ref] = params.repoId;
  });
}

export async function updateRepoSyncState(params: {
  repoRef: string;
  defaultBranch: string;
  headSha: string;
  mirrorPath: string;
}): Promise<void> {
  const state = await stateStore.readState();
  const repoId = state.repoIdByRef[params.repoRef];
  if (!repoId) {
    throw new Error(`Repository ${params.repoRef} not found in search state`);
  }
  await stateStore.updateRepo(repoId, (repo) => ({
    ...repo,
    defaultBranch: params.defaultBranch,
    lastSyncedHeadSha: params.headSha,
    mirrorPath: params.mirrorPath,
    lastSyncedAt: Date.now(),
  }));
}

export async function updateRepoIndexState(params: {
  repoRef: string;
  headSha: string;
  manifestPath: string;
}): Promise<void> {
  const state = await stateStore.readState();
  const repoId = state.repoIdByRef[params.repoRef];
  if (!repoId) {
    throw new Error(`Repository ${params.repoRef} not found in search state`);
  }
  await stateStore.updateRepo(repoId, (repo) => ({
    ...repo,
    lastIndexedHeadSha: params.headSha,
    lastIndexedAt: Date.now(),
    lastManifestPath: params.manifestPath,
  }));
}
