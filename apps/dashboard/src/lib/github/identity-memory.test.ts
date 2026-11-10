import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearIdentityMemory,
	IDENTITY_MEMORY_TTL_MS,
	readIdentityThroughMemory,
} from "./identity-memory";

describe("readIdentityThroughMemory", () => {
	beforeEach(clearIdentityMemory);

	it("answers later requests from memory until the entry expires", async () => {
		let now = 1_000;
		const load = vi.fn(async () => ["acme"]);
		const read = () =>
			readIdentityThroughMemory({
				userId: "u1",
				resource: "installations",
				load,
				now: () => now,
			});

		await read();
		now += IDENTITY_MEMORY_TTL_MS - 1;
		expect(await read()).toEqual(["acme"]);
		expect(load).toHaveBeenCalledTimes(1);

		now += 1;
		await read();
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("keeps users and resources apart", async () => {
		const read = (userId: string, resource: string) =>
			readIdentityThroughMemory({
				userId,
				resource,
				load: async () => `${userId}:${resource}`,
			});

		await read("u1", "viewer");
		expect(await read("u2", "viewer")).toBe("u2:viewer");
		expect(await read("u1", "installations")).toBe("u1:installations");
	});

	it("asks again when the answer should not be remembered or the load fails", async () => {
		const load = vi
			.fn<() => Promise<string[]>>()
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error("GitHub is down"))
			.mockResolvedValue(["acme"]);
		const read = () =>
			readIdentityThroughMemory({
				userId: "u1",
				resource: "installations",
				load,
				shouldRemember: (installations) => installations.length > 0,
			});

		expect(await read()).toEqual([]);
		await expect(read()).rejects.toThrow("GitHub is down");
		expect(await read()).toEqual(["acme"]);
		expect(await read()).toEqual(["acme"]);
		expect(load).toHaveBeenCalledTimes(3);
	});
});
