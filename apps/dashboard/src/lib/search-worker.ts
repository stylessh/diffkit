import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "#/db";
import { searchIndexBuilds, searchJobs, searchRepoRegistry } from "#/db/schema";
import { getAuth } from "#/lib/auth.server";
import { getGitHubClientByUserId } from "#/lib/auth-runtime";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

type SearchRepoTier = "hot" | "warm" | "cold";
type SearchRepoStatus =
	| "ready"
	| "syncing"
	| "indexing"
	| "not_indexed"
	| "failed";
type SearchJobType = "sync" | "index";
type SearchJobPriority = "interactive" | "normal" | "backfill";
type SearchJobStatus = "queued" | "running" | "done" | "failed";

export type SearchQueueMessage = {
	jobId: string;
	repoId: string;
	jobType: SearchJobType;
	priority: SearchJobPriority;
	trigger: "bootstrap" | "scheduled" | "retry" | "not_indexed";
};

type SearchRepoRegistryRow = typeof searchRepoRegistry.$inferSelect;
type SearchJobRow = typeof searchJobs.$inferSelect;

const REPO_PROVIDER = "github";
const DEFAULT_REPO_TIER: SearchRepoTier = "hot";
const REPO_SYNC_CADENCE_SECONDS: Record<SearchRepoTier, number> = {
	hot: 15 * 60,
	warm: 3 * 60 * 60,
	cold: 24 * 60 * 60,
};
const MAX_REPO_SIZE_MB = 10_000;
const MAX_REPO_SIZE_KB = MAX_REPO_SIZE_MB * 1024;
const MAX_QUEUE_RETRIES = 3;
const MANIFEST_RETENTION_DAYS = 30;

function nowSeconds() {
	return Math.floor(Date.now() / 1000);
}

function toEpochSeconds(value: Date | number | null) {
	if (typeof value === "number") {
		return value;
	}
	return value ? Math.floor(value.getTime() / 1000) : null;
}

function traceIdFromRequest(request: Request) {
	const cfRay = request.headers.get("cf-ray");
	return cfRay || crypto.randomUUID();
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
	const response = Response.json(body, { status });
	response.headers.set("X-Robots-Tag", PRIVATE_ROUTE_HEADERS["X-Robots-Tag"]);
	if (headers) {
		for (const [headerName, headerValue] of Object.entries(headers)) {
			response.headers.set(headerName, headerValue);
		}
	}
	return response;
}

async function requireSession(request: Request) {
	const session = await getAuth().api.getSession({
		headers: request.headers,
	});
	return session;
}

function parseRepoRef(repoRef: string | null) {
	if (!repoRef) {
		return null;
	}
	const [owner, name, ...rest] = repoRef
		.split("/")
		.map((segment) => segment.trim())
		.filter(Boolean);
	if (!owner || !name || rest.length > 0) {
		return null;
	}
	return { owner, name };
}

async function getRepoByOwnerName(owner: string, name: string) {
	const db = getDb();
	return db
		.select()
		.from(searchRepoRegistry)
		.where(
			and(
				eq(searchRepoRegistry.provider, REPO_PROVIDER),
				eq(searchRepoRegistry.owner, owner),
				eq(searchRepoRegistry.name, name),
			),
		)
		.get();
}

async function getRepoById(id: string) {
	const db = getDb();
	return db
		.select()
		.from(searchRepoRegistry)
		.where(eq(searchRepoRegistry.id, id))
		.get();
}

async function fetchGitHubRepoForUser({
	name,
	owner,
	userId,
}: {
	owner: string;
	name: string;
	userId: string;
}) {
	const github = await getGitHubClientByUserId(userId);
	const { data } = await github.request("GET /repos/{owner}/{repo}", {
		owner,
		repo: name,
	});
	return data;
}

async function ensurePrivateRepoAccess({
	repo,
	userId,
}: {
	repo: SearchRepoRegistryRow;
	userId: string;
}) {
	if (!repo.isPrivate) {
		return true;
	}
	try {
		await fetchGitHubRepoForUser({
			userId,
			owner: repo.owner,
			name: repo.name,
		});
		return true;
	} catch {
		return false;
	}
}

function etaBucketForTier(tier: SearchRepoTier) {
	if (tier === "hot") {
		return "<10m";
	}
	if (tier === "warm") {
		return "10-30m";
	}
	return ">30m";
}

