import { createServer } from "node:http";
import { getConfig } from "./config.js";
import { buildRepoIndex } from "./index-build.js";
import { syncRepository } from "./repo-sync.js";
import { searchCode } from "./search.js";
import type {
  BuildIndexRequest,
  BuildIndexResponse,
  LivegrepSearchResponse,
  SearchQueryParams,
  SearchRepoRuntimeState,
} from "./types.js";

const config = getConfig();

interface ResponsePayload {
  body: string;
  headers?: Record<string, string>;
  status: number;
}

type RequestLike = AsyncIterable<Buffer | string> & {
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  method?: string;
};

function toRequestLike(
  request: import("node:http").IncomingMessage,
  requestUrl: string
): RequestLike {
  const iterable: AsyncIterable<Buffer | string> = {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of request) {
        yield chunk as Buffer | string;
      }
    },
  };

  return {
    ...iterable,
    headers: request.headers,
    url: `http://localhost${requestUrl}`,
    method: request.method,
  };
}

function jsonResponse(status: number, payload: unknown): ResponsePayload {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
}

async function parseJsonBody(request: RequestLike): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return null;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

function isAuthorized(headers: Record<string, string | string[] | undefined>) {
  if (!config.searchControlToken) {
    return true;
  }
  const authHeader = readHeader(headers, "authorization");
  return authHeader === `Bearer ${config.searchControlToken}`;
}

function parsePath(url: string | undefined) {
  if (!url) {
    return "/";
  }
  return new URL(url, "http://localhost").pathname;
}

async function handleSearchRequest(request: RequestLike) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const q = url.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return jsonResponse(400, { error: "Missing required q query param" });
  }

  const query: SearchQueryParams = {
    q,
    repo: url.searchParams.get("repo") ?? undefined,
    path: url.searchParams.get("path") ?? undefined,
    lang: url.searchParams.get("lang") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  };
  const response: LivegrepSearchResponse = await searchCode(query);
  return jsonResponse(200, response);
}

function parseString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseDefaultBranch(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "main";
}

async function handleSyncRequest(request: RequestLike) {
  const body = (await parseJsonBody(request)) as Record<string, unknown> | null;
  if (!body) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const repoId = parseString(body.repo_id);
  const owner = parseString(body.owner);
  const name = parseString(body.name);
  const defaultBranch = parseDefaultBranch(body.default_branch);

  if (!(repoId && owner && name)) {
    return jsonResponse(400, { error: "repo_id, owner, name are required" });
  }
  const provider = parseString(body.provider) ?? "github";
  if (!config.allowedProviders.has(provider.toLowerCase())) {
    return jsonResponse(403, { error: `Provider ${provider} is not allowed` });
  }

  const githubToken =
    parseString(body.github_token) ?? process.env.GITHUB_TOKEN ?? "";
  if (!githubToken) {
    return jsonResponse(500, {
      error: "Missing github token. Set GITHUB_TOKEN or pass github_token.",
    });
  }

  const result = await syncRepository({
    repoId,
    owner,
    name,
    defaultBranch,
    githubToken,
  });
  return jsonResponse(200, result);
}

async function handleBuildIndexRequest(request: RequestLike) {
  const body = (await parseJsonBody(request)) as Record<string, unknown> | null;
  if (!body) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const repoId = parseString(body.repo_id);
  const owner = parseString(body.owner);
  const name = parseString(body.name);
  const defaultBranch = parseDefaultBranch(body.default_branch);
  const headSha = parseString(body.head_sha);

  if (!(repoId && owner && name)) {
    return jsonResponse(400, { error: "repo_id, owner, name are required" });
  }

  const buildRequest: BuildIndexRequest = {
    repo_id: repoId,
    owner,
    name,
    default_branch: defaultBranch,
    head_sha: headSha,
  };
  const repoState: SearchRepoRuntimeState = {
    repoId,
    repoRef: `${owner}/${name}`,
    owner,
    name,
    defaultBranch,
    provider: "github",
    lastHeadSha: headSha,
    lastIndexedHeadSha: null,
    lastSyncedAt: null,
    lastIndexedAt: null,
    mirrorPath: null,
  };
  const result: BuildIndexResponse = await buildRepoIndex({
    body: buildRequest,
    repoState,
  });
  return jsonResponse(200, result);
}

async function runWithServerError(
  action: () => Promise<ResponsePayload>,
  fallbackMessage: string
): Promise<ResponsePayload> {
  try {
    return await action();
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : fallbackMessage,
    });
  }
}

function handleInternalRequest(
  request: RequestLike,
  handler: (request: RequestLike) => Promise<ResponsePayload>,
  fallbackMessage: string
): Promise<ResponsePayload> {
  if (!isAuthorized(request.headers)) {
    return Promise.resolve(jsonResponse(401, { error: "Unauthorized" }));
  }
  return runWithServerError(() => handler(request), fallbackMessage);
}

function handleRequest(request: RequestLike): Promise<ResponsePayload> {
  const method = request.method ?? "GET";
  const path = parsePath(request.url);

  if (method === "GET" && path === "/healthz") {
    return Promise.resolve(
      jsonResponse(200, {
        ok: true,
        service: "diffkit-search",
        mode: config.livegrepUpstreamBaseUrl ? "proxy-livegrep" : "stub",
      })
    );
  }

  if (method === "GET" && path === "/api/v1/search") {
    return runWithServerError(
      () => handleSearchRequest(request),
      "Search failed"
    );
  }

  if (method === "POST" && path === "/internal/repos/sync") {
    return handleInternalRequest(
      request,
      handleSyncRequest,
      "Repo sync failed"
    );
  }

  if (method === "POST" && path === "/internal/index/build") {
    return handleInternalRequest(
      request,
      handleBuildIndexRequest,
      "Index build failed"
    );
  }

  return Promise.resolve(jsonResponse(404, { error: "Not found" }));
}

const server = createServer(async (req, res) => {
  const requestUrl = req.url ?? "/";
  const response = await handleRequest(toRequestLike(req, requestUrl));

  res.statusCode = response.status;
  for (const [headerName, headerValue] of Object.entries(
    response.headers ?? {}
  )) {
    res.setHeader(headerName, headerValue);
  }
  res.end(response.body);
});

server.listen(config.port, config.host, () => {
  console.log(
    `[search] listening on http://${config.host}:${config.port} (mode=${config.livegrepUpstreamBaseUrl ? "proxy-livegrep" : "stub"})`
  );
});
