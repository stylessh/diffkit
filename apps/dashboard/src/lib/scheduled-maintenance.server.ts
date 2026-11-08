import { checkD1Health, sweepGitHubChanges } from "./github-change.server";

/**
 * Runs from the Worker's cron trigger. Logs one structured line per run so
 * Workers Logs can chart sweeps and alert on `"alert":"d1_size_warning"`.
 */
export async function runScheduledMaintenance(
	db: D1Database,
	scheduledTime = Date.now(),
) {
	const summary: Record<string, unknown> = {
		task: "scheduled-maintenance",
		scheduledTime,
	};

	try {
		summary.sweep = await sweepGitHubChanges(db, { now: scheduledTime });
	} catch (error) {
		summary.sweepError = error instanceof Error ? error.message : String(error);
	}

	try {
		const health = await checkD1Health(db);
		summary.d1SizeBytes = health.sizeBytes;
		summary.d1SizeRatio = health.ratio;
		summary.changeRows = health.changeRows;
	} catch (error) {
		summary.healthError =
			error instanceof Error ? error.message : String(error);
	}

	console.log(JSON.stringify(summary));
	return summary;
}
