import { createServerFn } from "@tanstack/react-start";
import { debug } from "../debug";
import type {
	NotificationItem,
	NotificationParticipant,
	NotificationsResult,
} from "../github.types";
import { isRepoVisibleWithInstallationAccess } from "../github-access";
import { getGitHubContext } from "./client";
import { getInstallationAccessIndex } from "./installations";
import { dedupeGitHubRead } from "./request-dedup";
import { identityValidator } from "./validators";

type GetNotificationsInput = {
	all?: boolean;
	participating?: boolean;
};

export const getNotifications = createServerFn({ method: "GET" })
	.validator(identityValidator<GetNotificationsInput>)
	.handler(async ({ data }): Promise<NotificationsResult> => {
		const context = await getGitHubContext();
		if (!context) {
			return { notifications: [] };
		}
		return dedupeGitHubRead<NotificationsResult>({
			userId: context.session.user.id,
			resource: "notifications.list.v1",
			params: data,
			fetcher: async () => {
				const [response, accessIndex] = await Promise.all([
					context.octokit.rest.activity.listNotificationsForAuthenticatedUser({
						all: data.all ?? false,
						participating: data.participating ?? false,
						per_page: 50,
					}),
					getInstallationAccessIndex(context),
				]);

				const participantMap = new Map<string, NotificationParticipant[]>();
				const stateMap = new Map<string, "open" | "closed" | "merged">();
				const fetchable = response.data.filter(
					(n) =>
						n.subject.url &&
						(n.subject.type === "PullRequest" || n.subject.type === "Issue"),
				);

				await Promise.allSettled(
					fetchable.map(async (n) => {
						try {
							const seen = new Set<string>();
							const participants: NotificationParticipant[] = [];
							const add = (login: string, avatarUrl: string) => {
								if (seen.has(login)) return;
								seen.add(login);
								participants.push({ login, avatarUrl });
							};

							const subjectUrl = n.subject.url;
							if (!subjectUrl) {
								return;
							}
							const commentsUrl = `${subjectUrl}/comments`;
							const isPR = n.subject.type === "PullRequest";
							const reviewsUrl = isPR ? `${subjectUrl}/reviews` : null;

							const [subjectRes, commentsRes, reviewsRes] = await Promise.all([
								context.octokit.request("GET {url}", { url: subjectUrl }),
								context.octokit
									.request("GET {url}", { url: commentsUrl, per_page: 100 })
									.catch(() => null),
								reviewsUrl
									? context.octokit
											.request("GET {url}", {
												url: reviewsUrl,
												per_page: 100,
											})
											.catch(() => null)
									: null,
							]);

							const subjectData = subjectRes.data as {
								user?: { login: string; avatar_url: string };
								assignees?: Array<{ login: string; avatar_url: string }>;
								requested_reviewers?: Array<{
									login: string;
									avatar_url: string;
								}>;
								state?: string;
								merged?: boolean;
							};

							if (subjectData.state) {
								const state = subjectData.merged
									? "merged"
									: subjectData.state === "closed"
										? "closed"
										: "open";
								stateMap.set(n.id, state);
							}

							if (subjectData.user) {
								add(subjectData.user.login, subjectData.user.avatar_url);
							}
							for (const assignee of subjectData.assignees ?? []) {
								add(assignee.login, assignee.avatar_url);
							}
							for (const reviewer of subjectData.requested_reviewers ?? []) {
								add(reviewer.login, reviewer.avatar_url);
							}

							if (commentsRes?.data && Array.isArray(commentsRes.data)) {
								for (const comment of commentsRes.data as Array<{
									user?: { login: string; avatar_url: string };
								}>) {
									if (comment.user) {
										add(comment.user.login, comment.user.avatar_url);
									}
								}
							}

							if (reviewsRes?.data && Array.isArray(reviewsRes.data)) {
								for (const review of reviewsRes.data as Array<{
									user?: { login: string; avatar_url: string };
								}>) {
									if (review.user) {
										add(review.user.login, review.user.avatar_url);
									}
								}
							}

							participantMap.set(n.id, participants);
						} catch {
							// Participant enrichment is best-effort.
						}
					}),
				);

				const notifications: NotificationItem[] = response.data.map((n) => ({
					id: n.id,
					unread: n.unread,
					reason: n.reason as NotificationItem["reason"],
					subject: {
						title: n.subject.title,
						url: n.subject.url ?? null,
						latestCommentUrl: n.subject.latest_comment_url ?? null,
						type: n.subject.type as NotificationItem["subject"]["type"],
					},
					repository: {
						id: n.repository.id,
						name: n.repository.name,
						fullName: n.repository.full_name,
						owner: {
							login: n.repository.owner.login,
							avatarUrl: n.repository.owner.avatar_url,
							url: n.repository.owner.html_url ?? n.repository.owner.url,
							type: n.repository.owner.type ?? "User",
						},
						private: n.repository.private,
					},
					participants: participantMap.get(n.id) ?? [],
					subjectState: stateMap.get(n.id) ?? null,
					updatedAt: n.updated_at,
					lastReadAt: n.last_read_at ?? null,
					url: n.url,
				}));

				const filteredNotifications = notifications.filter((notification) =>
					isRepoVisibleWithInstallationAccess(
						accessIndex,
						notification.repository.owner.login,
						notification.repository.name,
						notification.repository.private,
					),
				);

				const removedCount =
					notifications.length - filteredNotifications.length;
				if (removedCount > 0) {
					debug("installation-access", "getNotifications filtered", {
						total: notifications.length,
						kept: filteredNotifications.length,
						removed: removedCount,
						removedRepos: [
							...new Set(
								notifications
									.filter(
										(n) =>
											!isRepoVisibleWithInstallationAccess(
												accessIndex,
												n.repository.owner.login,
												n.repository.name,
												n.repository.private,
											),
									)
									.map((n) => n.repository.fullName),
							),
						],
					});
				}

				return { notifications: filteredNotifications };
			},
		});
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
