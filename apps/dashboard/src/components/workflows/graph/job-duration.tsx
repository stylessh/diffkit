import type { WorkflowRunJob } from "#/lib/github.types";
import { useNow } from "#/lib/use-now";
import { formatJobDuration } from "./format";

export function JobDuration({
	job,
	className,
}: {
	job: WorkflowRunJob;
	className?: string;
}) {
	const isLive = !!job.startedAt && !job.completedAt;
	return isLive ? (
		<LiveJobDuration job={job} className={className} />
	) : (
		<StaticJobDuration job={job} className={className} />
	);
}

function LiveJobDuration({
	job,
	className,
}: {
	job: WorkflowRunJob;
	className?: string;
}) {
	const now = useNow();
	const text = formatJobDuration(job, now);
	return text ? <span className={className}>{text}</span> : null;
}

function StaticJobDuration({
	job,
	className,
}: {
	job: WorkflowRunJob;
	className?: string;
}) {
	const text = formatJobDuration(job);
	return text ? <span className={className}>{text}</span> : null;
}
