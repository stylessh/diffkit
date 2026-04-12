import { describe, expect, it, vi } from "vitest";
import { ensureDefinedQueryData } from "./query-data";

describe("ensureDefinedQueryData", () => {
	it("passes through null because null is intentional query data", async () => {
		await expect(
			ensureDefinedQueryData(async () => null, "getNullableData"),
		).resolves.toBeNull();
	});

	it("throws when a query loader resolves undefined", async () => {
		const load = vi.fn(async () => undefined);

		await expect(
			ensureDefinedQueryData(load, "getPullPageData"),
		).rejects.toThrow("getPullPageData returned undefined");
		expect(load).toHaveBeenCalledTimes(1);
	});
});
