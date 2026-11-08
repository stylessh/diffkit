/**
 * Notifications API (emulate has none). Threads are seeded at startup and kept
 * current by watching the emulator's own webhook dispatches: when someone acts
 * on an issue or pull request, every other participant gets an unread thread.
 */
import type { Store } from "@emulators/core";
import type { GitHubStore } from "@emulators/github";
import type { ShimContext } from "../server";
import { getExtrasStore, type NotificationRow } from "../store-extras";
import {
	apiRepoJson,
	getViewer,
	json,
	notFound,
	paginate,
	requiresAuth,
	type ShimRequestContext,
	stores,
} from "./common";

function subjectFor(
	gh: GitHubStore,
	row: NotificationRow,
): { title: string; apiPath: string } | null {
	const repo = gh.repos.get(row.repo_id);
	if (!repo) {
		return null;
	}
	const issue = gh.issues
		.findBy("repo_id", repo.id)
		.find((candidate) => candidate.number === row.subject_number);
	if (!issue) {
		return null;
	}
	const kind = row.subject_type === "PullRequest" ? "pulls" : "issues";
	return {
		title: issue.title,
		apiPath: `/repos/${repo.full_name}/${kind}/${issue.number}`,
	};
}

export function formatNotification(context: ShimContext, row: NotificationRow) {
	const { gh } = stores(context);
	const repo = gh.repos.get(row.repo_id);
	const subject = subjectFor(gh, row);
	if (!repo || !subject) {
		return null;
	}
	return {
		id: row.thread_id,
		unread: row.unread,
		reason: row.reason,
		updated_at: row.updated_at,
		last_read_at: row.last_read_at,
		subject: {
			title: subject.title,
			url: `${context.baseUrl}${subject.apiPath}`,
			latest_comment_url: row.latest_comment_id
				? `${context.baseUrl}/repos/${repo.full_name}/issues/comments/${row.latest_comment_id}`
				: `${context.baseUrl}${subject.apiPath}`,
			type: row.subject_type,
		},
		repository: apiRepoJson(gh, repo, context.baseUrl),
		url: `${context.baseUrl}/notifications/threads/${row.thread_id}`,
		subscription_url: `${context.baseUrl}/notifications/threads/${row.thread_id}/subscription`,
	};
}

export function upsertNotification(
	store: Store,
	input: {
		userId: number;
		repoId: number;
		subjectType: NotificationRow["subject_type"];
		subjectNumber: number;
		reason: string;
		unread?: boolean;
		latestCommentId?: number | null;
		at?: string;
	},
) {
	const extras = getExtrasStore(store);
	const existing = extras.notifications
		.findBy("user_id", input.userId)
		.find(
			(row) =>
				row.repo_id === input.repoId &&
				row.subject_number === input.subjectNumber &&
				row.subject_type === input.subjectType,
		);
	const unread = input.unread ?? true;
	let row: NotificationRow | undefined;
	if (existing) {
		row = extras.notifications.update(existing.id, {
			reason: input.reason,
			unread,
			done: false,
			latest_comment_id: input.latestCommentId ?? existing.latest_comment_id,
		});
	} else {
		const inserted = extras.notifications.insert({
			thread_id: "",
			user_id: input.userId,
			repo_id: input.repoId,
			subject_type: input.subjectType,
			subject_number: input.subjectNumber,
			reason: input.reason,
			unread,
			done: false,
			last_read_at: null,
			latest_comment_id: input.latestCommentId ?? null,
		});
		row = extras.notifications.update(inserted.id, {
			thread_id: String(9_000_000 + inserted.id),
		});
	}
	if (row && input.at) {
		row.updated_at = input.at;
		if (!existing) {
			row.created_at = input.at;
		}
		if (!unread) {
			row.last_read_at = input.at;
		}
	}
	return row;
}

type WebhookPayload = {
	action?: string;
	sender?: { login?: string };
	issue?: { number?: number; pull_request?: unknown };
	pull_request?: { number?: number };
	comment?: { id?: number; body?: string };
	review?: { body?: string | null };
	requested_reviewer?: { login?: string };
	assignee?: { login?: string };
	repository?: { full_name?: string };
};

const NOTIFYING_EVENTS = new Set([
	"issues",
	"issue_comment",
	"pull_request",
	"pull_request_review",
	"pull_request_review_comment",
]);