async function createSearchJob({
	jobType,
	priority,
	repoId,
	status,
	error,
}: {
	repoId: string;
	jobType: SearchJobType;
	priority: SearchJobPriority;
	status?: SearchJobStatus;
	error?: string | null;
}) {
	const db = getDb();
	const createdAt = nowSeconds();
	const duplicateQueuedJob = await db
		.select({ id: searchJobs.id })
		.from(searchJobs)
		.where(
			and(
				eq(searchJobs.repoId, repoId),
				eq(searchJobs.jobType, jobType),
				eq(searchJobs.status, "queued"),
			),
		)
		.get();
	if (duplicateQueuedJob) {
		return duplicateQueuedJob.id;
	}
	const jobId = crypto.randomUUID();
	await db.insert(searchJobs).values({
		id: jobId,
		repoId,
		jobType,
		priority,
		status: status ?? "queued",
		attempt: 0,
		error: error ?? null,
		createdAt: new Date(createdAt * 1000),
		updatedAt: new Date(createdAt * 1000),
	});
	return jobId;
}

async function enqueueSearchJob({
	jobType,
	priority,
	repoId,
	trigger,
	env,
}: {
	repoId: string;
	jobType: SearchJobType;
	priority: SearchJobPriority;
	trigger: SearchQueueMessage["trigger"];
	env: Cloudflare.Env;
}) {
	const jobId = await createSearchJob({
		repoId,
		jobType,
		priority,
	});
	const payload: SearchQueueMessage = {
		jobId,
		repoId,
		jobType,
		priority,
		trigger,
	};

	if (jobType === "sync" && env.REPO_SYNC_QUEUE) {
		await env.REPO_SYNC_QUEUE.send(payload);
		return jobId;
	}
	if (jobType === "index" && env.INDEX_BUILD_QUEUE) {
		await env.INDEX_BUILD_QUEUE.send(payload);
		return jobId;
	}

	// If queues are not configured yet, keep durable metadata by marking as failed.
	const db = getDb();
	await db
		.update(searchJobs)
		.set({
			status: "failed",
			error: "Queue binding missing",
			attempt: 1,
			updatedAt: new Date(nowSeconds() * 1000),
		})
		.where(eq(searchJobs.id, jobId));

	return jobId;
}

async function upsertRepoFromGitHub({
	name,
	owner,
	userId,
}: {
	owner: string;
	name: string;
	userId: string;
}) {
	const githubRepo = await fetchGitHubRepoForUser({
		owner,
		name,
		userId,
	});
	if ((githubRepo.size ?? 0) > MAX_REPO_SIZE_KB) {
		throw new Error(
			`Repository exceeds max size ${MAX_REPO_SIZE_MB}MB for MVP onboarding.`,
		);
	}

	const db = getDb();
	const existing = await getRepoByOwnerName(owner, name);
	const now = nowSeconds();
	const values = {
		provider: "github" as const,
		owner,
		name,
		defaultBranch: githubRepo.default_branch || "main",
		isEnabled: true,
		tier: DEFAULT_REPO_TIER,
		status: "not_indexed" as const,
		isPrivate: Boolean(githubRepo.private),
		lastError: null,
		updatedAt: new Date(now * 1000),
	};

	if (existing) {
		await db
			.update(searchRepoRegistry)
			.set(values)
			.where(eq(searchRepoRegistry.id, existing.id));
		return {
			repoId: existing.id,
			isPrivate: Boolean(githubRepo.private),
			defaultBranch: values.defaultBranch,
		};
	}

	const repoId = crypto.randomUUID();
	await db.insert(searchRepoRegistry).values({
		id: repoId,
		...values,
		createdAt: new Date(now * 1000),
		lastIndexedAt: null,
		lastIndexedHeadSha: null,
		lastSeenHeadSha: null,
		lastSyncedAt: null,
	});

	return {
		repoId,
		isPrivate: Boolean(githubRepo.private),
		defaultBranch: values.defaultBranch,
	};
}

async function ensureRepoBootstrapJobs({
	env,
	repoId,
	priority,
	trigger,
}: {
	env: Cloudflare.Env;
	repoId: string;
	priority: SearchJobPriority;
	trigger: SearchQueueMessage["trigger"];
}) {
	await enqueueSearchJob({
		env,
		repoId,
		jobType: "sync",
		priority,
		trigger,
	});
	await enqueueSearchJob({
		env,
		repoId,
		jobType: "index",
		priority,
		trigger,
	});
}

