/**
 * The emulator's authorize page always shows its account picker. GitHub skips
 * the prompt for apps you have already authorized, and DiffKit's demo sign-in
 * chains the GitHub App authorization right after the OAuth sign-in, so for
 * the GitHub App client we approve as the account this browser just picked
 * (emulate's `_emu_session` cookie). The sign-in client keeps the picker so
 * you can switch users.
 */
import { randomBytes } from "node:crypto";
import { parseCookies } from "@emulators/core";
import { getGitHubStore } from "@emulators/github";
import { DEMO_GITHUB_APP } from "../seed/identity";
import type { ShimContext } from "../server";

type PendingCode = {
	login: string;
	scope: string;
	redirectUri: string;
	clientId: string;
	created_at: number;
};

function dataMap<V>(context: ShimContext, key: string) {
	let map = context.store.getData<Map<string, V>>(key);
	if (!map) {
		map = new Map();
		context.store.setData(key, map);
	}
	return map;
}

export function autoApproveAppAuthorize(
	context: ShimContext,
	request: Request,
): Response | null {
	const url = new URL(request.url);
	if (request.method !== "GET" || url.pathname !== "/login/oauth/authorize") {
		return null;
	}
	const clientId = url.searchParams.get("client_id") ?? "";
	const redirectUri = url.searchParams.get("redirect_uri") ?? "";
	if (clientId !== DEMO_GITHUB_APP.clientId || !redirectUri) {
		return null;
	}
	const gh = getGitHubStore(context.store);
	const app = gh.oauthApps.findOneBy("client_id", clientId);
	if (!app?.redirect_uris.includes(redirectUri)) {
		return null;
	}
	const sessionId = parseCookies(
		request.headers.get("cookie") ?? "",
	)._emu_session;
	const login = sessionId
		? dataMap<string>(context, "github.oauth.sessionMap").get(sessionId)
		: undefined;
	if (!login || !gh.users.findOneBy("login", login)) {
		return null;
	}
	const code = randomBytes(20).toString("hex");
	dataMap<PendingCode>(context, "github.oauth.pendingCodes").set(code, {
		login,
		scope: url.searchParams.get("scope") ?? "",
		redirectUri,
		clientId,
		created_at: Date.now(),
	});
	const target = new URL(redirectUri);
	target.searchParams.set("code", code);
	target.searchParams.set("state", url.searchParams.get("state") ?? "");
	return new Response(null, {
		status: 302,
		headers: { Location: target.toString() },
	});
}
