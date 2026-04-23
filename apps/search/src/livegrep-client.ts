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

function asSearchResultItem(item: unknown): LivegrepSearchItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const row = item as Record<string, unknown>;
  if (
    typeof row.repo !== "string" ||
    typeof row.path !== "string" ||
    typeof row.line_number !== "number"
  ) {
    return null;
  }

  return {
    repo: row.repo,
    path: row.path,
    line_number: row.line_number,
    line: typeof row.line === "string" ? row.line : "",
    context_before: Array.isArray(row.context_before) ? row.context_before : [],
    context_after: Array.isArray(row.context_after) ? row.context_after : [],
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
