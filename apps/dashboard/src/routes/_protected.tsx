import { createFileRoute, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { DashboardViewportLoading } from "#/components/layouts/dashboard-content-loading";
import { DashboardLayout } from "#/components/layouts/dashboard-layout";
import { ErrorScreen } from "#/components/layouts/error-screen";
import { getSession } from "#/lib/auth.functions";
import { readDocumentCookie } from "#/lib/cookies";
import { checkSetupComplete } from "#/lib/github.functions";
import { useGitHubChangeFeed } from "#/lib/github-change-feed";
import { validateProtectedSessionInBackground } from "#/lib/protected-auth";
import {
	authFromSession,
	authFromViewerHint,
	getProtectedRouteCachedAuth,
	type ProtectedRouteCachedAuth,
	rememberConfirmedAuth,
	setProtectedRouteCachedAuth,
} from "#/lib/protected-auth-cache";
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo";
import { parseViewerHint } from "#/lib/viewer-hint";

const readRequestCookie = createIsomorphicFn()
	.server(async () => {
		const { getRequestHeader } = await import("@tanstack/react-start/server");
		return getRequestHeader("cookie");
	})
	.client(async () => readDocumentCookie());

/**
 * Optimistic auth.
 *
 * 1. Client navigations reuse the in-memory auth.
 * 2. Returning viewers (hint cookie present) render immediately, on the
 *    server and the client, while `getSession()` + `checkSetupComplete()`
 *    confirm in the background (`ProtectedLayout`). No session → wipe the
 *    cache and hard-redirect to /login.
 * 3. Without a hint (first visit, after sign-out or setup) the check blocks,
 *    as before.
 *
 * Server functions authenticate every request with the HttpOnly session
 * cookie, so rendering the shell from the hint never grants data access.
 */
export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ location }) => {
		const cookie = await readRequestCookie();
		return resolveProtectedAuth(location.href, cookie);
	},
	headers: () => PRIVATE_ROUTE_HEADERS,
	head: ({ match }) => {
		return buildSeo({
			path: match.pathname,
			title: formatPageTitle("Dashboard"),
			description:
				"Private GitHub workspace for tracking pull requests, issues, and review requests.",
			robots: "noindex",
		});
	},
	component: ProtectedLayout,
	pendingComponent: DashboardViewportLoading,
	errorComponent: ErrorScreen,
});

async function resolveProtectedAuth(
	href: string,
	cookie: string | null | undefined,
): Promise<ProtectedRouteCachedAuth> {
	const cachedAuth = getProtectedRouteCachedAuth();
	if (cachedAuth) return cachedAuth;

	const hint = parseViewerHint(cookie);
	if (hint) {
		const optimistic = authFromViewerHint(hint);
		if (typeof window !== "undefined") {
			setProtectedRouteCachedAuth(optimistic);
			void validateProtectedSessionInBackground(optimistic);
		}
		return optimistic;
	}

	const [session, setupComplete] = await Promise.all([
		getSession(),
		checkSetupComplete(),
	]);

	if (!session) {
		throw redirect({
			to: "/login",
			search: { redirect: href },
		});
	}

	if (!setupComplete) {
		throw redirect({ to: "/setup" });
	}

	const next = authFromSession(session);
	if (!next) {
		throw redirect({
			to: "/login",
			search: { redirect: href },
		});
	}

	rememberConfirmedAuth(next);
	return next;
}

/**
 * On a server-rendered cold load `beforeLoad` does not re-run in the browser,
 * so the client side of optimistic auth happens here: remember the auth for
 * client navigations, confirm a hint-based render, or store the hint after a
 * blocking check that ran on the server.
 */
function ProtectedLayout() {
	const { user, session, optimistic } = Route.useRouteContext();

	useEffect(() => {
		if (getProtectedRouteCachedAuth()) return;
		const auth = { user, session, optimistic };
		if (optimistic) {
			setProtectedRouteCachedAuth(auth);
			void validateProtectedSessionInBackground(auth);
		} else {
			rememberConfirmedAuth(auth);
		}
	}, [user, session, optimistic]);

	useGitHubChangeFeed(user.id);

	return <DashboardLayout />;
}