function parseSearchResultItem(item: unknown) {
	if (!item || typeof item !== "object") {
		return null;
	}
	const row = item as Record<string, unknown>;
	const repo =
		typeof row.repo === "string"
			? row.repo
			: typeof row.tree === "string"
				? row.tree
				: null;
	const path = typeof row.path === "string" ? row.path : null;
	const line = typeof row.line === "string" ? row.line : "";
	const lineNumberRaw = row.line_number ?? row.lno;
	const lineNumber =
		typeof lineNumberRaw === "number"
			? lineNumberRaw
			: typeof lineNumberRaw === "string"
				? Number.parseInt(lineNumberRaw, 10)
				: Number.NaN;

	if (
		!repo ||
		!path ||
		!Number.isFinite(lineNumber) ||
		(lineNumber as number) <= 0
	) {
		return null;
	}

	return {
		repo,
		path,
		line_number: lineNumber,
		line,
		context_before: Array.isArray(row.context_before)
			? row.context_before.filter(
					(entry): entry is string => typeof entry === "string",
				)
			: [],
		context_after: Array.isArray(row.context_after)
			? row.context_after.filter(
					(entry): entry is string => typeof entry === "string",
				)
			: [],
	};
}

function normalizeLivegrepResults(payload: unknown) {
	if (!payload || typeof payload !== "object") {
		return {
			results: [] as Array<ReturnType<typeof parseSearchResultItem>>,
			partial: true,
		};
	}
	const record = payload as Record<string, unknown>;
	const source = Array.isArray(record.results)
		? record.results
		: Array.isArray(record.data)
			? record.data
			: [];
	const results = source
		.map(parseSearchResultItem)
		.filter(
			(item): item is NonNullable<ReturnType<typeof parseSearchResultItem>> =>
				Boolean(item),
		);
	const partial = Boolean(record.partial);
	return {
		results,
		partial,
	};
}

async function queryLivegrep({
	env,
	q,
	repo,
	path,
	lang,
	page,
	traceId,
}: {
	env: Cloudflare.Env;
	q: string;
	repo?: string | null;
	path?: string | null;
	lang?: string | null;
	page?: string | null;
	traceId: string;
}) {
	if (!env.LIVEGREP_BASE_URL) {
		throw new Error("LIVEGREP_BASE_URL is not configured");
	}
	const endpoint = new URL("/api/v1/search", env.LIVEGREP_BASE_URL);
	endpoint.searchParams.set("q", q);
	if (repo) endpoint.searchParams.set("repo", repo);
	if (path) endpoint.searchParams.set("path", path);
	if (lang) endpoint.searchParams.set("lang", lang);
	if (page) endpoint.searchParams.set("page", page);

	const response = await fetch(endpoint, {
		method: "GET",
		headers: {
			Accept: "application/json",
			...(env.LIVEGREP_API_TOKEN
				? { Authorization: `Bearer ${env.LIVEGREP_API_TOKEN}` }
				: {}),
			"X-Trace-Id": traceId,
		},
		signal: AbortSignal.timeout(7_500),
	});

	if (!response.ok) {
		throw new Error(`Livegrep search failed with status ${response.status}`);
	}

	return normalizeLivegrepResults(await response.json());
}

function toRepoStatusPayload(repo: SearchRepoRegistryRow) {
	return {
		status:
			repo.status === "not_indexed" ? "NOT_INDEXED" : repo.status.toUpperCase(),
		last_indexed_head_sha: repo.lastIndexedHeadSha,
		last_seen_head_sha: repo.lastSeenHeadSha,
		last_synced_at: toEpochSeconds(repo.lastSyncedAt),
		last_indexed_at: toEpochSeconds(repo.lastIndexedAt),
		tier: repo.tier,
		eta_bucket:
			repo.status === "not_indexed" ? etaBucketForTier(repo.tier) : undefined,
	};
}

