import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { parse as parseYaml } from "yaml";
import type {
	WorkflowDefinition,
	WorkflowDefinitionJob,
	WorkflowJobLogs,
	WorkflowRun,
	WorkflowRunArtifact,
	WorkflowRunJob,
	WorkflowRunLogsBundle,
	WorkflowRunStep,
} from "../github.types";
import {
	fetchGitHubResource,
	fetchPaginatedGitHubResource,
	withGitHubOperationTimeout,
} from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import { mapActor } from "./mappers";
import {
	getRepositoryPermissions,
	mergeRepositoryPermissions,
} from "./permissions";
import { dedupeGitHubRead } from "./request-dedup";
import {
	clampPage,
	clampPerPage,
	GITHUB_OPERATION_TIMEOUT_MS,
	type GitHubClient,
	type MutationResult,
	toMutationError,
} from "./shared";
import { identityValidator } from "./validators";

export type WorkflowRunInput = {
	owner: string;
	repo: string;
	runId: number;
};

export type WorkflowRunListStatus =
	| "completed"
	| "action_required"
	| "cancelled"
	| "failure"
	| "neutral"
	| "skipped"
	| "stale"
	| "success"
	| "timed_out"
	| "in_progress"
	| "queued"
	| "requested"
	| "waiting"
	| "pending";

export type WorkflowRunsFromRepoInput = {
	owner: string;
	repo: string;
	page?: number;
	perPage?: number;
	status?: WorkflowRunListStatus;
	event?: string;
	branch?: string;
	actor?: string;
	workflowId?: number;
};

type WorkflowRunRaw = Awaited<
	ReturnType<GitHubClient["rest"]["actions"]["getWorkflowRun"]>
>["data"];
type WorkflowRunJobRaw = Awaited<
	ReturnType<GitHubClient["rest"]["actions"]["listJobsForWorkflowRun"]>
>["data"]["jobs"][number];
type WorkflowRunStepRaw = NonNullable<WorkflowRunJobRaw["steps"]>[number];
type WorkflowRunArtifactRaw = Awaited<
	ReturnType<GitHubClient["rest"]["actions"]["listWorkflowRunArtifacts"]>
>["data"]["artifacts"][number];

function mapWorkflowRunStep(raw: WorkflowRunStepRaw): WorkflowRunStep {
	return {
		number: raw.number,
		name: raw.name,
		status: raw.status,
		conclusion: raw.conclusion ?? null,
		startedAt: raw.started_at ?? null,
		completedAt: raw.completed_at ?? null,
	};
}

function mapWorkflowRunJob(raw: WorkflowRunJobRaw): WorkflowRunJob {
	return {
		id: raw.id,
		runId: raw.run_id,
		name: raw.name,
		status: raw.status,
		conclusion: raw.conclusion ?? null,
		startedAt: raw.started_at ?? null,
		completedAt: raw.completed_at ?? null,
		htmlUrl: raw.html_url ?? null,
		labels: raw.labels ?? [],
		runnerName: raw.runner_name ?? null,
		steps: (raw.steps ?? []).map(mapWorkflowRunStep),
	};
}

function mapWorkflowRunArtifact(
	raw: WorkflowRunArtifactRaw,
): WorkflowRunArtifact {
	return {
		id: raw.id,
		name: raw.name,
		sizeInBytes: raw.size_in_bytes,
		expired: raw.expired,
		createdAt: raw.created_at ?? null,
		expiresAt: raw.expires_at ?? null,
		archiveDownloadUrl: raw.archive_download_url,
		digest: raw.digest ?? null,
	};
}

function mapWorkflowRun(
	raw: WorkflowRunRaw,
	options: { viewerCanRerun: boolean },
): WorkflowRun {
	return {
		id: raw.id,
		name: raw.name ?? null,
		displayTitle: raw.display_title ?? raw.name ?? `Run #${raw.run_number}`,
		status: raw.status ?? "queued",
		conclusion: raw.conclusion ?? null,
		event: raw.event,
		headBranch: raw.head_branch ?? null,
		headSha: raw.head_sha,
		runNumber: raw.run_number,
		runAttempt: raw.run_attempt ?? 1,
		runStartedAt: raw.run_started_at ?? null,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		htmlUrl: raw.html_url,
		path: raw.path,
		workflowId: raw.workflow_id,
		actor: mapActor(raw.actor),
		triggeringActor: mapActor(raw.triggering_actor),
		pullRequests: (raw.pull_requests ?? []).map((pr) => ({
			number: pr.number,
			headRef: pr.head?.ref ?? "",
			baseRef: pr.base?.ref ?? "",
		})),
		viewerCanRerun: options.viewerCanRerun,
	};
}

