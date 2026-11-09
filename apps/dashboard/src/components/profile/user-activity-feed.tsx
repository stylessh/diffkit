import {
	ChevronRightIcon,
	CircleIcon,
	CommentIcon,
	GitCommitIcon,
	GitForkIcon,
	IssuesIcon,
	ReviewsIcon,
	StarIcon,
} from "@diffkit/icons";
import { LineCounts } from "@diffkit/ui/components/detail-layout";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { UserActivityEvent } from "#/lib/github.types";
import { plainExcerpt } from "#/lib/plain-excerpt";
import { getPrStateConfig } from "#/lib/pr-state";
import {
	type ActivityItem,
	buildActivityMonths,
	type CommitRepo,
} from "#/lib/user-activity-feed";

const ICON = { size: 14, strokeWidth: 2 } as const;

function splitRepo(fullName: string) {
	const [owner = "", repo = ""] = fullName.split("/");
	return { owner, repo };
}

function capitalize(word: string | null) {
	return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

const titleLinkClassName =
	"min-w-0 truncate font-medium text-foreground decoration-muted-foreground/40 underline-offset-2 hover:underline";

/**
 * The profile's recent activity: months as quiet headings, then one line per
 * thing that happened, on a guide rail. Detail stays a click away: titles
 * open the pull request or issue, and a month's commits unfold per repository.
 */
export function UserActivityFeed({ events }: { events: UserActivityEvent[] }) {
	const months = buildActivityMonths(events);

	if (months.length === 0) {
		return (
			<p className="py-6 text-[13px] text-muted-foreground">
				No recent activity.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			{months.map((month) => (
				<section key={month.key} aria-label={month.label}>
					<h3 className="mb-1 pl-7 text-xs font-medium text-muted-foreground">
						{month.label}
					</h3>
					<ol className="relative before:absolute before:top-3 before:bottom-3 before:left-[7.5px] before:w-px before:bg-activity-line/50">
						{month.items.map((item) => (
							<ActivityLine key={item.key} item={item} />
						))}
					</ol>
				</section>
			))}
		</div>
	);
}

function ActivityLine({ item }: { item: ActivityItem }) {
	if (item.kind === "commits") return <CommitsLine item={item} />;
	if (item.kind === "pull") return <PullLine event={item.event} />;
	return <EventLine event={item.event} />;
}

/** A row's frame: the rail icon, the sentence, then what sits on the right. */
function Line({
	icon,
	children,
	meta,
	time,
	below,
}: {
	icon: React.ReactNode;
	children: React.ReactNode;
	meta?: React.ReactNode;
	time: string;
	below?: React.ReactNode;
}) {
	return (
		<li className="relative flex flex-col">
			<div className="flex h-9 min-w-0 items-center gap-3 text-[13px]">
				<span className="relative flex size-4 shrink-0 items-center justify-center rounded-full bg-background ring-4 ring-background">
					{icon}
				</span>
				<span className="flex min-w-0 flex-1 items-center gap-1.5">
					{children}
				</span>
				{meta ? (
					<span className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
						{meta}
					</span>
				) : null}
				<time
					dateTime={time}
					className="w-16 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground"
				>
					{formatRelativeTime(time)}
				</time>
			</div>
			{below}
		</li>
	);
}

function Verb({ children }: { children: React.ReactNode }) {
	return <span className="shrink-0 text-muted-foreground">{children}</span>;
}

function RepoMeta({ name }: { name: string }) {
	return <span className="max-w-44 truncate">{name}</span>;
}

function PullLine({ event }: { event: UserActivityEvent }) {
	const pr = event.prDetail;
	const { owner, repo } = splitRepo(event.repo.name);
	const state = pr ? getPrStateConfig(pr) : null;
	const StateIcon = state?.icon;
	const verb =
		state?.label === "Merged"
			? "Merged"
			: state?.label === "Closed"
				? "Closed"
				: capitalize(event.action) || "Opened";
	const title = event.title ?? (pr ? `#${pr.number}` : "a pull request");

	return (
		<Line
			time={event.createdAt}
			icon={
				StateIcon ? (
					<StateIcon {...ICON} className={state.color} />
				) : (
					<CircleIcon {...ICON} className="text-muted-foreground" />
				)
			}
			meta={
				<>
					{pr && (pr.additions > 0 || pr.deletions > 0) ? (
						<LineCounts additions={pr.additions} deletions={pr.deletions} />
					) : null}
					<RepoMeta name={event.repo.name} />
				</>
			}
		>
			<Verb>{verb}</Verb>
			{pr && owner && repo ? (
				<Link
					to="/$owner/$repo/pull/$pullId"
					params={{ owner, repo, pullId: String(pr.number) }}
					className={titleLinkClassName}
				>
					{title}
				</Link>
			) : (
				<span className="min-w-0 truncate font-medium text-foreground">
					{title}
				</span>
			)}
		</Line>
	);
}

function CommitsLine({
	item,
}: {
	item: Extract<ActivityItem, { kind: "commits" }>;
}) {
	const [open, setOpen] = useState(false);
	const listId = `activity-commits-${item.at}`;
	const repoCount = item.repos.length;

	return (
		<Line
			time={item.at}
			icon={<GitCommitIcon {...ICON} className="text-muted-foreground" />}
			below={open ? <CommitRepos id={listId} repos={item.repos} /> : null}
		>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={listId}
				onClick={() => setOpen((value) => !value)}
				className="-mx-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-ghost-hover"
			>
				<Verb>Pushed</Verb>
				<span className="shrink-0 font-medium text-foreground tabular-nums">
					{item.total} {item.total === 1 ? "commit" : "commits"}
				</span>
				<span className="truncate text-muted-foreground">
					to {repoCount} {repoCount === 1 ? "repository" : "repositories"}
				</span>
				<ChevronRightIcon
					size={12}
					strokeWidth={2}
					className={cn(
						"shrink-0 text-muted-foreground transition-transform duration-150",
						open && "rotate-90",
					)}
				/>
			</button>
		</Line>
	);
}

function CommitRepos({ id, repos }: { id: string; repos: CommitRepo[] }) {
	return (
		<ul id={id} className="mb-1.5 flex flex-col pl-7">
			{repos.map((repo) => {
				const { owner, repo: name } = splitRepo(repo.name);
				return (
					<li
						key={repo.name}
						className="flex h-7 items-center gap-2 text-[13px]"
					>
						{owner && name ? (
							<Link
								to="/$owner/$repo"
								params={{ owner, repo: name }}
								className={cn(titleLinkClassName, "font-normal")}
							>
								{repo.name}
							</Link>
						) : (
							<span className="truncate">{repo.name}</span>
						)}
						<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
							{repo.commits} {repo.commits === 1 ? "commit" : "commits"}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

function EventLine({ event }: { event: UserActivityEvent }) {
	const { owner, repo } = splitRepo(event.repo.name);
	const repoLink =
		owner && repo ? (
			<Link
				to="/$owner/$repo"
				params={{ owner, repo }}
				className={titleLinkClassName}
			>
				{event.repo.name}
			</Link>
		) : (
			<span className="truncate font-medium">{event.repo.name}</span>
		);
	const issue = event.issueDetail;
	const issueLink =
		issue && owner && repo ? (
			<Link
				to="/$owner/$repo/issues/$issueId"
				params={{ owner, repo, issueId: String(issue.number) }}
				className={titleLinkClassName}
			>
				{event.title ?? `#${issue.number}`}
			</Link>
		) : (
			<span className="min-w-0 truncate font-medium text-foreground">
				{event.title}
			</span>
		);
	const muted = "text-muted-foreground";
	const excerpt = event.commentBody ? plainExcerpt(event.commentBody) : "";

	switch (event.type) {
		case "IssuesEvent":
			return (
				<Line
					time={event.createdAt}
					icon={
						<IssuesIcon
							{...ICON}
							className={
								issue?.state === "closed" ? "text-merged" : "text-success"
							}
						/>
					}
					meta={<RepoMeta name={event.repo.name} />}
				>
					<Verb>{capitalize(event.action)}</Verb>
					{issueLink}
				</Line>
			);
		case "IssueCommentEvent":
			return (
				<Line
					time={event.createdAt}
					icon={<CommentIcon {...ICON} className={muted} />}
					meta={<RepoMeta name={event.repo.name} />}
					below={
						excerpt ? (
							<p className="-mt-1.5 mb-1.5 truncate pl-7 text-[13px] text-muted-foreground">
								{excerpt}
							</p>
						) : null
					}
				>
					<Verb>Commented on</Verb>
					{issueLink}
				</Line>
			);
		case "PullRequestReviewEvent":
			return (
				<Line
					time={event.createdAt}
					icon={<ReviewsIcon {...ICON} className={muted} />}
					meta={<RepoMeta name={event.repo.name} />}
				>
					<Verb>Reviewed</Verb>
					<span className="min-w-0 truncate font-medium text-foreground">
						{event.title}
					</span>
				</Line>
			);
		case "WatchEvent":
			return (
				<Line
					time={event.createdAt}
					icon={<StarIcon {...ICON} className={muted} />}
				>
					<Verb>Starred</Verb>
					{repoLink}
				</Line>
			);
		case "ForkEvent":
			return (
				<Line
					time={event.createdAt}
					icon={<GitForkIcon {...ICON} className={muted} />}
				>
					<Verb>Forked</Verb>
					{repoLink}
				</Line>
			);
		case "ReleaseEvent":
			return (
				<Line
					time={event.createdAt}
					icon={<TagIcon size={14} className={muted} />}
					meta={<RepoMeta name={event.repo.name} />}
				>
					<Verb>{capitalize(event.action) || "Published"}</Verb>
					<span className="min-w-0 truncate font-medium text-foreground">
						{event.title}
					</span>
				</Line>
			);
		default:
			return (
				<Line
					time={event.createdAt}
					icon={<CircleIcon {...ICON} className={muted} />}
				>
					<Verb>
						{event.type
							.replace(/Event$/, "")
							.replace(/([a-z])([A-Z])/g, "$1 $2")}
					</Verb>
					{repoLink}
				</Line>
			);
	}
}
