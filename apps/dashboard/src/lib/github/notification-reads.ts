import { debug } from "../debug";
import type {
	NotificationItem,
	NotificationParticipant,
	NotificationsResult,
} from "../github.types";
import { isRepoVisibleWithInstallationAccess } from "../github-access";
import { getInstallationAccessIndex } from "./installations";
import { dedupeGitHubRead } from "./request-dedup";
import type { GitHubClient, GitHubContext } from "./shared";

export type GetNotificationsInput = {
	all?: boolean;
	participating?: boolean;
};

type RawNotification = Awaited<
	ReturnType<
		GitHubClient["rest"]["activity"]["listNotificationsForAuthenticatedUser"]
	>
>["data"][number];

type Participant = { login: string; avatar_url: string };

type SubjectPayload = {
	user?: Participant;
	assignees?: Participant[];
	requested_reviewers?: Participant[];
	state?: string;
	merged?: boolean;
};

type SubjectEnrichment = {
	participants: NotificationParticipant[];
	state: NotificationItem["subjectState"];
};

const NO_ENRICHMENT: SubjectEnrichment = { participants: [], state: null };

function subjectState(subject: SubjectPayload): SubjectEnrichment["state"] {
	if (!subject.state) return null;
	if (subject.merged) return "merged";
	return subject.state === "closed" ? "closed" : "open";
}

function authorsOf(payload: unknown): Participant[] {
	if (!Array.isArray(payload)) return [];
	return (payload as Array<{ user?: Participant }>).flatMap((entry) =>
		entry.user ? [entry.user] : [],
	);
}

/** Best effort: a subject we cannot read keeps the notification, unenriched. */
async function enrichSubject(
	context: GitHubContext,
	notification: RawNotification,
): Promise<SubjectEnrichment> {
	const subjectUrl = notification.subject.url;
	const isPull = notification.subject.type === "PullRequest";
	if (!subjectUrl || !(isPull || notification.subject.type === "Issue")) {
		return NO_ENRICHMENT;
	}

	const readList = (url: string) =>
		context.octokit
			.request("GET {url}", { url, per_page: 100 })
			.then((response) => authorsOf(response.data))
			.catch((): Participant[] => []);

	try {
		const [subjectResponse, commenters, reviewers] = await Promise.all([
			context.octokit.request("GET {url}", { url: subjectUrl }),
			readList(`${subjectUrl}/comments`),
			isPull ? readList(`${subjectUrl}/reviews`) : [],
		]);
		const subject = subjectResponse.data as SubjectPayload;

		const byLogin = new Map<string, NotificationParticipant>();
		for (const person of [
			...(subject.user ? [subject.user] : []),
			...(subject.assignees ?? []),
			...(subject.requested_reviewers ?? []),
			...commenters,
			...reviewers,
		]) {
			if (!byLogin.has(person.login)) {
				byLogin.set(person.login, {
					login: person.login,
					avatarUrl: person.avatar_url,
				});
			}
		}
		return {
			participants: [...byLogin.values()],
			state: subjectState(subject),
		};
	} catch {
		return NO_ENRICHMENT;
	}
}

function mapNotification(
	notification: RawNotification,
	enrichment: SubjectEnrichment,
): NotificationItem {
	const { repository, subject } = notification;
	return {
		id: notification.id,
		unread: notification.unread,
		reason: notification.reason as NotificationItem["reason"],
		subject: {
			title: subject.title,
			url: subject.url ?? null,
			latestCommentUrl: subject.latest_comment_url ?? null,
			type: subject.type as NotificationItem["subject"]["type"],
		},
		repository: {
			id: repository.id,
			name: repository.name,
			fullName: repository.full_name,
			owner: {
				login: repository.owner.login,
				avatarUrl: repository.owner.avatar_url,
				url: repository.owner.html_url ?? repository.owner.url,
				type: repository.owner.type ?? "User",
			},
			private: repository.private,
		},
		participants: enrichment.participants,
		subjectState: enrichment.state,
		updatedAt: notification.updated_at,
		lastReadAt: notification.last_read_at ?? null,
		url: notification.url,
	};
}

/**
 * Notifications are filtered to repositories the app can see before their
 * subjects are read: each one costs up to three GitHub calls.
 */
export async function listVisibleNotifications(
	context: GitHubContext,
	data: GetNotificationsInput,
): Promise<NotificationsResult> {
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

			const visible = response.data.filter((notification) =>
				isRepoVisibleWithInstallationAccess(
					accessIndex,
					notification.repository.owner.login,
					notification.repository.name,
					notification.repository.private,
				),
			);
			if (visible.length < response.data.length) {
				debug("installation-access", "getNotifications filtered", {
					total: response.data.length,
					kept: visible.length,
				});
			}

			const enrichments = await Promise.all(
				visible.map((notification) => enrichSubject(context, notification)),
			);
			return {
				notifications: visible.map((notification, index) =>
					mapNotification(notification, enrichments[index]),
				),
			};
		},
	});
}