export const getWorkflowRunsForRepo = createServerFn({ method: "GET" })
	.validator(identityValidator<WorkflowRunsFromRepoInput>)
	.handler(async ({ data }): Promise<WorkflowRun[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		const params = {
			owner: data.owner,
			repo: data.repo,
			page: clampPage(data.page),
			perPage: clampPerPage(data.perPage),
			status: data.status,
			event: data.event,
			branch: data.branch,
			actor: data.actor,
			workflowId: data.workflowId,
		};

		return fetchGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["actions"]["listWorkflowRunsForRepo"]>
			>["data"],
			WorkflowRun[]
		>({
			context,
			resource: "actions.runs.repo",
			params,
			request: () =>
				context.octokit.rest.actions.listWorkflowRunsForRepo({
					owner: data.owner,
					repo: data.repo,
					page: params.page,
					per_page: params.perPage,
					status: data.status,
					event: data.event,
					branch: data.branch,
					actor: data.actor,
					workflow_id: data.workflowId,
				}),
			mapData: (payload) =>
				payload.workflow_runs.map((raw) =>
					mapWorkflowRun(raw as unknown as WorkflowRunRaw, {
						viewerCanRerun: false,
					}),
				),
		});
	});

export const getWorkflowRun = createServerFn({ method: "GET" })
	.validator(identityValidator<WorkflowRunInput>)
	.handler(async ({ data }): Promise<WorkflowRun | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		const userContext = await getGitHubUserContextForRepository(data);
		const [run, userPerms, appPerms] = await Promise.all([
			fetchGitHubResource<WorkflowRunRaw, WorkflowRun | null>({
				context,
				resource: "actions.run",
				params: {
					owner: data.owner,
					repo: data.repo,
					runId: data.runId,
				},
				request: () =>
					context.octokit.rest.actions.getWorkflowRun({
						owner: data.owner,
						repo: data.repo,
						run_id: data.runId,
					}),
				mapData: (payload) =>
					mapWorkflowRun(payload, { viewerCanRerun: false }),
			}).catch((error: unknown) => {
				if (error instanceof RequestError && error.status === 404) {
					return null;
				}
				throw error;
			}),
			getRepositoryPermissions(userContext, data.owner, data.repo),
			getRepositoryPermissions(context, data.owner, data.repo),
		]);

		if (!run) return null;

		const permissions = mergeRepositoryPermissions(userPerms, appPerms);
		const viewerCanRerun =
			permissions?.push === true || permissions?.admin === true;
		return { ...run, viewerCanRerun };
	});

export const listWorkflowRunJobs = createServerFn({ method: "GET" })
	.validator(identityValidator<WorkflowRunInput>)
	.handler(async ({ data }): Promise<WorkflowRunJob[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		try {
			return await fetchPaginatedGitHubResource<
				WorkflowRunJobRaw,
				WorkflowRunJob[]
			>({
				context,
				resource: "actions.run.jobs",
				params: {
					owner: data.owner,
					repo: data.repo,
					runId: data.runId,
				},
				request: async (page) => {
					const response =
						await context.octokit.rest.actions.listJobsForWorkflowRun({
							owner: data.owner,
							repo: data.repo,
							run_id: data.runId,
							page,
							per_page: 100,
						});
					return {
						...response,
						data: response.data.jobs ?? [],
					};
				},
				mapData: (items) => items.map(mapWorkflowRunJob),
			});
		} catch (error) {
			console.error("[listWorkflowRunJobs]", error);
			return [];
		}
	});

export const listWorkflowRunArtifacts = createServerFn({ method: "GET" })
	.validator(identityValidator<WorkflowRunInput>)
	.handler(async ({ data }): Promise<WorkflowRunArtifact[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		try {
			return await fetchPaginatedGitHubResource<
				WorkflowRunArtifactRaw,
				WorkflowRunArtifact[]
			>({
				context,
				resource: "actions.run.artifacts",
				params: {
					owner: data.owner,
					repo: data.repo,
					runId: data.runId,
				},
				request: async (page) => {
					const response =
						await context.octokit.rest.actions.listWorkflowRunArtifacts({
							owner: data.owner,
							repo: data.repo,
							run_id: data.runId,
							page,
							per_page: 100,
						});
					return {
						...response,
						data: response.data.artifacts ?? [],
					};
				},
				mapData: (items) => items.map(mapWorkflowRunArtifact),
			});
		} catch (error) {
			console.error("[listWorkflowRunArtifacts]", error);
			return [];
		}
	});