async function handleSearchGet({
	env,
	request,
}: {
	request: Request;
	env: Cloudflare.Env;
}) {
	const session = await requireSession(request);
	if (!session) {
		return json({ error: "Unauthorized" }, 401);
	}

	const traceId = traceIdFromRequest(request);
	const url = new URL(request.url);
	const q = url.searchParams.get("q")?.trim() ?? "";
	if (!q) {
		return json(
			{ error: "Missing required query param q", trace_id: traceId },
			400,
		);
	}

	const repoParam = url.searchParams.get("repo");
	const path = url.searchParams.get("path");
	const lang = url.searchParams.get("lang");
	const page = url.searchParams.get("page");

	const repoStatus: Record<string, ReturnType<typeof toRepoStatusPayload>> = {};
	let repoFilterForLivegrep: string | null = null;

	if (repoParam) {
		const parsedRepo = parseRepoRef(repoParam);
		if (!parsedRepo) {
			return json(
				{ error: "repo must be formatted as owner/name", trace_id: traceId },
				400,
			);
		}

		let repo = await getRepoByOwnerName(parsedRepo.owner, parsedRepo.name);
		if (!repo) {
			try {
				const created = await upsertRepoFromGitHub({
					owner: parsedRepo.owner,
					name: parsedRepo.name,
					userId: session.user.id,
				});
				await ensureRepoBootstrapJobs({
					env,
					repoId: created.repoId,
					priority: "interactive",
					trigger: "not_indexed",
				});
				repo = await getRepoById(created.repoId);
			} catch (error) {
				return json(
					{
						error:
							error instanceof Error
								? error.message
								: "Unable to register repository for search",
						trace_id: traceId,
					},
					403,
				);
			}
		}

		if (!repo) {
			return json(
				{ error: "Repository could not be resolved", trace_id: traceId },
				404,
			);
		}

		if (!(await ensurePrivateRepoAccess({ repo, userId: session.user.id }))) {
			return json(
				{ error: "Forbidden for private repository", trace_id: traceId },
				403,
			);
		}

		repoStatus[`${repo.owner}/${repo.name}`] = toRepoStatusPayload(repo);
		repoFilterForLivegrep = `${repo.owner}/${repo.name}`;

		if (repo.status === "not_indexed") {
			await ensureRepoBootstrapJobs({
				env,
				repoId: repo.id,
				priority: "interactive",
				trigger: "not_indexed",
			});
			return json({
				results: [],
				repo_status: repoStatus,
				partial: false,
				trace_id: traceId,
			});
		}
	}

	const normalized = await queryLivegrep({
		env,
		q,
		repo: repoFilterForLivegrep,
		path,
		lang,
		page,
		traceId,
	});

	return json({
		results: normalized.results,
		repo_status: repoStatus,
		partial: normalized.partial,
		trace_id: traceId,
	});
}

async function handleRepoOnboarding({
	env,
	request,
}: {
	request: Request;
	env: Cloudflare.Env;
}) {
	const session = await requireSession(request);
	if (!session) {
		return json({ error: "Unauthorized" }, 401);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: "Invalid JSON body" }, 400);
	}

	if (!payload || typeof payload !== "object") {
		return json({ error: "Invalid payload" }, 400);
	}
	const { provider, owner, name } = payload as Record<string, unknown>;
	if (provider !== REPO_PROVIDER) {
		return json({ error: "Unsupported provider" }, 400);
	}
	if (
		typeof owner !== "string" ||
		owner.trim().length === 0 ||
		typeof name !== "string" ||
		name.trim().length === 0
	) {
		return json({ error: "owner and name are required" }, 400);
	}

	try {
		const repo = await upsertRepoFromGitHub({
			owner: owner.trim(),
			name: name.trim(),
			userId: session.user.id,
		});
		await ensureRepoBootstrapJobs({
			env,
			repoId: repo.repoId,
			priority: "interactive",
			trigger: "bootstrap",
		});
		const saved = await getRepoById(repo.repoId);
		return json(
			{
				repo: saved
					? {
							id: saved.id,
							provider: saved.provider,
							owner: saved.owner,
							name: saved.name,
							default_branch: saved.defaultBranch,
							status: saved.status,
							tier: saved.tier,
							is_private: saved.isPrivate,
						}
					: null,
				job_priority: "interactive",
			},
			202,
		);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to onboard repository";
		return json({ error: message }, 400);
	}
}

async function getLatestFailedJob(repoId: string) {
	const db = getDb();
	return db
		.select()
		.from(searchJobs)
		.where(and(eq(searchJobs.repoId, repoId), eq(searchJobs.status, "failed")))
		.orderBy(desc(searchJobs.updatedAt))
		.get();
}

