import { createServerFn } from "@tanstack/react-start";
import type { SettingsOutcome, SettingsRead } from "../settings/read-result";
import {
	createWebhookBody,
	mapDelivery,
	mapWebhook,
	type RepoWebhook,
	updateWebhookBody,
	validateWebhookDraft,
	type WebhookDelivery,
	type WebhookDraft,
	webhookConfig,
} from "../settings/webhooks";
import { readSettings, runSettingsMutation } from "./settings-server";
import { identityValidator } from "./validators";

type RepoInput = { owner: string; repo: string };

const DELIVERY_LIMIT = 30;

export const getRepoWebhooks = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput>)
	.handler(
		({ data }): Promise<SettingsRead<RepoWebhook[]>> =>
			readSettings("webhooks", async (octokit) => {
				const hooks = await octokit.paginate(octokit.rest.repos.listWebhooks, {
					...data,
					per_page: 100,
				});
				return hooks.map(mapWebhook);
			}),
	);

export const saveRepoWebhook = createServerFn({ method: "POST" })
	.validator(
		identityValidator<
			RepoInput & { hookId: number | null; draft: WebhookDraft }
		>,
	)
	.handler(({ data }): Promise<SettingsOutcome> => {
		const invalid = validateWebhookDraft(data.draft);
		if (invalid) return Promise.resolve({ ok: false, error: invalid });
		const { owner, repo, hookId, draft } = data;
		return runSettingsMutation("save the webhook", async (octokit) => {
			if (hookId === null) {
				await octokit.rest.repos.createWebhook({
					owner,
					repo,
					...createWebhookBody(draft),
				});
				return;
			}
			await octokit.rest.repos.updateWebhookConfigForRepo({
				owner,
				repo,
				hook_id: hookId,
				...webhookConfig(draft),
			});
			await octokit.rest.repos.updateWebhook({
				owner,
				repo,
				hook_id: hookId,
				...updateWebhookBody(draft),
			});
		});
	});

export const deleteRepoWebhook = createServerFn({ method: "POST" })
	.validator(identityValidator<RepoInput & { hookId: number }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("delete the webhook", (octokit) =>
				octokit.rest.repos.deleteWebhook({
					owner: data.owner,
					repo: data.repo,
					hook_id: data.hookId,
				}),
			),
	);

export const getWebhookDeliveries = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput & { hookId: number }>)
	.handler(
		({ data }): Promise<SettingsRead<WebhookDelivery[]>> =>
			readSettings("deliveries", async (octokit) => {
				const response = await octokit.rest.repos.listWebhookDeliveries({
					owner: data.owner,
					repo: data.repo,
					hook_id: data.hookId,
					per_page: DELIVERY_LIMIT,
				});
				return response.data.map(mapDelivery);
			}),
	);

export const redeliverWebhookDelivery = createServerFn({ method: "POST" })
	.validator(
		identityValidator<RepoInput & { hookId: number; deliveryId: number }>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("redeliver", (octokit) =>
				octokit.rest.repos.redeliverWebhookDelivery({
					owner: data.owner,
					repo: data.repo,
					hook_id: data.hookId,
					delivery_id: data.deliveryId,
				}),
			),
	);
