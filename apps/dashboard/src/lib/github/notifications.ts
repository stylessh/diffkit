import { createServerFn } from "@tanstack/react-start";
import type { NotificationsResult } from "../github.types";
import { getGitHubContext } from "./client";
import {
	type GetNotificationsInput,
	listVisibleNotifications,
} from "./notification-reads";
import { identityValidator } from "./validators";

export const getNotifications = createServerFn({ method: "GET" })
	.validator(identityValidator<GetNotificationsInput>)
	.handler(async ({ data }): Promise<NotificationsResult> => {
		const context = await getGitHubContext();
		return context
			? listVisibleNotifications(context, data)
			: { notifications: [] };
	});

type MarkNotificationReadInput = { threadId: string };

export const markNotificationRead = createServerFn({ method: "POST" })
	.validator(identityValidator<MarkNotificationReadInput>)
	.handler(async ({ data }): Promise<{ ok: boolean }> => {
		const context = await getGitHubContext();
		if (!context) {
			return { ok: false };
		}

		await context.octokit.rest.activity.markThreadAsRead({
			thread_id: Number.parseInt(data.threadId, 10),
		});

		return { ok: true };
	});

export const markNotificationDone = createServerFn({ method: "POST" })
	.validator(identityValidator<MarkNotificationReadInput>)
	.handler(async ({ data }): Promise<{ ok: boolean }> => {
		const context = await getGitHubContext();
		if (!context) {
			return { ok: false };
		}

		await context.octokit.rest.activity.markThreadAsDone({
			thread_id: Number.parseInt(data.threadId, 10),
		});

		return { ok: true };
	});

export const markAllNotificationsRead = createServerFn({
	method: "POST",
}).handler(async (): Promise<{ ok: boolean }> => {
	const context = await getGitHubContext();
	if (!context) {
		return { ok: false };
	}

	await context.octokit.rest.activity.markNotificationsAsRead({
		last_read_at: new Date().toISOString(),
	});

	return { ok: true };
});

/**
 * GitHub's inbox "Unsubscribe": ignore the thread so it stops notifying, then
 * mark it done so it leaves the inbox.
 */
export const unsubscribeNotification = createServerFn({ method: "POST" })
	.validator(identityValidator<MarkNotificationReadInput>)
	.handler(async ({ data }): Promise<{ ok: boolean }> => {
		const context = await getGitHubContext();
		if (!context) {
			return { ok: false };
		}

		const threadId = Number.parseInt(data.threadId, 10);
		await context.octokit.rest.activity.setThreadSubscription({
			thread_id: threadId,
			ignored: true,
		});
		await context.octokit.rest.activity.markThreadAsDone({
			thread_id: threadId,
		});

		return { ok: true };
	});
