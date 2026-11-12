import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { RepoLinks } from "./code-link";
import { formatShortDate } from "./map-format";
import type { MapIcon } from "./map-icons";

export function PersonAvatar({
	login,
	bot,
	title,
	className,
}: {
	login: string;
	bot: boolean;
	title?: string;
	className?: string;
}) {
	return (
		<Avatar className={cn("size-5", className)} title={title}>
			{bot ? null : (
				<AvatarImage src={`https://github.com/${login}.png?size=40`} alt="" />
			)}
			<AvatarFallback className="text-[8px]">
				{login.slice(0, 2).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	);
}

const rowClassName =
	"flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-row-hover";

/** One pull request or issue, opening its DiffKit page. */
export function WorkRow({
	kind,
	repo,
	icon: Icon,
	iconClassName,
	number,
	title,
	author,
	bot,
	date,
	note,
}: {
	kind: "pull" | "issue";
	repo: RepoLinks;
	icon: MapIcon;
	iconClassName: string;
	number: number;
	title: string;
	author: string;
	bot: boolean;
	date: string;
	note?: string;
}) {
	const content = (
		<>
			<Icon
				size={14}
				strokeWidth={2}
				className={cn("shrink-0", iconClassName)}
			/>
			<span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
				{title}
			</span>
			<span className="shrink-0 font-[450] text-muted-foreground text-xs tabular-nums">
				#{number}
			</span>
			<PersonAvatar
				login={author}
				bot={bot}
				title={author}
				className="size-4 shrink-0"
			/>
			<time
				dateTime={date}
				className="min-w-11 shrink-0 text-right font-[450] text-muted-foreground text-xs tabular-nums"
			>
				{formatShortDate(date)}
			</time>
		</>
	);
	const params = { owner: repo.owner, repo: repo.repo };
	return kind === "pull" ? (
		<Link
			to="/$owner/$repo/pull/$pullId"
			params={{ ...params, pullId: String(number) }}
			title={note}
			className={rowClassName}
		>
			{content}
		</Link>
	) : (
		<Link
			to="/$owner/$repo/issues/$issueId"
			params={{ ...params, issueId: String(number) }}
			title={note}
			className={rowClassName}
		>
			{content}
		</Link>
	);
}
