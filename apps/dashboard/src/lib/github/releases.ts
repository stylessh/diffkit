import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import type {
	GenerateReleaseNotesInput,
	GenerateReleaseNotesResult,
	RepoRelease,
	RepoReleaseInput,
	RepoReleasesInput,
	RepoReleasesPage,
	SaveRepoReleaseInput,
	SaveRepoReleaseResult,
	UpdateRepoReleaseInput,
} from "../github.types";
import { fetchGitHubResource } from "./client";
import { getGitHubUserContextForRepository } from "./installations";
import { mapActor } from "./mappers";
import {
	clampPage,
	clampPerPage,
	type GitHubClient,
	type GitHubContext,
	type MutationResult,
	toMutationError,
} from "./shared";
import { identityValidator } from "./validators";

type GitHubReleasePayload = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["getRelease"]>
>["data"];

function mapRepoRelease(
	release: GitHubReleasePayload,
	latestTagName: string | null,
): RepoRelease {
	return {
		id: release.id,
		tagName: release.tag_name,
		name: release.name?.trim() || release.tag_name,
		body: release.body ?? "",
		isDraft: release.draft,
		isPrerelease: release.prerelease,
		isLatest:
			latestTagName != null &&
			!release.draft &&
			release.tag_name === latestTagName,
		createdAt: release.created_at,
		publishedAt: release.published_at ?? null,
		author: mapActor(release.author),
		targetCommitish: release.target_commitish,
		url: release.html_url,
		tarballUrl: release.tarball_url ?? null,
		zipballUrl: release.zipball_url ?? null,
		assets: release.assets.map((asset) => ({
			id: asset.id,
			name: asset.name,
			size: asset.size,
			downloadCount: asset.download_count,
			contentType: asset.content_type,
			downloadUrl: asset.browser_download_url,
			updatedAt: asset.updated_at,
		})),
	};
}

async function getLatestReleaseTagName(
	context: GitHubContext,
	data: { owner: string; repo: string },
): Promise<string | null> {
	try {
		return await fetchGitHubResource({
			context,
			resource: "repo.latestRelease.v1",
			params: { owner: data.owner, repo: data.repo },
			request: (signal) =>
				context.octokit.rest.repos.getLatestRelease({
					owner: data.owner,
					repo: data.repo,
					request: { signal },
				}),
			mapData: (release): string | null => release.tag_name,
		});
	} catch {
		// 404 when the repo has no published release.
		return null;
	}
}

async function listRepoReleasesRaw(
	context: GitHubContext,
	data: { owner: string; repo: string; page: number; perPage: number },
) {
	return fetchGitHubResource({
		context,
		resource: "repo.releases.v1",
		params: data,
		request: (signal) =>
			context.octokit.rest.repos.listReleases({
				owner: data.owner,
				repo: data.repo,
				per_page: data.perPage,
				page: data.page,
				request: { signal },
			}),
		mapData: (releases): GitHubReleasePayload[] => releases,
	});
}

export const getRepoReleases = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoReleasesInput>)
	.handler(async ({ data }): Promise<RepoReleasesPage> => {
		// User token: draft releases are only listed to callers with push access.
		const context = await getGitHubUserContextForRepository(data);
		if (!context) return { releases: [], hasNextPage: false };

		const perPage = clampPerPage(data.perPage, 10);
		const page = clampPage(data.page);
		try {
			const [releases, latestTagName] = await Promise.all([
				listRepoReleasesRaw(context, {
					owner: data.owner,
					repo: data.repo,
					page,
					perPage,
				}),
				getLatestReleaseTagName(context, data),
			]);
			return {
				releases: releases.map((release) =>
					mapRepoRelease(release, latestTagName),
				),
				hasNextPage: releases.length === perPage,
			};
		} catch (error) {
			if (error instanceof RequestError && error.status === 404) {
				return { releases: [], hasNextPage: false };
			}
			throw error;
		}
	});

