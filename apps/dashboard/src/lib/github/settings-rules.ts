import { createServerFn } from "@tanstack/react-start";
import type { SettingsRead } from "../settings/read-result";
import {
	type BranchProtection,
	mapBranchProtection,
	mapRuleset,
	type RepoRuleset,
} from "../settings/rules";
import { readSettings } from "./settings-server";
import { identityValidator } from "./validators";

type RepoInput = { owner: string; repo: string };

const DETAIL_LIMIT = 20;

export const getRepoRulesets = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput>)
	.handler(
		({ data }): Promise<SettingsRead<RepoRuleset[]>> =>
			readSettings("rulesets", async (octokit) => {
				const summaries = await octokit.paginate(
					octokit.rest.repos.getRepoRulesets,
					{ ...data, per_page: 100, includes_parents: true },
				);
				return Promise.all(
					summaries.slice(0, DETAIL_LIMIT).map(async (summary) => {
						const detail = await octokit.rest.repos
							.getRepoRuleset({ ...data, ruleset_id: summary.id })
							.then((response) => response.data)
							.catch(() => null);
						return mapRuleset(summary, detail);
					}),
				);
			}),
	);

export const getRepoBranchProtections = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput>)
	.handler(
		({ data }): Promise<SettingsRead<BranchProtection[]>> =>
			readSettings("branch protections", async (octokit) => {
				const branches = await octokit.rest.repos.listBranches({
					...data,
					protected: true,
					per_page: DETAIL_LIMIT,
				});
				return Promise.all(
					branches.data.map(async (branch) => {
						const protection = await octokit.rest.repos
							.getBranchProtection({ ...data, branch: branch.name })
							.then((response) => response.data)
							.catch(() => null);
						return protection
							? mapBranchProtection(branch.name, protection)
							: { branch: branch.name, rules: null };
					}),
				);
			}),
	);
