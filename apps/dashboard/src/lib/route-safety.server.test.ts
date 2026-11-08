import { afterEach, describe, expect, it, vi } from "vitest";
import {
	describeError,
	guardRoute,
	logRouteError,
	redactErrorMessage,
	serviceUnavailable,
} from "./route-safety.server";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("redactErrorMessage", () => {
	it("drops bound parameters from drizzle query errors", () => {
		const message =
			'Failed query: update "account" set "access_token" = ?, "refresh_token" = ? where "id" = ?\nparams: ghu_AAAAAAAAAAAAAAAAAAAAAAAA,ghr_BBBBBBBBBBBBBBBBBBBBBBBB,acct-1';
		const redacted = redactErrorMessage(message);
		expect(redacted).toContain("Failed query");
		expect(redacted).not.toContain("ghu_");
		expect(redacted).not.toContain("ghr_");
		expect(redacted).not.toContain("params:");
	});

	it("masks token-shaped strings anywhere in the message", () => {
		const redacted = redactErrorMessage(
			"upstream said Bearer abcdefghijklmnop and ghp_0123456789abcdefghij and github_pat_0123456789abcdefghij_xyz",
		);
		expect(redacted).not.toContain("abcdefghijklmnop");
		expect(redacted).not.toContain("ghp_0123");
		expect(redacted).not.toContain("github_pat_0123");
	});

	it("caps the length", () => {
		expect(redactErrorMessage("x".repeat(5000))).toHaveLength(300);
	});
});

describe("describeError", () => {
	it("summarizes errors with their code and redacted cause", () => {
		const cause = Object.assign(new Error("D1_ERROR: database is full"), {
			code: "SQLITE_FULL",
		});
		const summary = describeError(
			new Error(
				"Failed query: insert into x\nparams: ghu_SECRETSECRETSECRET1",
				{
					cause,
				},
			),
		);
		expect(summary.message).toBe("Failed query: insert into x");
		expect(summary.cause).toEqual({
			name: "Error",
			message: "D1_ERROR: database is full",
			code: "SQLITE_FULL",
		});
		expect(JSON.stringify(summary)).not.toContain("SECRET");
	});

	it("does not stringify arbitrary thrown values", () => {
		expect(describeError({ token: "ghu_SECRETSECRETSECRET1" })).toEqual({
			name: "NonError",
			message: "",
		});
		expect(describeError("plain string").message).toBe("plain string");
	});

	it("stops following causes after two levels", () => {
		const deep = new Error("a", {
			cause: new Error("b", {
				cause: new Error("c", { cause: new Error("d") }),
			}),
		});
		const summary = describeError(deep);
		expect(summary.cause?.cause?.message).toBe("c");
		expect(summary.cause?.cause?.cause).toBeUndefined();
	});
});

describe("guardRoute", () => {
	it("passes responses through", async () => {
		const handler = guardRoute("test", async () => new Response("ok"));
		expect(await (await handler()).text()).toBe("ok");
	});

	it("turns a throw into a logged 503 without leaking the error", async () => {
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
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toEqual({ error: "test_unavailable" });
		expect(log).toHaveBeenCalledTimes(1);
		const line = String(log.mock.calls[0][0]);
		expect(JSON.parse(line)).toMatchObject({ level: "error", scope: "test" });
		expect(line).not.toContain("SECRET");
	});
});

describe("serviceUnavailable and logRouteError", () => {
	it("sets a retry hint", () => {
		expect(serviceUnavailable("x", 15).headers.get("Retry-After")).toBe("15");
	});

	it("logs one JSON line with extra fields", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		logRouteError("scope", "message", new Error("e"), { pathname: "/a" });
		expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
			scope: "scope",
			message: "message",
			pathname: "/a",
			error: { name: "Error", message: "e" },
		});
	});
});