export const getRepoRelease = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoReleaseInput>)
	.handler(async ({ data }): Promise<RepoRelease | null> => {
		// User token: draft releases are only listed to callers with push access.
		const context = await getGitHubUserContextForRepository(data);
		if (!context) return null;
		const latestTagPromise = getLatestReleaseTagName(context, data);
		try {
			const release = await fetchGitHubResource({
				context,
				resource: "repo.release.v1",
				params: { owner: data.owner, repo: data.repo, tag: data.tag },
				request: (signal) =>
					context.octokit.rest.repos.getReleaseByTag({
						owner: data.owner,
						repo: data.repo,
						tag: data.tag,
						request: { signal },
					}),
				mapData: (payload): GitHubReleasePayload => payload,
			});
			return mapRepoRelease(release, await latestTagPromise);
		} catch (error) {
			if (!(error instanceof RequestError) || error.status !== 404) {
				throw error;
			}
		}

		// Drafts aren't addressable by tag — find them in the newest releases.
		try {
			const recent = await listRepoReleasesRaw(context, {
				owner: data.owner,
				repo: data.repo,
				page: 1,
				perPage: 100,
			});
			const draft = recent.find((release) => release.tag_name === data.tag);
			return draft ? mapRepoRelease(draft, await latestTagPromise) : null;
		} catch (error) {
			if (error instanceof RequestError && error.status === 404) {
				return null;
			}
			throw error;
		}
	});

function toReleaseMutationError(
	action: string,
	error: unknown,
): { ok: false; error: string; installUrl?: string } {
	if (error instanceof RequestError && error.status === 422) {
		const payload = error.response?.data as
			| {
					message?: string;
					errors?: Array<{ code?: string; field?: string; message?: string }>;
			  }
			| undefined;
		const first = payload?.errors?.[0];
		if (first?.code === "already_exists" && first.field === "tag_name") {
			return {
				ok: false,
				error: `Failed to ${action}: a release for this tag already exists`,
			};
		}
		const detail = first?.message ?? payload?.message;
		if (detail) {
			return { ok: false, error: `Failed to ${action}: ${detail}` };
		}
	}
	const result = toMutationError(action, error);
	return result.ok
		? { ok: false, error: `Failed to ${action}` }
		: { ok: false, error: result.error, installUrl: result.installUrl };
}

export const createRepoRelease = createServerFn({ method: "POST" })
	.validator(identityValidator<SaveRepoReleaseInput>)
	.handler(async ({ data }): Promise<SaveRepoReleaseResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) return { ok: false, error: "Not authenticated" };

		try {
			const response = await context.octokit.rest.repos.createRelease({
				owner: data.owner,
				repo: data.repo,
				tag_name: data.tagName,
				target_commitish: data.targetCommitish || undefined,
				name: data.name,
				body: data.body,
				draft: data.draft,
				prerelease: data.prerelease,
				...(data.makeLatest ? { make_latest: data.makeLatest } : {}),
			});
			return { ok: true, release: mapRepoRelease(response.data, null) };
		} catch (error) {
			return toReleaseMutationError("create release", error);
		}
	});

export const updateRepoRelease = createServerFn({ method: "POST" })
	.validator(identityValidator<UpdateRepoReleaseInput>)
	.handler(async ({ data }): Promise<SaveRepoReleaseResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) return { ok: false, error: "Not authenticated" };

		try {
			const response = await context.octokit.rest.repos.updateRelease({
				owner: data.owner,
				repo: data.repo,
				release_id: data.releaseId,
				tag_name: data.tagName,
				target_commitish: data.targetCommitish || undefined,
				name: data.name,
				body: data.body,
				draft: data.draft,
				prerelease: data.prerelease,
				...(data.makeLatest ? { make_latest: data.makeLatest } : {}),
			});
			return { ok: true, release: mapRepoRelease(response.data, null) };
		} catch (error) {
			return toReleaseMutationError("update release", error);
		}
	});

export const deleteRepoRelease = createServerFn({ method: "POST" })
	.validator(
		identityValidator<{ owner: string; repo: string; releaseId: number }>,
	)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) return { ok: false, error: "Not authenticated" };

		try {
			await context.octokit.rest.repos.deleteRelease({
				owner: data.owner,
				repo: data.repo,
				release_id: data.releaseId,
			});
			return { ok: true };
		} catch (error) {
			return toReleaseMutationError("delete release", error);
		}
	});

/** Asks GitHub to draft release notes. Read-only despite being a POST upstream. */
export const generateRepoReleaseNotes = createServerFn({ method: "POST" })
	.validator(identityValidator<GenerateReleaseNotesInput>)
	.handler(async ({ data }): Promise<GenerateReleaseNotesResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) return { ok: false, error: "Not authenticated" };

		try {
			const response = await context.octokit.rest.repos.generateReleaseNotes({
				owner: data.owner,
				repo: data.repo,
				tag_name: data.tagName,
				target_commitish: data.targetCommitish || undefined,
				previous_tag_name: data.previousTagName || undefined,
			});
			return { ok: true, name: response.data.name, body: response.data.body };
		} catch (error) {
			const result = toReleaseMutationError("generate release notes", error);
			return { ok: false, error: result.error };
		}
	});
