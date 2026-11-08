/**
 * Post-processes emulate's JSON responses with data it does not track:
 * reaction counts and multi-line ranges on review comments.
 */
import type { ShimContext } from "../server.ts";
import type { ReactionRow } from "../store-extras.ts";
import { stores } from "./common.ts";

const REST_REACTION_KEYS: Record<string, string> = {
	THUMBS_UP: "+1",
	THUMBS_DOWN: "-1",
	LAUGH: "laugh",
	HOORAY: "hooray",
	CONFUSED: "confused",
	HEART: "heart",
	ROCKET: "rocket",
	EYES: "eyes",
};

const ENRICHED_PATH =
	/^\/repos\/[^/]+\/[^/]+\/(issues|pulls)(\/|$)|^\/repos\/[^/]+\/[^/]+\/comments/u;

/** Decodes emulate's `base64("0:<Type><id>")` node ids. */
export function decodeNodeId(nodeId: string) {
	try {
		const decoded = Buffer.from(nodeId, "base64").toString("utf8");
		const match = decoded.match(/^0:([A-Za-z]+?)(\d+)$/u);
		if (!match) {
			return null;
		}
		return { type: match[1], id: Number(match[2]) };
	} catch {
		return null;
	}
}

export function encodeNodeId(type: string, id: number) {
	return Buffer.from(`0:${type}${id}`).toString("base64").replace(/=+$/u, "");
}

export function reactionSubjectFromNodeId(nodeId: string) {
	const decoded = decodeNodeId(nodeId);
	if (!decoded) {
		return null;
	}
	switch (decoded.type) {
		case "Issue":
			return { subject_type: "issue" as const, subject_id: decoded.id };
		case "IssueComment":
			return { subject_type: "issue_comment" as const, subject_id: decoded.id };
		case "PullRequestReviewComment":
			return {
				subject_type: "review_comment" as const,
				subject_id: decoded.id,
			};
		default:
			return null;
	}
}

export function reactionsFor(
	context: ShimContext,
	subject: { subject_type: ReactionRow["subject_type"]; subject_id: number },
) {
	const { extras } = stores(context);
	return extras.reactions
		.findBy("subject_id", subject.subject_id)
		.filter((row) => row.subject_type === subject.subject_type)
		.sort((a, b) => a.id - b.id);
}

function enrichItem(context: ShimContext, item: Record<string, unknown>) {
	const nodeId = typeof item.node_id === "string" ? item.node_id : null;
	if (!nodeId) {
		return;
	}
	const subject = reactionSubjectFromNodeId(nodeId);
	if (
		subject &&
		item.reactions &&
		typeof item.reactions === "object" &&
		!Array.isArray(item.reactions)
	) {
		const counts = item.reactions as Record<string, unknown>;
		const rows = reactionsFor(context, subject);
		for (const key of Object.values(REST_REACTION_KEYS)) {
			counts[key] = 0;
		}
		for (const row of rows) {
			const key = REST_REACTION_KEYS[row.content];
			if (key) {
				counts[key] = (counts[key] as number) + 1;
			}
		}
		counts.total_count = rows.length;
	}
	if (subject?.subject_type === "review_comment") {
		const { extras } = stores(context);
		const range = extras.commentRanges.findOneBy(
			"comment_id",
			subject.subject_id,
		);
		item.start_line = range?.start_line ?? null;
		item.start_side = range?.start_line ? range.start_side : null;
		item.original_line ??= item.line ?? null;
		item.original_start_line = range?.start_line ?? null;
	}
}

export async function enrichResponse(
	context: ShimContext,
	request: Request,
	fetch: (request: Request) => Promise<Response>,
) {
	const response = await fetch(request);
	const pathname = new URL(request.url).pathname;
	if (
		!ENRICHED_PATH.test(pathname) ||
		!response.headers.get("content-type")?.includes("application/json")
	) {
		return response;
	}
	let body: unknown;
	try {
		body = await response.clone().json();
	} catch {
		return response;
	}
	const items = Array.isArray(body) ? body : [body];
	for (const item of items) {
		if (item && typeof item === "object") {
			enrichItem(context, item as Record<string, unknown>);
		}
	}
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	return new Response(JSON.stringify(body), {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