async function handleRepoStatus({
	request,
	repoId,
}: {
	request: Request;
	repoId: string;
}) {
	const session = await requireSession(request);
	if (!session) {
		return json({ error: "Unauthorized" }, 401);
	}

	const repo = await getRepoById(repoId);
	if (!repo) {
		return json({ error: "Repository not found" }, 404);
	}

	if (!(await ensurePrivateRepoAccess({ repo, userId: session.user.id }))) {
		return json({ error: "Forbidden for private repository" }, 403);
	}

	const now = nowSeconds();
	const lastIndexedAt = toEpochSeconds(repo.lastIndexedAt);
	const latestFailedJob = await getLatestFailedJob(repo.id);

	return json({
		repo_id: repo.id,
		provider: repo.provider,
		owner: repo.owner,
		name: repo.name,
		status: repo.status,
		last_indexed_commit: repo.lastIndexedHeadSha,
		staleness_seconds: lastIndexedAt ? Math.max(0, now - lastIndexedAt) : null,
		latest_error: latestFailedJob?.error ?? repo.lastError ?? null,
		last_synced_at: toEpochSeconds(repo.lastSyncedAt),
		last_indexed_at: lastIndexedAt,
		tier: repo.tier,
	});
}

async function fetchSearchControl({
	env,
	path,
	body,
	traceId,
}: {
	env: Cloudflare.Env;
	path: string;
	body: Record<string, unknown>;
	traceId: string;
}) {
	const baseUrl = env.SEARCH_CONTROL_BASE_URL || env.LIVEGREP_BASE_URL;
	if (!baseUrl) {
		throw new Error("SEARCH_CONTROL_BASE_URL is not configured");
	}

	const response = await fetch(new URL(path, baseUrl), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			...(env.SEARCH_CONTROL_TOKEN
				? { Authorization: `Bearer ${env.SEARCH_CONTROL_TOKEN}` }
				: {}),
			"X-Trace-Id": traceId,
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(20_000),
	});

	if (!response.ok) {
		throw new Error(`Search control call failed with ${response.status}`);
	}

	try {
		return (await response.json()) as Record<string, unknown>;
	} catch {
		return {};
	}
}

async function setJobStatus({
	jobId,
	status,
	error,
	attempt,
}: {
	jobId: string;
	status: SearchJobStatus;
	error?: string | null;
	attempt?: number;
}) {
	const db = getDb();
	await db
		.update(searchJobs)
		.set({
			status,
			error: error ?? null,
			...(typeof attempt === "number" ? { attempt } : {}),
			updatedAt: new Date(nowSeconds() * 1000),
		})
		.where(eq(searchJobs.id, jobId));
}

async function setRepoStatus({
	repoId,
	status,
	lastError,
	lastSeenHeadSha,
	lastIndexedHeadSha,
	lastSyncedAt,
	lastIndexedAt,
}: {
	repoId: string;
	status: SearchRepoStatus;
	lastError?: string | null;
	lastSeenHeadSha?: string | null;
	lastIndexedHeadSha?: string | null;
	lastSyncedAt?: number | null;
	lastIndexedAt?: number | null;
}) {
	const db = getDb();
	await db
		.update(searchRepoRegistry)
		.set({
			status,
			...(lastError !== undefined ? { lastError } : {}),
			...(lastSeenHeadSha !== undefined ? { lastSeenHeadSha } : {}),
			...(lastIndexedHeadSha !== undefined ? { lastIndexedHeadSha } : {}),
			...(lastSyncedAt !== undefined
				? {
						lastSyncedAt:
							lastSyncedAt === null ? null : new Date(lastSyncedAt * 1000),
					}
				: {}),
			...(lastIndexedAt !== undefined
				? {
						lastIndexedAt:
							lastIndexedAt === null ? null : new Date(lastIndexedAt * 1000),
					}
				: {}),
			updatedAt: new Date(nowSeconds() * 1000),
		})
		.where(eq(searchRepoRegistry.id, repoId));
}