/** Fans an emulator webhook out to participant notification threads. */
function notifyParticipants(
	context: ShimContext,
	event: string,
	payload: WebhookPayload,
) {
	if (
		!NOTIFYING_EVENTS.has(event) ||
		context.store.getData("diffkit.seeding")
	) {
		return;
	}
	const { gh } = stores(context);
	const repo = payload.repository?.full_name
		? gh.repos.findOneBy("full_name", payload.repository.full_name)
		: undefined;
	const number = payload.pull_request?.number ?? payload.issue?.number;
	if (!repo || !number) {
		return;
	}
	const issue = gh.issues
		.findBy("repo_id", repo.id)
		.find((row) => row.number === number);
	if (!issue) {
		return;
	}
	const pull = gh.pullRequests
		.findBy("repo_id", repo.id)
		.find((row) => row.number === number);
	const actorLogin = payload.sender?.login;
	const body = payload.comment?.body ?? payload.review?.body ?? "";

	const reasons = new Map<number, string>();
	const add = (userId: number | null | undefined, reason: string) => {
		if (!userId || reasons.has(userId)) {
			return;
		}
		reasons.set(userId, reason);
	};

	for (const match of body.matchAll(/@([a-z0-9-]+)/giu)) {
		add(gh.users.findOneBy("login", match[1])?.id, "mention");
	}
	if (payload.action === "review_requested") {
		add(
			gh.users.findOneBy("login", payload.requested_reviewer?.login ?? "")?.id,
			"review_requested",
		);
	}
	if (payload.action === "assigned") {
		add(
			gh.users.findOneBy("login", payload.assignee?.login ?? "")?.id,
			"assign",
		);
	}
	add(issue.user_id, "author");
	for (const id of issue.assignee_ids) {
		add(id, "assign");
	}
	for (const id of pull?.requested_reviewer_ids ?? []) {
		add(id, "review_requested");
	}
	for (const comment of gh.comments.findBy("repo_id", repo.id)) {
		if (comment.issue_number === number || comment.pull_number === number) {
			add(comment.user_id, "comment");
		}
	}

	const actor = actorLogin ? gh.users.findOneBy("login", actorLogin) : null;
	for (const [userId, reason] of reasons) {
		if (userId === actor?.id) {
			continue;
		}
		upsertNotification(context.store, {
			userId,
			repoId: repo.id,
			subjectType: pull ? "PullRequest" : "Issue",
			subjectNumber: number,
			reason,
			latestCommentId: payload.comment?.id ?? null,
		});
	}
}

function viewerThread(
	context: ShimContext,
	c: ShimRequestContext,
): { row?: NotificationRow; error?: Response } {
	const { gh, extras } = stores(context);
	const viewer = getViewer(gh, c);
	if (!viewer) {
		return { error: requiresAuth(c) };
	}
	const threadId = c.req.param("thread_id");
	const row = extras.notifications
		.findBy("thread_id", threadId)
		.find((candidate) => candidate.user_id === viewer.id);
	if (!row) {
		return { error: notFound(c) };
	}
	return { row };
}

export function registerNotificationRoutes(context: ShimContext) {
	const { app } = context;
	const dispatch = context.webhooks.dispatch.bind(context.webhooks);
	context.webhooks.dispatch = async (event, action, payload, owner, repo) => {
		try {
			notifyParticipants(context, event, payload as WebhookPayload);
		} catch (error) {
			console.warn("[emulator] notification fan-out failed", error);
		}
		await dispatch(event, action, payload, owner, repo);
	};

	app.get("/notifications", (c) => {
		const { gh, extras } = stores(context);
		const viewer = getViewer(gh, c);
		if (!viewer) {
			return requiresAuth(c);
		}
		const all = c.req.query("all") === "true";
		const participating = c.req.query("participating") === "true";
		const rows = extras.notifications
			.findBy("user_id", viewer.id)
			.filter((row) => !row.done && (all || row.unread))
			.filter(
				(row) =>
					!participating ||
					[
						"author",
						"comment",
						"mention",
						"assign",
						"review_requested",
					].includes(row.reason),
			)
			.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
		return json(
			c,
			paginate(c, rows, 50)
				.map((row) => formatNotification(context, row))
				.filter(Boolean),
		);
	});

	app.put("/notifications", (c) => {
		const { gh, extras } = stores(context);
		const viewer = getViewer(gh, c);
		if (!viewer) {
			return requiresAuth(c);
		}
		const now = new Date().toISOString();
		for (const row of extras.notifications.findBy("user_id", viewer.id)) {
			if (row.unread) {
				extras.notifications.update(row.id, {
					unread: false,
					last_read_at: now,
				});
			}
		}
		return c.json({ message: "Marked as read" }, 205);
	});

	app.get("/notifications/threads/:thread_id", (c) => {
		const { row, error } = viewerThread(context, c);
		return row
			? json(c, formatNotification(context, row))
			: (error as Response);
	});

	app.patch("/notifications/threads/:thread_id", (c) => {
		const { extras } = stores(context);
		const { row, error } = viewerThread(context, c);
		if (!row) {
			return error as Response;
		}
		extras.notifications.update(row.id, {
			unread: false,
			last_read_at: new Date().toISOString(),
		});
		return c.body(null, 205);
	});

	app.delete("/notifications/threads/:thread_id", (c) => {
		const { extras } = stores(context);
		const { row, error } = viewerThread(context, c);
		if (!row) {
			return error as Response;
		}
		extras.notifications.update(row.id, { unread: false, done: true });
		return c.body(null, 204);
	});

	app.get("/notifications/threads/:thread_id/subscription", (c) => {
		const { row, error } = viewerThread(context, c);
		if (!row) {
			return error as Response;
		}
		return json(c, {
			subscribed: true,
			ignored: false,
			reason: row.reason,
			created_at: row.created_at,
			url: `${context.baseUrl}/notifications/threads/${row.thread_id}/subscription`,
			thread_url: `${context.baseUrl}/notifications/threads/${row.thread_id}`,
		});
	});
}
