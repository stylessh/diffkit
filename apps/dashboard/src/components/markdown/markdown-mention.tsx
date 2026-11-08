import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@diffkit/ui/components/hover-card";
import type { MarkdownMentionProps } from "@diffkit/ui/components/markdown";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { markdownLinkClassName } from "@diffkit/ui/lib/markdown-theme";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { githubUserProfileQueryOptions } from "#/lib/github.query";
import type { GitHubUserProfile } from "#/lib/github.types";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { type CardState, cardState } from "./reference-hover-cards";

function UserCard({
	login,
	state,
}: {
	login: string;
	state: CardState<GitHubUserProfile>;
}) {
	if (state.status === "loading") {
		return (
			<div className="flex items-center gap-3 p-3">
				<Skeleton className="size-9 rounded-full" />
				<div className="flex flex-1 flex-col gap-1.5">
					<Skeleton className="h-3.5 w-24 rounded" />
					<Skeleton className="h-3 w-16 rounded" />
				</div>
			</div>
		);
	}
	const profile = state.status === "ready" ? state.data : null;
	return (
		<div className="flex items-center gap-3 p-3">
			{profile ? (
				<img
					src={profile.avatarUrl}
					alt=""
					className="size-9 shrink-0 rounded-full ring-[0.5px] ring-chip-border"
				/>
			) : null}
			<div className="flex min-w-0 flex-col">
				<span className="truncate text-[13px] font-medium text-foreground">
					{profile?.name ?? login}
				</span>
				<span className="truncate text-xs text-muted-foreground">
					@{profile?.login ?? login}
					{profile?.company ? ` · ${profile.company}` : ""}
				</span>
			</div>
		</div>
	);
}

export function MarkdownMention({
	login,
	href,
	children,
}: MarkdownMentionProps) {
	const scope = useGitHubQueryScope();
	const [open, setOpen] = useState(false);
	const query = useQuery({
		...githubUserProfileQueryOptions(scope, login),
		enabled: open,
	});

	return (
		<HoverCard openDelay={350} onOpenChange={setOpen}>
			<HoverCardTrigger asChild>
				<Link to={href ?? `/${login}`} className={markdownLinkClassName}>
					{children}
				</Link>
			</HoverCardTrigger>
			<HoverCardContent align="start" className="w-64">
				<UserCard login={login} state={cardState(query)} />
			</HoverCardContent>
		</HoverCard>
	);
}