async function runSyncJob({
	env,
	job,
	message,
}: {
	env: Cloudflare.Env;
	job: SearchJobRow;
	message: SearchQueueMessage;
}) {
	await setJobStatus({
		jobId: job.id,
		status: "running",
		attempt: job.attempt + 1,
	});
	await setRepoStatus({
		repoId: job.repoId,
		status: "syncing",
		lastError: null,
	});

	const traceId = crypto.randomUUID();
	const repo = await getRepoById(job.repoId);
	if (!repo) {
		throw new Error("Repository not found for sync job");
	}

	const payload = await fetchSearchControl({
		env,
		path: "/internal/repos/sync",
		body: {
			repo_id: repo.id,
			provider: repo.provider,
			owner: repo.owner,
			name: repo.name,
			default_branch: repo.defaultBranch,
			trigger: message.trigger,
		},
		traceId,
	});

	const syncedAt = nowSeconds();
	const headSha =
		typeof payload.head_sha === "string"
			? payload.head_sha
			: repo.lastSeenHeadSha;

	await setRepoStatus({
		repoId: repo.id,
		status: repo.lastIndexedHeadSha === headSha ? "ready" : "not_indexed",
		lastSeenHeadSha: headSha,
		lastSyncedAt: syncedAt,
		lastError: null,
	});
	await setJobStatus({ jobId: job.id, status: "done", error: null });

	if (repo.lastIndexedHeadSha !== headSha) {
		await enqueueSearchJob({
			env,
			repoId: repo.id,
			jobType: "index",
			priority: "normal",
			trigger: "scheduled",
		});
	}
}

async function runIndexJob({
	env,
	job,
	message,
}: {
	env: Cloudflare.Env;
	job: SearchJobRow;
	message: SearchQueueMessage;
}) {
	await setJobStatus({
		jobId: job.id,
		status: "running",
		attempt: job.attempt + 1,
	});
	await setRepoStatus({
		repoId: job.repoId,
		status: "indexing",
		lastError: null,
	});

	const traceId = crypto.randomUUID();
	const repo = await getRepoById(job.repoId);
	if (!repo) {
		throw new Error("Repository not found for index job");
	}

	const buildId = crypto.randomUUID();
	const startAt = nowSeconds();
	const db = getDb();
	const buildVersion = `${startAt}-${repo.id}`;
	await db.insert(searchIndexBuilds).values({
		id: buildId,
		buildVersion,
		repoCount: 1,
		startedAt: new Date(startAt * 1000),
		finishedAt: null,
		status: "running",
		manifestR2Key: null,
	});

	const payload = await fetchSearchControl({
		env,
		path: "/internal/index/build",
		body: {
			repo_id: repo.id,
			owner: repo.owner,
			name: repo.name,
			default_branch: repo.defaultBranch,
			head_sha: repo.lastSeenHeadSha,
			trigger: message.trigger,
		},
		traceId,
	});

	const finishedAt = nowSeconds();
	const indexedHeadSha =
		typeof payload.head_sha === "string"
			? payload.head_sha
			: repo.lastSeenHeadSha;
	const manifestR2Key =
		typeof payload.manifest_r2_key === "string"
			? payload.manifest_r2_key
			: null;

	await db
		.update(searchIndexBuilds)
		.set({
			status: "done",
			finishedAt: new Date(finishedAt * 1000),
			manifestR2Key,
		})
		.where(eq(searchIndexBuilds.id, buildId));

	await setRepoStatus({
		repoId: repo.id,
		status: "ready",
		lastIndexedHeadSha: indexedHeadSha,
		lastIndexedAt: finishedAt,
		lastError: null,
	});
	await setJobStatus({ jobId: job.id, status: "done", error: null });
}

async function markQueueFailure({
	error,
	job,
	message,
}: {
	job: SearchJobRow;
	message: Message<SearchQueueMessage>;
	error: unknown;
}) {
	const errorMessage =
		error instanceof Error ? error.message : "Unknown search queue failure";
	const attempt = Math.max(job.attempt + 1, message.attempts);
	await setJobStatus({
		jobId: job.id,
		status: "failed",
		error: errorMessage,
		attempt,
	});
	await setRepoStatus({
		repoId: job.repoId,
		status: "failed",
		lastError: errorMessage,
	});
}

