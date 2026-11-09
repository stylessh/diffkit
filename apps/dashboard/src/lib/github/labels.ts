import { createServerFn } from "@tanstack/react-start";
import type {
	CreateLabelInput,
	GitHubLabel,
	SetLabelsInput,
} from "../github.types";
import {
	type LabelDraft,
	labelRequestBody,
	validateLabelDraft,
} from "../settings/labels";
import type { SettingsOutcome } from "../settings/read-result";
import { fetchPaginatedGitHubResource } from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import { runSettingsMutation } from "./settings-server";
import type { GitHubClient } from "./shared";
import { identityValidator } from "./validators";

export type RepoLabelsInput = {
	owner: string;
	repo: string;
};

export const getRepoLabels = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoLabelsInput>)
	.handler(async ({ data }): Promise<GitHubLabel[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return fetchPaginatedGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["issues"]["listLabelsForRepo"]>
			>["data"][number],
			GitHubLabel[]
		>({
			context,
			resource: "repos.labels",
			params: data,
			request: (page) =>
				context.octokit.rest.issues.listLabelsForRepo({
					owner: data.owner,
					repo: data.repo,
					page,
					per_page: 100,
				}),
			mapData: (allLabels) =>
				allLabels.map((l) => ({
					name: l.name,
					color: l.color ?? "000000",
					description: l.description ?? null,
				})),
		}).catch(() => []);
	});

export const setIssueLabels = createServerFn({ method: "POST" })
	.validator(identityValidator<SetLabelsInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.issues.setLabels({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				labels: data.labels,
			});
			return true;
		} catch {
			return false;
		}
	});

export const createRepoLabel = createServerFn({ method: "POST" })
	.validator(identityValidator<CreateLabelInput>)
	.handler(async ({ data }): Promise<GitHubLabel | null> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			const response = await context.octokit.rest.issues.createLabel({
				owner: data.owner,
				repo: data.repo,
				name: data.name,
				color: data.color,
			});
			return {
				name: response.data.name,
				color: response.data.color ?? "000000",
				description: response.data.description ?? null,
			};
		} catch {
			return null;
		}
	});

export type SaveRepoLabelInput = RepoLabelsInput & {
	currentName: string | null;
	draft: LabelDraft;
};

export const saveRepoLabel = createServerFn({ method: "POST" })
	.validator(identityValidator<SaveRepoLabelInput>)
	.handler(({ data }): Promise<SettingsOutcome> => {
		const problem = validateLabelDraft(data.draft, []);
		if (problem) return Promise.resolve({ ok: false, error: problem });
		const { owner, repo, currentName } = data;
		const body = labelRequestBody(data.draft);
		return runSettingsMutation("save the label", (octokit) =>
			currentName === null
				? octokit.rest.issues.createLabel({ owner, repo, ...body })
				: octokit.rest.issues.updateLabel({
						owner,
						repo,
						name: currentName,
						new_name: body.name,
						color: body.color,
						description: body.description,
					}),
		);
	});

export const deleteRepoLabel = createServerFn({ method: "POST" })
	.validator(identityValidator<RepoLabelsInput & { name: string }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("delete the label", (octokit) =>
				octokit.rest.issues.deleteLabel(data),
			),
	);