export const rerunWorkflowRun = createServerFn({ method: "POST" })
	.validator(identityValidator<WorkflowRunInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.actions.reRunWorkflow({
				owner: data.owner,
				repo: data.repo,
				run_id: data.runId,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("rerun workflow run", error);
		}
	});

export const rerunFailedWorkflowJobs = createServerFn({ method: "POST" })
	.validator(identityValidator<WorkflowRunInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.actions.reRunWorkflowFailedJobs({
				owner: data.owner,
				repo: data.repo,
				run_id: data.runId,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("rerun failed workflow jobs", error);
		}
	});

export type WorkflowDefinitionInput = {
	owner: string;
	repo: string;
	path: string;
	ref: string;
};

function parseWorkflowDefinition(yamlText: string): WorkflowDefinition | null {
	let parsed: unknown;
	try {
		parsed = parseYaml(yamlText);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") return null;
	const jobsRaw = (parsed as { jobs?: unknown }).jobs;
	if (!jobsRaw || typeof jobsRaw !== "object") return null;

	const jobs: WorkflowDefinitionJob[] = [];
	for (const [key, value] of Object.entries(
		jobsRaw as Record<string, unknown>,
	)) {
		if (!value || typeof value !== "object") continue;
		const v = value as {
			needs?: string | string[];
			name?: unknown;
			strategy?: { matrix?: unknown };
		};
		const needs = Array.isArray(v.needs)
			? v.needs.filter((n): n is string => typeof n === "string")
			: typeof v.needs === "string"
				? [v.needs]
				: [];
		const nameTemplate = typeof v.name === "string" ? v.name : null;
		const isMatrix =
			!!v.strategy && typeof v.strategy === "object" && "matrix" in v.strategy;
		jobs.push({ key, needs, nameTemplate, isMatrix });
	}
	return { jobs };
}

export const getWorkflowDefinition = createServerFn({ method: "GET" })
	.validator(identityValidator<WorkflowDefinitionInput>)
	.handler(async ({ data }): Promise<WorkflowDefinition | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		try {
			const response = await context.octokit.rest.repos.getContent({
				owner: data.owner,
				repo: data.repo,
				path: data.path,
				ref: data.ref,
			});
			const payload = response.data;
			if (
				!payload ||
				Array.isArray(payload) ||
				payload.type !== "file" ||
				typeof payload.content !== "string"
			) {
				return null;
			}
			const encoding = payload.encoding ?? "base64";
			const yamlText =
				encoding === "base64"
					? Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString(
							"utf-8",
						)
					: payload.content;
			return parseWorkflowDefinition(yamlText);
		} catch (error) {
			if (error instanceof RequestError && error.status === 404) {
				return null;
			}
			console.error("[getWorkflowDefinition]", error);
			return null;
		}
	});

export type WorkflowJobLogsInput = {
	owner: string;
	repo: string;
	jobId: number;
};

function decodeLogsPayload(data: unknown): string {
	if (typeof data === "string") return data;
	if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
	if (ArrayBuffer.isView(data))
		return new TextDecoder().decode(data as ArrayBufferView);
	return "";
}