async function processQueueMessage({
	env,
	message,
}: {
	env: Cloudflare.Env;
	message: Message<SearchQueueMessage>;
}) {
	const body = message.body;
	if (!body || typeof body !== "object") {
		message.ack();
		return;
	}

	const db = getDb();
	const job = await db
		.select()
		.from(searchJobs)
		.where(eq(searchJobs.id, body.jobId))
		.get();
	if (!job) {
		message.ack();
		return;
	}

	try {
		if (body.jobType === "sync") {
			await runSyncJob({ env, job, message: body });
		} else if (body.jobType === "index") {
			await runIndexJob({ env, job, message: body });
		} else {
			throw new Error("Unsupported search queue job type");
		}
		message.ack();
	} catch (error) {
		await markQueueFailure({ error, job, message });
		if (message.attempts < MAX_QUEUE_RETRIES) {
			message.retry({
				delaySeconds: Math.min(2 ** message.attempts * 15, 300),
			});
			return;
		}
		message.ack();
	}
}

async function scheduleRepoSyncJobs({ env }: { env: Cloudflare.Env }) {
	const db = getDb();
	const currentTime = nowSeconds();
	const hotCutoff = new Date(
		(currentTime - REPO_SYNC_CADENCE_SECONDS.hot) * 1000,
	);
	const warmCutoff = new Date(
		(currentTime - REPO_SYNC_CADENCE_SECONDS.warm) * 1000,
	);
	const coldCutoff = new Date(
		(currentTime - REPO_SYNC_CADENCE_SECONDS.cold) * 1000,
	);

	const dueRepos = await db
		.select()
		.from(searchRepoRegistry)
		.where(
			and(
				eq(searchRepoRegistry.isEnabled, true),
				or(
					and(
						eq(searchRepoRegistry.tier, "hot"),
						or(
							isNull(searchRepoRegistry.lastSyncedAt),
							lte(searchRepoRegistry.lastSyncedAt, hotCutoff),
						),
					),
					and(
						eq(searchRepoRegistry.tier, "warm"),
						or(
							isNull(searchRepoRegistry.lastSyncedAt),
							lte(searchRepoRegistry.lastSyncedAt, warmCutoff),
						),
					),
					and(
						eq(searchRepoRegistry.tier, "cold"),
						or(
							isNull(searchRepoRegistry.lastSyncedAt),
							lte(searchRepoRegistry.lastSyncedAt, coldCutoff),
						),
					),
				),
			),
		)
		.limit(200);

	for (const repo of dueRepos) {
		await enqueueSearchJob({
			env,
			repoId: repo.id,
			jobType: "sync",
			priority: "normal",
			trigger: "scheduled",
		});
	}
}

async function cleanupSearchManifests(env: Cloudflare.Env) {
	const bucket = env.SEARCH_INDEX_ARTIFACTS;
	if (!bucket) {
		return;
	}

	const cutoff = Date.now() - MANIFEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;
	let cursor: string | undefined;
	do {
		const listed = await bucket.list({
			cursor,
			limit: 500,
			prefix: "search/manifests/",
		});
		for (const object of listed.objects) {
			if (object.uploaded.getTime() < cutoff) {
				await bucket.delete(object.key);
			}
		}
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
}

export async function maybeHandleSearchRequest({
	request,
	env,
}: {
	request: Request;
	env: Cloudflare.Env;
}) {
	const url = new URL(request.url);
	if (!url.pathname.startsWith("/api/search")) {
		return null;
	}

	if (request.method === "GET" && url.pathname === "/api/search") {
		return handleSearchGet({ request, env });
	}
	if (request.method === "POST" && url.pathname === "/api/search/repos") {
		return handleRepoOnboarding({ request, env });
	}

	const statusMatch = /^\/api\/search\/repos\/([^/]+)\/status$/.exec(
		url.pathname,
	);
	if (request.method === "GET" && statusMatch) {
		return handleRepoStatus({ request, repoId: statusMatch[1] });
	}

	return json({ error: "Not found" }, 404);
}

export async function handleSearchQueue({
	batch,
	env,
	ctx: _ctx,
}: {
	batch: MessageBatch<SearchQueueMessage>;
	env: Cloudflare.Env;
	ctx: ExecutionContext;
}) {
	void _ctx;
	for (const message of batch.messages) {
		await processQueueMessage({ env, message });
	}
}

export async function handleSearchScheduled({
	env,
	ctx: _ctx,
}: {
	env: Cloudflare.Env;
	ctx: ExecutionContext;
}) {
	void _ctx;
	await scheduleRepoSyncJobs({ env });
	await cleanupSearchManifests(env);
}
