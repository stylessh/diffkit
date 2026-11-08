import { checkD1Health, sweepGitHubChanges } from "./github-change.server";
import { describeError } from "./route-safety.server";

type TaskResult<T> =
	| { status: "ok"; value: T }
	| { status: "failed"; error: string };

async function runTask<T>(task: () => Promise<T>): Promise<TaskResult<T>> {
	try {
		return { status: "ok", value: await task() };
	} catch (error) {
		return { status: "failed", error: describeError(error).message };
	}
}

// One JSON line per run: Workers Logs charts sweeps and alerts on `alert`.
// A failing task is reported in the line and never stops the other one.
export async function runScheduledMaintenance(
	db: D1Database,
	scheduledTime = Date.now(),
) {
	const sweep = await runTask(() =>
		sweepGitHubChanges(db, { now: scheduledTime }),
	);
	const health = await runTask(() => checkD1Health(db));

	const summary: Record<string, unknown> = {
		task: "scheduled-maintenance",
		scheduledTime,
		...(sweep.status === "ok"
			? { sweep: sweep.value }
			: { sweepError: sweep.error }),
		...(health.status === "ok"
			? {
					d1SizeBytes: health.value.sizeBytes,
					d1SizeRatio: health.value.ratio,
					changeRows: health.value.changeRows,
				}
			: { healthError: health.error }),
	};

	console.log(JSON.stringify(summary));
	return summary;
}
