import { createServerFn } from "@tanstack/react-start";
import type { SettingsOutcome, SettingsRead } from "../settings/read-result";
import {
	mapRepoGeneralSettings,
	type RepoGeneralDraft,
	type RepoGeneralSettings,
	toApiPatch,
} from "../settings/repo-general";
import { readSettings, runSettingsMutation } from "./settings-server";
import { identityValidator } from "./validators";

type RepoInput = { owner: string; repo: string };

export const getRepoGeneralSettings = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput>)
	.handler(
		({ data }): Promise<SettingsRead<RepoGeneralSettings>> =>
			readSettings("repository settings", async (octokit) => {
				const response = await octokit.rest.repos.get(data);
				return mapRepoGeneralSettings(response.data);
			}),
	);

export const updateRepoGeneralSettings = createServerFn({ method: "POST" })
	.validator(
		identityValidator<RepoInput & { changes: Partial<RepoGeneralDraft> }>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("save repository settings", (octokit) =>
				octokit.request("PATCH /repos/{owner}/{repo}", {
					owner: data.owner,
					repo: data.repo,
					...toApiPatch(data.changes),
				}),
			),
	);

export const changeRepoVisibility = createServerFn({ method: "POST" })
	.validator(
		identityValidator<RepoInput & { visibility: "public" | "private" }>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("change visibility", (octokit) =>
				octokit.request("PATCH /repos/{owner}/{repo}", {
					owner: data.owner,
					repo: data.repo,
					visibility: data.visibility,
				}),
			),
	);

export const setRepoArchived = createServerFn({ method: "POST" })
	.validator(identityValidator<RepoInput & { archived: boolean }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation(
				data.archived ? "archive the repository" : "unarchive the repository",
				(octokit) =>
					octokit.request("PATCH /repos/{owner}/{repo}", {
						owner: data.owner,
						repo: data.repo,
						archived: data.archived,
					}),
			),
	);

export const deleteRepository = createServerFn({ method: "POST" })
	.validator(identityValidator<RepoInput & { confirmation: string }>)
	.handler(({ data }): Promise<SettingsOutcome> => {
		const expected = `${data.owner}/${data.repo}`.toLowerCase();
		if (data.confirmation.trim().toLowerCase() !== expected) {
			return Promise.resolve({
				ok: false,
				error: "The confirmation does not match the repository name.",
			});
		}
		return runSettingsMutation("delete the repository", (octokit) =>
			octokit.rest.repos.delete({ owner: data.owner, repo: data.repo }),
		);
	});
