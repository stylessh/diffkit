import { recordMaintenanceRun } from "#/lib/health.server";
import { logRouteError } from "#/lib/route-safety.server";
import { runScheduledMaintenance } from "#/lib/scheduled-maintenance.server";

// Change-feed sweeper and D1 size check. Void derives the Worker's cron
// trigger from this export.
export const cron = "*/5 * * * *";

export default async function maintenance(
	controller: ScheduledController,
	env: Cloudflare.Env,
): Promise<void> {
	try {
		const summary = await runScheduledMaintenance(
			env.DB,
			controller.scheduledTime,
		);
		await recordMaintenanceRun(env.GITHUB_CACHE_KV, summary);
	} catch (error) {
		logRouteError("worker", "scheduled maintenance failed", error);
	}
}
