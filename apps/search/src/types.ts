export type RepoProvider = "github";

export interface SearchResult {
  context_after: string[];
  context_before: string[];
  line: string;
  line_number: number;
  path: string;
  repo: string;
}

export interface LivegrepSearchItem extends SearchResult {}

export interface LivegrepSearchRequest {
  lang?: string;
  page?: string;
  path?: string;
  q: string;
  repo?: string;
}

export interface LivegrepSearchResponse {
  partial: boolean;
  results: SearchResult[];
}

export interface SearchQueryParams extends LivegrepSearchRequest {}

export interface RepoSyncRequest {
  default_branch?: string;
  github_token?: string;
  name: string;
  owner: string;
  provider?: RepoProvider;
  repo_id: string;
  trigger?: string;
}

export interface RepoSyncResponse {
  head_sha: string;
  repo_id: string;
}

export interface BuildIndexRequest {
  default_branch?: string;
  head_sha?: string | null;
  name: string;
  owner: string;
  repo_id: string;
  trigger?: string;
}

export interface BuildIndexResponse {
  head_sha: string;
  manifest_r2_key: string;
}

export interface SearchRepoRuntimeState {
  defaultBranch: string;
  lastHeadSha: string | null;
  lastIndexedAt: number | null;
  lastIndexedHeadSha: string | null;
  lastSyncedAt: number | null;
  mirrorPath: string | null;
  name: string;
  owner: string;
  provider: RepoProvider;
  repoId: string;
  repoRef: string;
}

export interface RepoRecord {
  defaultBranch: string;
  lastIndexedAt: number | null;
  lastIndexedHeadSha: string | null;
  lastManifestPath: string | null;
  lastSyncedAt: number | null;
  lastSyncedHeadSha: string | null;
  mirrorPath: string | null;
  name: string;
  owner: string;
  provider: RepoProvider;
  repoId: string;
}

export interface SearchState {
  lastBuildAt: string | null;
  lastBuildVersion: string | null;
  repoIdByRef: Record<string, string>;
  reposById: Record<string, RepoRecord>;
}

export interface RepoRuntimeState extends SearchRepoRuntimeState {}
