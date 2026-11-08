import { describe, expect, it } from "vitest";
import {
	parseViewerHint,
	serializeViewerHintCookie,
	VIEWER_HINT_MAX_AGE_MS,
	viewerHintFromSession,
} from "./viewer-hint";

const now = 1_800_000_000_000;

function cookieHeaderFor(value: unknown) {
	return `x=1; diffkit-viewer=${encodeURIComponent(JSON.stringify(value))}`;
}

const session = {
	user: {
		id: "u1",
		name: "Ada",
		email: "ada@example.com",
		image: "https://avatars.githubusercontent.com/u/1",
	},
	session: { id: "s1", expiresAt: new Date(now + 60_000), token: "secret" },
};

describe("viewer hint", () => {
	it("is built from a session without the session token", () => {
		const hint = viewerHintFromSession(session, now);
		expect(hint).toEqual({
			v: 1,
			id: "u1",
			name: "Ada",
			email: "ada@example.com",
			image: "https://avatars.githubusercontent.com/u/1",
			sessionId: "s1",
			exp: now + 60_000,
		});
		expect(JSON.stringify(hint)).not.toContain("secret");
	});

	it("caps the trusted window", () => {
		const hint = viewerHintFromSession(
			{ ...session, session: { id: "s1", expiresAt: null } },
			now,
		);
		expect(hint?.exp).toBe(now + VIEWER_HINT_MAX_AGE_MS);
	});

	it("round-trips through the cookie", () => {
		const hint = viewerHintFromSession(session, now);
		if (!hint) throw new Error("expected hint");
		const [pair] = serializeViewerHintCookie(hint, now).split(";");
		expect(parseViewerHint(pair, now)).toEqual(hint);
	});

	it("ignores expired, malformed or foreign hints", () => {
		const hint = viewerHintFromSession(session, now);
		expect(parseViewerHint(cookieHeaderFor(hint), now + 61_000)).toBeNull();
		expect(parseViewerHint(cookieHeaderFor({ ...hint, v: 2 }), now)).toBeNull();
		expect(
			parseViewerHint(cookieHeaderFor({ ...hint, id: "" }), now),
		).toBeNull();
		expect(parseViewerHint("diffkit-viewer=garbage", now)).toBeNull();
		expect(parseViewerHint("", now)).toBeNull();
	});

	it("drops non-https avatar URLs", () => {
		const hint = viewerHintFromSession(session, now);
		expect(
			parseViewerHint(
				cookieHeaderFor({ ...hint, image: "javascript:alert(1)" }),
				now,
			)?.image,
		).toBeNull();
	});
});
