import {
	authFromSession,
	clearProtectedRouteCachedAuth,
	type ProtectedRouteCachedAuth,
	rememberConfirmedAuth,
} from "./protected-auth-cache";
import type { SessionLike } from "./viewer-hint";

/**
 * Background confirmation of an optimistic (hint-based) dashboard render.
 *
 * The dashboard paints from the last known viewer immediately. This runs the
 * real `getSession()` + `checkSetupComplete()` once per page load and corrects
 * course:
 *
 * - no session → wipe the local cache and hard-redirect to /login
 * - a different user → remember them and reload, so the right cache loads
 * - setup incomplete → hard-redirect to /setup
 * - network or server error → keep rendering; the next cold load re-checks,
 *   and server functions authenticate every request on their own anyway
 *
 * There is no time limit on the optimistic window: it lasts while the check
 * is in flight. The hint itself expires with the session (capped at 30 days).
 */

export type ProtectedSessionOutcome =
	| "valid"
	| "signed-out"
	| "switched-user"
	| "needs-setup"
	| "unknown";

export type ProtectedSessionDeps = {
	getSession: () => Promise<SessionLike | null>;
	checkSetupComplete: () => Promise<boolean>;
	clearLocalSession: (userId: string) => Promise<void>;
	navigate: (href: string) => void;
	reload: () => void;
	currentHref: () => string;
};

let inflight: Promise<ProtectedSessionOutcome> | null = null;

async function defaultDeps(): Promise<ProtectedSessionDeps> {
	const [{ getSession }, { checkSetupComplete }, { clearLocalSession }] =
		await Promise.all([
			import("./auth.functions"),
			import("./github.functions"),
			import("./local-session"),
		]);
	return {
		getSession: () => getSession(),
		checkSetupComplete: () => checkSetupComplete(),
		clearLocalSession,
		navigate: (href) => window.location.replace(href),
		reload: () => window.location.reload(),
		currentHref: () =>
			`${window.location.pathname}${window.location.search}${window.location.hash}`,
	};
}

export async function confirmProtectedSession(
	auth: ProtectedRouteCachedAuth,
	deps: ProtectedSessionDeps,
): Promise<ProtectedSessionOutcome> {
	const [sessionResult, setupResult] = await Promise.allSettled([
		deps.getSession(),
		deps.checkSetupComplete(),
	]);

	if (sessionResult.status === "rejected") {
		return "unknown";
	}

	const session = sessionResult.value;
	if (!session) {
		await deps.clearLocalSession(auth.user.id).catch(() => undefined);
		deps.navigate(`/login?redirect=${encodeURIComponent(deps.currentHref())}`);
		return "signed-out";
	}

	const confirmed = authFromSession(session);
	if (!confirmed) {
		await deps.clearLocalSession(auth.user.id).catch(() => undefined);
		deps.navigate(`/login?redirect=${encodeURIComponent(deps.currentHref())}`);
		return "signed-out";
	}

	if (setupResult.status === "fulfilled" && setupResult.value === false) {
		clearProtectedRouteCachedAuth();
		deps.navigate("/setup");
		return "needs-setup";
	}

	rememberConfirmedAuth(confirmed);

	if (confirmed.user.id !== auth.user.id) {
		deps.reload();
		return "switched-user";
	}

	return "valid";
}

/**
 * Confirms an optimistic render once per page load. Concurrent callers share
 * one check; an inconclusive check ("unknown") can be retried.
 */
export function validateProtectedSessionInBackground(
	auth: ProtectedRouteCachedAuth,
	deps?: ProtectedSessionDeps,
): Promise<ProtectedSessionOutcome> {
	if (typeof window === "undefined" || !auth.optimistic) {
		return Promise.resolve("valid");
	}
	if (!inflight) {
		const run = (deps ? Promise.resolve(deps) : defaultDeps())
			.then((resolved) => confirmProtectedSession(auth, resolved))
			.catch((): ProtectedSessionOutcome => "unknown");
		inflight = run;
		void run.then((outcome) => {
			if (outcome === "unknown" && inflight === run) {
				inflight = null;
			}
		});
	}
	return inflight;
}

export function resetProtectedSessionValidationForTests() {
	inflight = null;
}
