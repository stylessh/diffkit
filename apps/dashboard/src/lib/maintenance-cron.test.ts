import { afterEach, expect, it, vi } from "vitest";

const runScheduledMaintenance = vi.hoisted(() => vi.fn());

vi.mock("#/lib/scheduled-maintenance.server", () => ({
	runScheduledMaintenance,
}));

const { default: maintenance } = await import("../../crons/maintenance");

afterEach(() => {
	vi.restoreAllMocks();
});

it("logs a failed run instead of rejecting, so a broken sweep cannot fail the cron", async () => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	runScheduledMaintenance.mockRejectedValue(new Error("D1 unavailable"));

	await expect(
		maintenance(
			{ scheduledTime: 1234 } as ScheduledController,
			{
				DB: {} as D1Database,
				GITHUB_CACHE_KV: {} as KVNamespace,
			} as Cloudflare.Env,
		),
	).resolves.toBeUndefined();
	expect(console.error).toHaveBeenCalled();
});
