import { getConfig } from "./config.js";
import type {
  LivegrepSearchItem,
  LivegrepSearchRequest,
  LivegrepSearchResponse,
} from "./types.js";

interface UpstreamSearchResponse {
  data?: unknown;
  partial?: unknown;
  results?: unknown;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeLineNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function asSearchResultItem(item: unknown): LivegrepSearchItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const row = item as Record<string, unknown>;
  let repo: string | null = null;
  if (typeof row.repo === "string") {
    repo = row.repo;
  } else if (typeof row.tree === "string") {
    repo = row.tree;
  }
  const path = typeof row.path === "string" ? row.path : null;
  const lineNumber = normalizeLineNumber(row.line_number ?? row.lno);
  if (!(repo && path) || lineNumber === null) {
    return null;
  }

  return {
    repo,
    path,
    line_number: lineNumber,
    line: typeof row.line === "string" ? row.line : "",
    context_before: normalizeStringArray(row.context_before),
    context_after: normalizeStringArray(row.context_after),
  };
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export class LivegrepClient {
  readonly #baseUrl: URL;
  readonly #token: string | null;

  constructor(params: { baseUrl: string; token: string | null }) {
    this.#baseUrl = new URL(params.baseUrl);
    this.#token = params.token;
  }

  async search(params: LivegrepSearchRequest): Promise<LivegrepSearchResponse> {
    const endpoint = new URL(this.#baseUrl);
    endpoint.searchParams.set("q", params.q);
    if (params.repo) {
      endpoint.searchParams.set("repo", params.repo);
    }
    if (params.path) {
      endpoint.searchParams.set("path", params.path);
    }
    if (params.lang) {
      endpoint.searchParams.set("lang", params.lang);
    }
    if (params.page) {
      endpoint.searchParams.set("page", params.page);
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Livegrep upstream returned ${response.status}`);
    }

    const payload = (await response.json()) as UpstreamSearchResponse;
    const source = toArray(payload.results).length
      ? toArray(payload.results)
      : toArray(payload.data);

    return {
      results: source
        .map(asSearchResultItem)
        .filter((item): item is LivegrepSearchItem => Boolean(item)),
      partial: Boolean(payload.partial),
    };
  }
}

const config = getConfig();
const searchEndpoint = new URL(
  config.livegrepSearchPath,
  config.livegrepUpstreamBaseUrl
).toString();

const client = new LivegrepClient({
  baseUrl: searchEndpoint,
  token: config.livegrepApiToken,
});

export function searchLivegrep(
  params: LivegrepSearchRequest
): Promise<LivegrepSearchResponse> {
  return client.search(params);
}
