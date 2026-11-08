import { afterEach, describe, expect, it, vi } from "vitest";
import {
	describeError,
	guardRoute,
	redactErrorMessage,
} from "./route-safety.server";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("error logging never carries secrets", () => {
	it("drops the bound parameters drizzle appends to failed queries", () => {
		const message =
			'Failed query: update "account" set "access_token" = ? where "id" = ?\nparams: ghu_AAAAAAAAAAAAAAAAAAAAAAAA,acct-1';
		expect(redactErrorMessage(message)).toBe(
			'Failed query: update "account" set "access_token" = ? where "id" = ?',
		);
	});

	it("masks token-shaped strings anywhere in a message", () => {
		const redacted = redactErrorMessage(
			"said Bearer abcdefghijklmnop, ghp_0123456789abcdefghij, github_pat_0123456789abcdefghij_xyz",
		);
		expect(redacted).not.toMatch(/abcdefghijklmnop|ghp_0123|github_pat_0123/);
	});

	it("redacts causes and ignores values that are not errors", () => {
		const summary = describeError(
			new Error("outer", {
				cause: new Error("Failed query\nparams: ghu_SECRETSECRETSECRET1"),
			}),
		);
		expect(JSON.stringify(summary)).not.toContain("SECRET");
		expect(describeError({ token: "ghu_SECRETSECRETSECRET1" }).message).toBe(
			"",
		);
	});
});

describe("guardRoute", () => {
	it("turns a throw into a logged, retryable 503 without leaking the error", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const handler = guardRoute(
			"test",
			async () => {
				throw new Error("D1_ERROR: boom\nparams: ghu_SECRETSECRETSECRET1");
			},
			"test_unavailable",
		);

		const response = await handler();

		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("5");
		expect(await response.json()).toEqual({ error: "test_unavailable" });
		expect(log).toHaveBeenCalledTimes(1);
		expect(String(log.mock.calls[0][0])).not.toContain("SECRET");
	});

	it("passes responses through", async () => {
		const handler = guardRoute("test", async () => new Response("ok"));
		expect(await (await handler()).text()).toBe("ok");
	});
});
