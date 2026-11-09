import { ClockIcon, RepoIcon } from "@diffkit/icons";
import { PanelPill, PanelRow } from "@diffkit/ui/components/detail-layout";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import { formatRelativeTime } from "#/lib/format-relative-time";

type DetailRowIcon = React.ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

/** The repository the PR or issue lives in, first in each sidebar's Properties. */
export function RepoRow({ owner, repo }: { owner: string; repo: string }) {
	return (
		<PanelPill asChild icon={<RepoIcon size={14} strokeWidth={2} />}>
			<Link to="/$owner/$repo" params={{ owner, repo }}>
				<span className="truncate">
					{owner}/{repo}
				</span>
			</Link>
		</PanelPill>
	);
}

/** "Updated 3d ago": the last change, last in each sidebar's Properties. */
export function UpdatedRow({ at }: { at: string }) {
	return (
		<PanelRow muted icon={<ClockIcon size={14} strokeWidth={2} />}>
			Updated {formatRelativeTime(at)}
		</PanelRow>
	);
}

export function DetailSidebar({ children }: { children: React.ReactNode }) {
	return <div className="flex flex-col">{children}</div>;
}

export function DetailSidebarSection({
	title,
	titleRight,
	children,
}: {
	title: string;
	titleRight?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="mb-7 flex flex-col gap-1.5">
			<div className="flex h-6 items-center justify-between gap-2">
				<h3 className="text-[13px] font-[450] text-muted-foreground">
					{title}
				</h3>
				{titleRight != null ? (
					<span className="flex shrink-0 items-center text-xs font-normal tabular-nums tracking-normal text-muted-foreground">
						{titleRight}
					</span>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function DetailSidebarRow({
	icon: Icon,
	label,
	children,
}: {
	icon?: DetailRowIcon;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-7 items-center gap-2 text-[13px] font-medium">
			{Icon ? (
				<span className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
					<Icon size={14} strokeWidth={2} />
				</span>
			) : null}
			<span className="font-[450] text-muted-foreground">{label}</span>
			<span className="min-w-0 truncate tabular-nums text-text-header">
				{children}
			</span>
		</div>
	);
}

export function DetailParticipantAvatars({
	actors,
}: {
	actors: Array<{
		login: string;
		avatarUrl: string;
	}>;
}) {
	return (
		<div className="group/participants flex flex-wrap items-center">
			{actors.map((actor, index) => (
				<Tooltip key={actor.login}>
					<TooltipTrigger asChild>
						<Link
							to="/$owner"
							params={{ owner: actor.login }}
							style={index > 0 ? { marginLeft: -6 } : undefined}
							className="relative block transition-[margin] duration-150 group-hover/participants:ml-0"
						>
							<img
								src={actor.avatarUrl}
								alt={actor.login}
								className="size-6 rounded-full ring-2 ring-main"
							/>
						</Link>
					</TooltipTrigger>
					<TooltipContent>{actor.login}</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}
