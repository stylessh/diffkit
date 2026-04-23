import path from "node:path";

const DEFAULT_PORT = 8910;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_ALLOWED_PROVIDERS = "github";
const DEFAULT_LIVEGREP_UPSTREAM = "http://127.0.0.1:8911";
const DEFAULT_STORAGE_ROOT = "./.search-data";
const DEFAULT_LIVEGREP_SEARCH_PATH = "/api/v1/search";
const DEFAULT_MAX_REPO_SIZE_MB = 10_000;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseAllowedProviders(raw: string | undefined): Set<string> {
  const source = raw ?? DEFAULT_ALLOWED_PROVIDERS;
  return new Set(
    source
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function optionalString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface SearchServiceConfig {
  allowedProviders: Set<string>;
  host: string;
  livegrepApiToken: string | null;
  livegrepSearchPath: string;
  livegrepUpstreamBaseUrl: string;
  maxRepoSizeMb: number;
  port: number;
  searchControlToken: string | null;
  storageRoot: string;
}

export function getConfig(): SearchServiceConfig {
  const env = process.env;
  const storageRoot = env.SEARCH_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT;
  return {
    port: parseNumber(env.PORT, DEFAULT_PORT),
    host: env.HOST ?? DEFAULT_HOST,
    livegrepUpstreamBaseUrl:
      env.LIVEGREP_UPSTREAM_BASE_URL ?? DEFAULT_LIVEGREP_UPSTREAM,
    livegrepSearchPath:
      env.LIVEGREP_SEARCH_PATH ?? DEFAULT_LIVEGREP_SEARCH_PATH,
    allowedProviders: parseAllowedProviders(env.ALLOWED_REPO_PROVIDERS),
    livegrepApiToken: optionalString(env.LIVEGREP_API_TOKEN),
    searchControlToken: optionalString(env.SEARCH_CONTROL_TOKEN),
    storageRoot: path.resolve(storageRoot),
    maxRepoSizeMb: parseNumber(env.MAX_REPO_SIZE_MB, DEFAULT_MAX_REPO_SIZE_MB),
  };
}
