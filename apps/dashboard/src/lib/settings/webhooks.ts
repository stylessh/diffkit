export type WebhookContentType = "json" | "form";

export type WebhookHealth =
	| { kind: "unused" }
	| { kind: "ok"; code: number }
	| { kind: "failing"; code: number | null; message: string | null };

export type RepoWebhook = {
	id: number;
	url: string;
	contentType: WebhookContentType;
	hasSecret: boolean;
	insecureSsl: boolean;
	events: string[];
	active: boolean;
	updatedAt: string | null;
	health: WebhookHealth;
};

export type RawWebhook = {
	id: number;
	active: boolean;
	events: string[];
	updated_at?: string | null;
	config: {
		url?: string;
		content_type?: string;
		secret?: string;
		insecure_ssl?: string | number | null;
	};
	last_response?: {
		code?: number | null;
		status?: string | null;
		message?: string | null;
	} | null;
};

function mapHealth(response: RawWebhook["last_response"]): WebhookHealth {
	const code = response?.code ?? null;
	if (code === null || response?.status === "unused") return { kind: "unused" };
	if (code >= 200 && code < 300) return { kind: "ok", code };
	return { kind: "failing", code, message: response?.message ?? null };
}

export function mapWebhook(raw: RawWebhook): RepoWebhook {
	return {
		id: raw.id,
		url: raw.config.url ?? "",
		contentType: raw.config.content_type === "form" ? "form" : "json",
		hasSecret: Boolean(raw.config.secret),
		insecureSsl: String(raw.config.insecure_ssl ?? "0") === "1",
		events: raw.events,
		active: raw.active,
		updatedAt: raw.updated_at ?? null,
		health: mapHealth(raw.last_response),
	};
}

export type WebhookEventSelection =
	| { kind: "push" }
	| { kind: "all" }
	| { kind: "custom"; events: string[] };

export const WEBHOOK_EVENTS: readonly { value: string; label: string }[] = [
	{ value: "push", label: "Pushes" },
	{ value: "pull_request", label: "Pull requests" },
	{ value: "pull_request_review", label: "Pull request reviews" },
	{
		value: "pull_request_review_comment",
		label: "Pull request review comments",
	},
	{ value: "issues", label: "Issues" },
	{ value: "issue_comment", label: "Issue comments" },
	{ value: "create", label: "Branch or tag creation" },
	{ value: "delete", label: "Branch or tag deletion" },
	{ value: "release", label: "Releases" },
	{ value: "workflow_run", label: "Workflow runs" },
	{ value: "check_run", label: "Check runs" },
	{ value: "status", label: "Commit statuses" },
	{ value: "deployment_status", label: "Deployment statuses" },
	{ value: "repository", label: "Repository changes" },
	{ value: "member", label: "Collaborator changes" },
];

export function selectionFromEvents(events: string[]): WebhookEventSelection {
	if (events.includes("*")) return { kind: "all" };
	if (events.length === 1 && events[0] === "push") return { kind: "push" };
	return { kind: "custom", events };
}

export function eventsFromSelection(selection: WebhookEventSelection) {
	switch (selection.kind) {
		case "all":
			return ["*"];
		case "push":
			return ["push"];
		case "custom":
			return selection.events;
	}
}

export type WebhookDraft = {
	url: string;
	contentType: WebhookContentType;
	secret: string;
	insecureSsl: boolean;
	selection: WebhookEventSelection;
	active: boolean;
};

export function emptyWebhookDraft(): WebhookDraft {
	return {
		url: "",
		contentType: "json",
		secret: "",
		insecureSsl: false,
		selection: { kind: "push" },
		active: true,
	};
}

export function draftFromWebhook(webhook: RepoWebhook): WebhookDraft {
	return {
		url: webhook.url,
		contentType: webhook.contentType,
		secret: "",
		insecureSsl: webhook.insecureSsl,
		selection: selectionFromEvents(webhook.events),
		active: webhook.active,
	};
}

export type WebhookMode = "create" | "edit";

export function validateWebhookDraft(draft: WebhookDraft) {
	let url: URL;
	try {
		url = new URL(draft.url.trim());
	} catch {
		return "Enter the payload URL, including https://.";
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return "The payload URL must be http or https.";
	}
	if (
		draft.selection.kind === "custom" &&
		draft.selection.events.length === 0
	) {
		return "Choose at least one event.";
	}
	return null;
}

/** An empty secret is omitted so an edit keeps the secret GitHub already holds. */
export function webhookConfig(draft: WebhookDraft) {
	return {
		url: draft.url.trim(),
		content_type: draft.contentType,
		insecure_ssl: draft.insecureSsl ? "1" : "0",
		...(draft.secret === "" ? {} : { secret: draft.secret }),
	};
}

export function createWebhookBody(draft: WebhookDraft) {
	return {
		name: "web",
		active: draft.active,
		events: eventsFromSelection(draft.selection),
		config: webhookConfig(draft),
	};
}

export function updateWebhookBody(draft: WebhookDraft) {
	return {
		active: draft.active,
		events: eventsFromSelection(draft.selection),
	};
}

export type WebhookDelivery = {
	id: number;
	event: string;
	action: string | null;
	status: string;
	statusCode: number;
	deliveredAt: string;
	durationSeconds: number;
	redelivery: boolean;
};

export type RawWebhookDelivery = {
	id: number;
	event: string;
	action?: string | null;
	status: string;
	status_code: number;
	delivered_at: string;
	duration: number;
	redelivery?: boolean;
};

export function mapDelivery(raw: RawWebhookDelivery): WebhookDelivery {
	return {
		id: raw.id,
		event: raw.event,
		action: raw.action ?? null,
		status: raw.status,
		statusCode: raw.status_code,
		deliveredAt: raw.delivered_at,
		durationSeconds: raw.duration,
		redelivery: raw.redelivery ?? false,
	};
}

export function deliverySucceeded(delivery: WebhookDelivery) {
	return delivery.statusCode >= 200 && delivery.statusCode < 300;
}
