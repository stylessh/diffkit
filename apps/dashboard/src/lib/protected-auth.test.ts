// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readDocumentCookie } from "./cookies";
import {
	type ProtectedSessionDeps,
	resetProtectedSessionValidationForTests,
	validateProtectedSessionInBackground,
} from "./protected-auth";
import {
	authFromViewerHint,
	getProtectedRouteCachedAuth,
	setProtectedRouteCachedAuth,
} from "./protected-auth-cache";
import {
	parseViewerHint,
	serializeViewerHintCookie,
	type ViewerHint,
} from "./viewer-hint";

const hint: ViewerHint = {
	v: 1,
	id: "u1",
	name: "Ada",
	email: "ada@example.com",
	image: null,
	sessionId: "s1",
	exp: Date.now() + 60_000,
};

function session(userId = "u1") {
	return {
		user: { id: userId, name: "Ada", email: "ada@example.com", image: null },
		session: { id: "s2", expiresAt: new Date(Date.now() + 120_000) },
	};
}

function deps(overrides: Partial<ProtectedSessionDeps> = {}) {
	return {
		getSession: vi.fn(async () => session()),
		checkSetupComplete: vi.fn(async () => true),
		clearLocalSession: vi.fn(async () => undefined),
		navigate: vi.fn(),
		reload: vi.fn(),
		currentHref: () => "/pulls?x=1",
		...overrides,
	} satisfies ProtectedSessionDeps;
}

function startOptimistic() {
	// biome-ignore lint/suspicious/noDocumentCookie: test setup
	document.cookie = serializeViewerHintCookie(hint);
	const auth = authFromViewerHint(hint);
	setProtectedRouteCachedAuth(auth);
	return auth;
}

afterEach(() => {
	resetProtectedSessionValidationForTests();
	// biome-ignore lint/suspicious/noDocumentCookie: test teardown
	document.cookie = "diffkit-viewer=; path=/; max-age=0";
});

describe("validateProtectedSessionInBackground", () => {
	it("confirms the viewer and refreshes the hint", async () => {
		const auth = startOptimistic();
		const d = deps();
		await expect(validateProtectedSessionInBackground(auth, d)).resolves.toBe(
			"valid",
		);
		expect(d.navigate).not.toHaveBeenCalled();
		expect(getProtectedRouteCachedAuth()?.optimistic).toBe(false);
		expect(parseViewerHint(readDocumentCookie())?.sessionId).toBe("s2");
	});

	it("wipes local data and hard-redirects to /login when the session is gone", async () => {
		const auth = startOptimistic();
		const d = deps({ getSession: vi.fn(async () => null) });
		await expect(validateProtectedSessionInBackground(auth, d)).resolves.toBe(
			"signed-out",
		);
		expect(d.clearLocalSession).toHaveBeenCalledWith("u1");
		expect(d.navigate).toHaveBeenCalledWith(
			`/login?redirect=${encodeURIComponent("/pulls?x=1")}`,
		);
	});

	it("sends the viewer to /setup and forgets the hint when setup is incomplete", async () => {
		const auth = startOptimistic();
		const d = deps({ checkSetupComplete: vi.fn(async () => false) });
		await expect(validateProtectedSessionInBackground(auth, d)).resolves.toBe(
			"needs-setup",
		);
		expect(d.navigate).toHaveBeenCalledWith("/setup");
		expect(parseViewerHint(readDocumentCookie())).toBeNull();
		expect(getProtectedRouteCachedAuth()).toBeNull();
	});

	it("reloads as the real user when the session belongs to someone else", async () => {
		const auth = startOptimistic();
		const d = deps({ getSession: vi.fn(async () => session("u2")) });
		await expect(validateProtectedSessionInBackground(auth, d)).resolves.toBe(
			"switched-user",
		);
		expect(parseViewerHint(readDocumentCookie())?.id).toBe("u2");
		expect(d.reload).toHaveBeenCalled();
	});

	it("keeps rendering on network errors and allows a retry", async () => {
		const auth = startOptimistic();
		const failing = deps({
			getSession: vi.fn(async () => {
				throw new Error("offline");
			}),
		});
		await expect(
			validateProtectedSessionInBackground(auth, failing),
		).resolves.toBe("unknown");
		expect(failing.navigate).not.toHaveBeenCalled();
		expect(failing.clearLocalSession).not.toHaveBeenCalled();

		await Promise.resolve();
		const working = deps();
		await expect(
			validateProtectedSessionInBackground(auth, working),
		).resolves.toBe("valid");
	});

	it("ignores a setup-check error when the session is valid", async () => {
		const auth = startOptimistic();
		const d = deps({
			checkSetupComplete: vi.fn(async () => {
				throw new Error("GitHub 502");
			}),
		});
		await expect(validateProtectedSessionInBackground(auth, d)).resolves.toBe(
			"valid",
		);
		expect(d.navigate).not.toHaveBeenCalled();
	});

	it("runs one check per page load", async () => {
		const auth = startOptimistic();
		const d = deps();
		await Promise.all([
			validateProtectedSessionInBackground(auth, d),
			validateProtectedSessionInBackground(auth, d),
		]);
		expect(d.getSession).toHaveBeenCalledTimes(1);
	});
});
