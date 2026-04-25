import type { WorkflowRunJob } from "#/lib/github.types";

export function formatDuration(
	startedAt: string | null,
	completedAt: string | null,
	now?: number,
): string | null {
	if (!startedAt) return null;
	const startMs = new Date(startedAt).getTime();
	if (Number.isNaN(startMs)) return null;
	const endMs = completedAt
		? new Date(completedAt).getTime()
		: (now ?? Date.now());
	if (Number.isNaN(endMs)) return null;
	const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes < 60) return `${minutes}m ${seconds}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}

export function formatJobDuration(
	job: WorkflowRunJob,
	now?: number,
): string | null {
	return formatDuration(job.startedAt, job.completedAt, now);
}
