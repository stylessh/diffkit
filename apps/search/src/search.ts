import { searchLivegrep } from "./livegrep-client.js";
import { getRepoRuntimeStateByRef } from "./state.js";
import type {
  LivegrepSearchItem,
  LivegrepSearchResponse,
  SearchQueryParams,
} from "./types.js";

function normalizeRepoFilter(repo?: string) {
  if (!repo) {
    return undefined;
  }
  const trimmed = repo.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function normalizePathFilter(path?: string) {
  if (!path) {
    return undefined;
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function normalizeLangFilter(lang?: string) {
  if (!lang) {
    return undefined;
  }
  const trimmed = lang.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function normalizePage(page?: string) {
  if (!page) {
    return undefined;
  }
  const parsed = Number.parseInt(page, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }
  return String(parsed);
}

function isRepoAllowed(repoFilter: string) {
  const [owner, name, ...rest] = repoFilter
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!(owner && name) || rest.length > 0) {
    return false;
  }
  const repoRef = `${owner}/${name}`;
  return getRepoRuntimeStateByRef(repoRef);
}

async function remapResultRepoPath(result: LivegrepSearchItem) {
  const mapped = await getRepoRuntimeStateByRef(result.repo);
  if (!mapped) {
    return result;
  }
  return {
    ...result,
    repo: mapped.repoRef,
  };
}

export async function searchCode(
  query: SearchQueryParams
): Promise<LivegrepSearchResponse> {
  const repo = normalizeRepoFilter(query.repo);
  if (repo) {
    const allowed = await isRepoAllowed(repo);
    if (!allowed) {
      return {
        results: [],
        partial: false,
      };
    }
  }
  const response = await searchLivegrep({
    q: query.q,
    repo,
    path: normalizePathFilter(query.path),
    lang: normalizeLangFilter(query.lang),
    page: normalizePage(query.page),
  });

  return {
    results: await Promise.all(response.results.map(remapResultRepoPath)),
    partial: response.partial,
  };
}
