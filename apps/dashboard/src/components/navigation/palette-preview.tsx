import {
	ClockIcon,
	CommentIcon,
	GitBranchIcon,
	IssuesIcon,
	LockIcon,
	RepoIcon,
	StarIcon,
	UserCircleIcon,
} from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Skeleton } from "skullet/react";
import { SAMPLE_ISSUE } from "#/components/issues/detail/issue-detail-samples";
import { SAMPLE_PULL } from "#/components/pulls/detail/pull-detail-samples";
import type { CommandPreview } from "#/lib/command-palette/types";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubIssueDetailQueryOptions,
	githubPullDetailQueryOptions,
} from "#/lib/github.query";
import type {
	IssueSummary,
	PullSummary,
	UserRepoSummary,
} from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";

/** One curve for moving with the selection and fitting new content. */
export const PREVIEW_MOTION =
	"duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

/**
 * The card beside the palette: where the selected pull request, issue or
 * repository stands, so a row can be told from its neighbours without opening
 * it. `settled` is false while the selection is still moving; details are only
 * fetched once it stops, so arrowing through the list reads nothing.
 */
export function PalettePreview({
	target,
	scope,
	settled,
}: {
	target: CommandPreview;
	scope: GitHubQueryScope;
	settled: boolean;
}) {
	const content = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<number | null>(null);
	useLayoutEffect(() => {
		const element = content.current;
		if (!element) return;
		setHeight(element.offsetHeight);
		const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<aside
			aria-label="Preview"
			style={height === null ? undefined : { height }}
			className={cn(
				"w-72 overflow-hidden rounded-2xl bg-dialog text-xs text-popover-foreground shadow-popover transition-[height]",
				PREVIEW_MOTION,
			)}
		>
			<div ref={content} data-preview-content className="flex flex-col">
				{target.kind === "pull" ? (
					<PullPreview pull={target.pull} scope={scope} settled={settled} />
				) : target.kind === "issue" ? (
					<IssuePreview issue={target.issue} scope={scope} settled={settled} />
				) : (
					<RepoPreview repo={target.repo} />
				)}
			</div>
		</aside>
	);
}

function Header({ icon, title }: { icon: ReactNode; title: string }) {
	return (
		<div className="flex items-start gap-2 px-4 pt-4 pb-3">
			<span className="flex h-5 shrink-0 items-center">{icon}</span>
			<p className="line-clamp-2 text-[13px] font-medium text-balance text-foreground">
				{title}
			</p>
		</div>
	);
}

function Inset({ children }: { children: ReactNode }) {
	return (
		<div className="mx-3 mb-3 flex flex-col gap-1.5 rounded-xl bg-group p-3 text-muted-foreground">
			{children}
		</div>
	);
}

function Meta({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-[0.5px] border-popover-border px-4 py-2.5 text-muted-foreground">
			{children}
		</div>
	);
}

function MetaItem({
	icon,
	children,
}: {
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<span className="flex min-w-0 items-center gap-1 [&_svg]:shrink-0">
			{icon}
			<span className="truncate">{children}</span>
		</span>
	);
}

function Excerpt({ body }: { body: string | null | undefined }) {
	const text = plain(body ?? "");
	return text ? (
		<p className="line-clamp-4 text-pretty">{text}</p>
	) : (
		<p className="italic">No description.</p>
	);
}

/** Markdown's marks, dropped for a few lines of plain preview. */
function plain(text: string) {
	return text
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#*_`>|]+/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function ago(date: string | null | undefined) {
	return date ? formatRelativeTime(date) : null;
}

function PullPreview({
	pull,
	scope,
	settled,
}: {
	pull: PullSummary;
	scope: GitHubQueryScope;
	settled: boolean;
}) {
	const { icon: Icon, color, label } = getPrStateConfig(pull);
	const detail = useQuery({
		...githubPullDetailQueryOptions(scope, {
			owner: pull.repository.owner,
			repo: pull.repository.name,
			pullNumber: pull.number,
		}),
		enabled: settled,
	});
	const data = detail.data;
	return (
		<>
			<Header
				icon={<Icon size={14} strokeWidth={2} className={color} />}
				title={pull.title}
			/>
			<Inset>
				<p className="flex items-center gap-1.5">
					<span className="text-foreground">{label}</span>
					{data ? (
						<span className="tabular-nums">
							· <span className="text-added">+{data.additions}</span>{" "}
							<span className="text-removed">−{data.deletions}</span>
							{" · "}
							{data.changedFiles} {data.changedFiles === 1 ? "file" : "files"}
						</span>
					) : null}
				</p>
				<Skeleton data={data} sample={SAMPLE_PULL} label="Loading details">
					{(pr) => (
						<div className="flex flex-col gap-1.5">
							<p className="truncate font-mono text-[11px]">
								{pr.headRefName} → {pr.baseRefName}
							</p>
							<Excerpt body={pr.body} />
						</div>
					)}
				</Skeleton>
			</Inset>
			<Meta>
				<MetaItem icon={<RepoIcon size={12} strokeWidth={2} />}>
					{pull.repository.fullName}#{pull.number}
				</MetaItem>
				{pull.author ? (
					<MetaItem icon={<UserCircleIcon size={12} strokeWidth={2} />}>
						{pull.author.login}
					</MetaItem>
				) : null}
				<MetaItem icon={<ClockIcon size={12} strokeWidth={2} />}>
					{ago(pull.updatedAt)}
				</MetaItem>
			</Meta>
		</>
	);
}

function issueState(issue: IssueSummary) {
	if (issue.state !== "closed") return { label: "Open", color: "text-success" };
	if (issue.stateReason === "not_planned") {
		return { label: "Not planned", color: "text-muted-foreground" };
	}
	return { label: "Completed", color: "text-merged" };
}

function IssuePreview({
	issue,
	scope,
	settled,
}: {
	issue: IssueSummary;
	scope: GitHubQueryScope;
	settled: boolean;
}) {
	const state = issueState(issue);
	const detail = useQuery({
		...githubIssueDetailQueryOptions(scope, {
			owner: issue.repository.owner,
			repo: issue.repository.name,
			issueNumber: issue.number,
		}),
		enabled: settled,
	});
	const data = detail.data;
	return (
		<>
			<Header
				icon={<IssuesIcon size={14} strokeWidth={2} className={state.color} />}
				title={issue.title}
			/>
			<Inset>
				<p className="flex items-center gap-1.5">
					<span className="text-foreground">{state.label}</span>
					{data?.assignees.length ? (
						<span className="truncate">
							· {data.assignees.map((person) => person.login).join(", ")}
						</span>
					) : null}
				</p>
				<Skeleton data={data} sample={SAMPLE_ISSUE} label="Loading details">
					{(detail) => <Excerpt body={detail.body} />}
				</Skeleton>
			</Inset>
			<Meta>
				<MetaItem icon={<RepoIcon size={12} strokeWidth={2} />}>
					{issue.repository.fullName}#{issue.number}
				</MetaItem>
				{issue.comments > 0 ? (
					<MetaItem icon={<CommentIcon size={12} strokeWidth={2} />}>
						{issue.comments}
					</MetaItem>
				) : null}
				<MetaItem icon={<ClockIcon size={12} strokeWidth={2} />}>
					{ago(issue.updatedAt)}
				</MetaItem>
			</Meta>
		</>
	);
}

function RepoPreview({ repo }: { repo: UserRepoSummary }) {
	return (
		<>
			<Header
				icon={
					<RepoIcon
						size={14}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				}
				title={repo.fullName}
			/>
			<Inset>
				{repo.description ? (
					<p className="line-clamp-4 text-pretty">{repo.description}</p>
				) : (
					<p className="italic">No description.</p>
				)}
				<p className="flex items-center gap-3 tabular-nums">
					{repo.language ? (
						<span className="text-foreground">{repo.language}</span>
					) : null}
					<span className="flex items-center gap-1">
						<StarIcon size={12} strokeWidth={2} />
						{repo.stars}
					</span>
					<span className="flex items-center gap-1">
						<GitBranchIcon size={12} strokeWidth={2} />
						{repo.forks}
					</span>
				</p>
			</Inset>
			<Meta>
				<MetaItem
					icon={
						repo.isPrivate ? (
							<LockIcon size={12} strokeWidth={2} />
						) : (
							<RepoIcon size={12} strokeWidth={2} />
						)
					}
				>
					{repo.visibility === "public"
						? "Public"
						: repo.visibility === "internal"
							? "Internal"
							: "Private"}
				</MetaItem>
				{repo.updatedAt ? (
					<MetaItem icon={<ClockIcon size={12} strokeWidth={2} />}>
						Updated {ago(repo.updatedAt)}
					</MetaItem>
				) : null}
			</Meta>
		</>
	);
}