export const getWorkflowJobLogs = createServerFn({ method: "GET" })
	.validator(identityValidator<WorkflowJobLogsInput>)
	.handler(async ({ data }): Promise<WorkflowJobLogs | null> => {
		const repoInput = { owner: data.owner, repo: data.repo };
		const tag = `[getWorkflowJobLogs ${data.owner}/${data.repo}#${data.jobId}]`;

		const [appContext, userContext] = await Promise.all([
			getGitHubContextForRepository(repoInput),
			getGitHubUserContextForRepository(repoInput),
		]);

		const seen = new Set<unknown>();
		const contexts = [
			{ label: "app", ctx: appContext },
			{ label: "user", ctx: userContext },
		].filter(
			(
				entry,
			): entry is { label: string; ctx: NonNullable<typeof entry.ctx> } => {
				if (!entry.ctx) return false;
				if (seen.has(entry.ctx.octokit)) return false;
				seen.add(entry.ctx.octokit);
				return true;
			},
		);

		console.log(`${tag} contexts`, {
			appContext: !!appContext,
			userContext: !!userContext,
			tiers: contexts.map((c) => c.label),
		});

		if (contexts.length === 0) {
			console.warn(`${tag} no usable context`);
			return null;
		}

		let lastError: unknown = null;
		for (const { label, ctx } of contexts) {
			try {
				console.log(`${tag} attempting`, label);
				const response = await withGitHubOperationTimeout(
					`${tag} ${label}`,
					GITHUB_OPERATION_TIMEOUT_MS,
					() =>
						ctx.octokit.request(
							"GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
							{
								owner: data.owner,
								repo: data.repo,
								job_id: data.jobId,
							},
						),
				);
				const logs = decodeLogsPayload(response.data);
				const dataKind =
					typeof response.data === "string"
						? "string"
						: response.data instanceof ArrayBuffer
							? "ArrayBuffer"
							: ArrayBuffer.isView(response.data)
								? "ArrayBufferView"
								: typeof response.data;
				console.log(`${tag} ok via ${label}`, {
					status: response.status,
					dataKind,
					bytes: logs.length,
				});
				return {
					logs,
					fetchedAt: new Date().toISOString(),
					notAvailable: false,
				};
			} catch (error) {
				lastError = error;
				const status = error instanceof RequestError ? error.status : undefined;
				console.warn(`${tag} ${label} failed`, {
					status,
					message: error instanceof Error ? error.message : String(error),
				});
				if (status === 404 || status === 410) {
					return {
						logs: "",
						fetchedAt: new Date().toISOString(),
						notAvailable: true,
					};
				}
				if (status === 401 || status === 403) {
					continue;
				}
				console.error(`${tag} unexpected error`, error);
				return null;
			}
		}
		console.error(`${tag} all auth tiers failed`, lastError);
		return null;
	});

export type WorkflowRunLogsBundleInput = {
	owner: string;
	repo: string;
	runId: number;
	attempt?: number;
};

const JOB_NAME_MAX_LENGTH = 90;

/** Mirrors the gh CLI's `getJobNameForLogFilename`: strip path-illegal chars
 *  and truncate to 90 UTF-16 code units (matches the C# server's `string.Length`,
 *  which is also UTF-16 code units; JS strings index by the same units). */
function sanitizeJobNameForZip(name: string): string {
	const stripped = name.replace(/[/:]/g, "");
	const truncated =
		stripped.length > JOB_NAME_MAX_LENGTH
			? stripped.slice(0, JOB_NAME_MAX_LENGTH)
			: stripped;
	return truncated.trim();
}

const STEP_FILE_RE = /^(.+?)\/(\d+)_.*\.txt$/;
const JOB_FILE_RE = /^(-?\d+)_(.+)\.txt$/;

function decodeZipEntry(bytes: Uint8Array): string {
	return new TextDecoder("utf-8").decode(bytes);
}

async function unzipBundle(
	bytes: Uint8Array,
): Promise<Record<string, Uint8Array>> {
	const { unzip } = await import("fflate");
	return new Promise((resolve, reject) => {
		unzip(
			bytes,
			{
				filter: (file) => file.name.endsWith(".txt"),
			},
			(err, result) => {
				if (err) reject(err);
				else resolve(result);
			},
		);
	});
}

function getOrCreateJobEntry(
	jobs: WorkflowRunLogsBundle["jobs"],
	jobName: string,
): WorkflowRunLogsBundle["jobs"][string] {
	const existing = jobs[jobName];
	if (existing) return existing;
	const entry = { jobName, jobLog: null, steps: {} };
	jobs[jobName] = entry;
	return entry;
}

async function parseLogsZip(
	bytes: Uint8Array,
): Promise<WorkflowRunLogsBundle["jobs"]> {
	const files = await unzipBundle(bytes);
	const jobs: WorkflowRunLogsBundle["jobs"] = {};
	for (const path in files) {
		const data = files[path];
		if (!data) continue;
		const stepMatch = path.match(STEP_FILE_RE);
		if (stepMatch) {
			const jobName = stepMatch[1] ?? "";
			const stepNumber = Number(stepMatch[2]);
			if (!Number.isFinite(stepNumber)) continue;
			const entry = getOrCreateJobEntry(jobs, jobName);
			entry.steps[stepNumber] = decodeZipEntry(data);
			continue;
		}
		const jobMatch = path.match(JOB_FILE_RE);
		if (jobMatch) {
			const jobName = jobMatch[2] ?? "";
			const entry = getOrCreateJobEntry(jobs, jobName);
			entry.jobLog = decodeZipEntry(data);
		}
	}
	return jobs;
}

