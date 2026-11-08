/**
 * emulate's `/search/code` ignores the `text-match` media type; GitHub then
 * adds `text_matches` fragments around each hit, which DiffKit renders.
 */
import type { ShimContext } from "../server.ts";
import { stores } from "./common.ts";

type CodeSearchItem = {
	path: string;
	sha: string;
	repository?: { id?: number };
	text_matches?: unknown[];
};

const FRAGMENTS_PER_FILE = 2;

function searchText(query: string) {
	return query
		.split(/\s+/u)
		.filter((token) => token && !token.includes(":"))
		.join(" ")
		.replace(/^"|"$/gu, "");
}

export function textMatches(content: string, text: string) {
	if (!text) return [];
	const lines = content.split("\n");
	const needle = text.toLowerCase();
	const matches = [];
	for (let line = 0; line < lines.length; line++) {
		if (matches.length === FRAGMENTS_PER_FILE) break;
		const column = lines[line].toLowerCase().indexOf(needle);
		if (column === -1) continue;
		const before = line > 0 ? `${lines[line - 1]}\n` : "";
		const fragment = `${before}${lines[line]}${line + 1 < lines.length ? `\n${lines[line + 1]}` : ""}`;
		const start = before.length + column;
		matches.push({
			object_type: "FileContent",
			property: "content",
			fragment,
			matches: [
				{
					text: fragment.slice(start, start + needle.length),
					indices: [start, start + needle.length],
				},
			],
		});
	}
	return matches;
}

type RouteHandler = (c: unknown, next: () => Promise<void>) => unknown;
type RegisteredRoute = {
	method: string;
	compiled: { pattern: string };
	handlers: RouteHandler[];
};

/** emulate's own handler; its router keeps routes in registration order. */
function emulateCodeSearch(context: ShimContext, self: RouteHandler) {
	const routes = (context.app as unknown as { routes: RegisteredRoute[] })
		.routes;
	return routes.find(
		(route) =>
			route.method === "GET" &&
			route.compiled.pattern === "/search/code" &&
			!route.handlers.includes(self),
	)?.handlers[0];
}

export function registerCodeSearchTextMatches(context: ShimContext) {
	const handler: RouteHandler = async (raw) => {
		const c = raw as Parameters<Parameters<ShimContext["app"]["get"]>[1]>[0];
		const inner = emulateCodeSearch(context, handler);
		const response = inner ? await inner(raw, async () => {}) : undefined;
		if (!(response instanceof Response)) return response;
		if (!c.req.header("accept")?.includes("text-match") || !response.ok) {
			return response;
		}
		const body = (await response.clone().json()) as {
			items?: CodeSearchItem[];
		};
		const { gh } = stores(context);
		const text = searchText(c.req.query("q") ?? "");
		for (const item of body.items ?? []) {
			const blob = gh.blobs
				.all()
				.find(
					(row) =>
						row.sha === item.sha &&
						(item.repository?.id === undefined ||
							row.repo_id === item.repository.id),
				);
			if (!blob) continue;
			const content =
				blob.encoding === "base64"
					? Buffer.from(blob.content, "base64").toString("utf8")
					: blob.content;
			item.text_matches = textMatches(content, text);
		}
		return new Response(JSON.stringify(body), {
			status: response.status,
			headers: response.headers,
		});
	};
	context.app.get("/search/code", handler as never);
}
