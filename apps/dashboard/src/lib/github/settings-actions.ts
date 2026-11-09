import { createServerFn } from "@tanstack/react-start";
import {
	mapActionsSecret,
	mapActionsVariable,
	normalizeActionsName,
	type RepoActionsSecret,
	type RepoActionsVariable,
	validateActionsName,
	validateActionsValue,
} from "../settings/actions-config";
import type { SettingsOutcome, SettingsRead } from "../settings/read-result";
import { sealSecret } from "../settings/seal";
import { readSettings, runSettingsMutation } from "./settings-server";
import { identityValidator } from "./validators";

type RepoInput = { owner: string; repo: string };
type NamedInput = RepoInput & { name: string };
type ValueInput = NamedInput & { value: string };

const VARIABLES_PAGE_SIZE = 30;

function invalid(error: string): Promise<SettingsOutcome> {
	return Promise.resolve({ ok: false, error });
}

export const getRepoActionsSecrets = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput>)
	.handler(
		({ data }): Promise<SettingsRead<RepoActionsSecret[]>> =>
			readSettings("secrets", async (octokit) => {
				const secrets = await octokit.paginate(
					octokit.rest.actions.listRepoSecrets,
					{ ...data, per_page: 100 },
				);
				return secrets.map(mapActionsSecret);
			}),
	);

export const getRepoActionsVariables = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput>)
	.handler(
		({ data }): Promise<SettingsRead<RepoActionsVariable[]>> =>
			readSettings("variables", async (octokit) => {
				const variables = await octokit.paginate(
					octokit.rest.actions.listRepoVariables,
					{ ...data, per_page: VARIABLES_PAGE_SIZE },
				);
				return variables.map(mapActionsVariable);
			}),
	);

export const saveRepoActionsSecret = createServerFn({ method: "POST" })
	.validator(identityValidator<ValueInput>)
	.handler(({ data }): Promise<SettingsOutcome> => {
		const problem =
			validateActionsName(data.name, []) ??
			validateActionsValue(data.value, "secret");
		if (problem) return invalid(problem);
		return runSettingsMutation("save the secret", async (octokit) => {
			const { owner, repo } = data;
			const { data: key } = await octokit.rest.actions.getRepoPublicKey({
				owner,
				repo,
			});
			await octokit.rest.actions.createOrUpdateRepoSecret({
				owner,
				repo,
				secret_name: normalizeActionsName(data.name),
				encrypted_value: await sealSecret(key.key, data.value),
				key_id: key.key_id,
			});
		});
	});

export const deleteRepoActionsSecret = createServerFn({ method: "POST" })
	.validator(identityValidator<NamedInput>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("delete the secret", (octokit) =>
				octokit.rest.actions.deleteRepoSecret({
					owner: data.owner,
					repo: data.repo,
					secret_name: data.name,
				}),
			),
	);

export const saveRepoActionsVariable = createServerFn({ method: "POST" })
	.validator(identityValidator<ValueInput & { mode: "create" | "update" }>)
	.handler(({ data }): Promise<SettingsOutcome> => {
		const problem =
			validateActionsName(data.name, []) ??
			validateActionsValue(data.value, "variable");
		if (problem) return invalid(problem);
		const params = {
			owner: data.owner,
			repo: data.repo,
			name: normalizeActionsName(data.name),
			value: data.value,
		};
		return runSettingsMutation("save the variable", (octokit) =>
			data.mode === "create"
				? octokit.rest.actions.createRepoVariable(params)
				: octokit.rest.actions.updateRepoVariable(params),
		);
	});

export const deleteRepoActionsVariable = createServerFn({ method: "POST" })
	.validator(identityValidator<NamedInput>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("delete the variable", (octokit) =>
				octokit.rest.actions.deleteRepoVariable({
					owner: data.owner,
					repo: data.repo,
					name: data.name,
				}),
			),
	);
