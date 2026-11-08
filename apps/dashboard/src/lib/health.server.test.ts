import { describe, expect, it } from "vitest";
import { checkHealth, healthResponse } from "./health.server";
import { createTestD1 } from "./testing/d1-sqlite";

describe("health check", () => {
	it("answers 503 with the failing dependency's details while the rest stay ok", async () => {
		const { db } = createTestD1();
		const kv = {
			get: async () => {
				throw new Error("KV GET failed: 503 Service Unavailable");
			},
		} as unknown as KVNamespace;

		const response = healthResponse(await checkHealth({ db, kv }));

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			status: "degraded",
			version: { status: "unknown" },
			checks: {
				d1: { status: "ok" },
				kv: {
					status: "failed",
					error: "KV GET failed: 503 Service Unavailable",
				},
			},
			maintenance: { status: "unreadable" },
		});
	});
});