async function fetchWorkflowRunLogsBundle(
	data: WorkflowRunLogsBundleInput,
): Promise<WorkflowRunLogsBundle | null> {
	const repoInput = { owner: data.owner, repo: data.repo };
	const tag = `[getWorkflowRunLogsBundle ${data.owner}/${data.repo}#${data.runId}${data.attempt ? `@${data.attempt}` : ""}]`;

	const [appContext, userContext] = await Promise.all([
		getGitHubContextForRepository(repoInput),
		getGitHubUserContextForRepository(repoInput),
	]);

	const seen = new Set<unknown>();
	const contexts = [
		{ label: "app", ctx: appContext },
		{ label: "user", ctx: userContext },
	].filter(
		(entry): entry is { label: string; ctx: NonNullable<typeof entry.ctx> } => {
			if (!entry.ctx) return false;
			if (seen.has(entry.ctx.octokit)) return false;
			seen.add(entry.ctx.octokit);
			return true;
		},
	);

	if (contexts.length === 0) {
		console.warn(`${tag} no usable context`);
		return null;
	}

	let lastError: unknown = null;
	for (const { label, ctx } of contexts) {
		try {
			const attempt = data.attempt;
			const response = await withGitHubOperationTimeout(
				`${tag} ${label}`,
				GITHUB_OPERATION_TIMEOUT_MS,
				() =>
					attempt
						? ctx.octokit.request(
								"GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs",
								{
									owner: data.owner,
									repo: data.repo,
									run_id: data.runId,
									attempt_number: attempt,
									request: { parseSuccessResponseBody: false },
								},
							)
						: ctx.octokit.request(
								"GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs",
								{
									owner: data.owner,
									repo: data.repo,
									run_id: data.runId,
									request: { parseSuccessResponseBody: false },
								},
							),
			);
			const body = response.data as unknown;
			const buffer =
				body instanceof ArrayBuffer
					? body
					: ArrayBuffer.isView(body)
						? (body as ArrayBufferView).buffer.slice(
								(body as ArrayBufferView).byteOffset,
								(body as ArrayBufferView).byteOffset +
									(body as ArrayBufferView).byteLength,
							)
						: body && typeof (body as Response).arrayBuffer === "function"
							? await (body as Response).arrayBuffer()
							: null;
			if (!buffer) {
				console.error(`${tag} unsupported response shape`, typeof body);
				return null;
			}
			const bytes = new Uint8Array(buffer);
			const jobs = await parseLogsZip(bytes);
			console.log(`${tag} ok via ${label}`, {
				status: response.status,
				bytes: bytes.byteLength,
				jobs: Object.keys(jobs).length,
			});
			return {
				jobs,
				fetchedAt: new Date().toISOString(),
				notAvailable: false,
			};
		} catch (error) {
			lastError = error;
			const status = error instanceof RequestError ? error.status : undefined;
			console.warn(`${tag} ${label} failed`, {
				status,
				message: error instanceof Error ? error.message : String(error),
			});
			if (status === 404 || status === 410) {
				return {
					jobs: {},
					fetchedAt: new Date().toISOString(),
					notAvailable: true,
				};
			}
			if (status === 401 || status === 403) continue;
			console.error(`${tag} unexpected error`, error);
			return null;
		}
	}
	console.error(`${tag} all auth tiers failed`, lastError);
	return null;
}

export const getWorkflowRunLogsBundle = createServerFn({ method: "GET" })
	.validator(identityValidator<WorkflowRunLogsBundleInput>)
	.handler(async ({ data }): Promise<WorkflowRunLogsBundle | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return fetchWorkflowRunLogsBundle(data);
		}

		return dedupeGitHubRead<WorkflowRunLogsBundle | null>({
			userId: context.session.user.id,
			resource: "actions.run.logsBundle",
			params: {
				owner: data.owner,
				repo: data.repo,
				runId: data.runId,
				attempt: data.attempt ?? null,
			},
			fetcher: () => fetchWorkflowRunLogsBundle(data),
		});
	});

export function workflowZipJobName(jobName: string): string {
	return sanitizeJobNameForZip(jobName);
}
