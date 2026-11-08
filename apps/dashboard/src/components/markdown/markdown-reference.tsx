import { GitCommitIcon, PackageIcon, RepoIcon } from "@diffkit/icons";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@diffkit/ui/components/hover-card";
import type {
	MarkdownReferenceProps,
	ResourceReference,
	ResourceReferenceOrigin,
} from "@diffkit/ui/components/markdown";
import { markdownLinkClassName } from "@diffkit/ui/lib/markdown-theme";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useState } from "react";
import {
	githubCommitReferenceQueryOptions,
	githubItemReferenceQueryOptions,
} from "#/lib/github.query";
import { issuePath, pullPath } from "#/lib/github-links";
import {
	cachedCommitReference,
	cachedItemReference,
} from "#/lib/reference-placeholders";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { useInView } from "#/lib/use-in-view";
import {
	CommitHoverCard,
	cardState,
	ItemHoverCard,
	itemAppearance,
	itemHref,
} from "./reference-hover-cards";

type Ref<K extends ResourceReference["kind"]> = Extract<
	ResourceReference,
	{ kind: K }
>;

const chipClassName =
	"inline-flex max-w-full items-baseline gap-1 rounded-[5px] bg-chip px-1 align-baseline text-[0.93em] leading-[1.45] font-medium text-foreground no-underline shadow-chip transition-colors hover:bg-item-hover";

const chipIconClassName = "shrink-0 self-center";

function isPlainLeftClick(event: MouseEvent) {
	return (
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey
	);
}

function ReferenceHoverCard({
	trigger,
	children,
	onOpenChange,
}: {
	trigger: ReactNode;
	children: ReactNode;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<HoverCard openDelay={350} onOpenChange={onOpenChange}>
			<HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
			<HoverCardContent align="start" className="w-80">
				{children}
			</HoverCardContent>
		</HoverCard>
	);
}

function ItemReferenceLink({
	reference,
	origin,
	children,
}: {
	reference: Ref<"pull" | "issue" | "issueOrPull">;
	origin: ResourceReferenceOrigin;
	children?: ReactNode;
}) {
	const scope = useGitHubQueryScope();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const { ref, inView } = useInView<HTMLAnchorElement>(origin === "url");
	const input = {
		owner: reference.owner,
		repo: reference.repo,
		number: reference.number,
	};
	const options = githubItemReferenceQueryOptions(scope, input);
	const query = useQuery({
		...options,
		enabled: open || inView,
		placeholderData: () => cachedItemReference(queryClient, scope, input),
	});
	const item = query.data ?? null;
	const href = item
		? itemHref(item)
		: reference.kind === "pull"
			? pullPath(reference, reference.number)
			: issuePath(reference, reference.number);

	const resolveKindThenNavigate = async (event: MouseEvent) => {
		if (item || reference.kind !== "issueOrPull" || !isPlainLeftClick(event)) {
			return;
		}
		event.preventDefault();
		const resolved = await queryClient.fetchQuery(options).catch(() => null);
		await navigate({ to: resolved ? itemHref(resolved) : href });
	};

	const label = `${reference.owner}/${reference.repo}#${reference.number}`;
	const appearance = item ? itemAppearance(item) : null;
	const Icon = appearance?.icon;
	const trigger =
		origin === "url" ? (
			<Link
				ref={ref}
				to={href}
				onClick={resolveKindThenNavigate}
				className={chipClassName}
			>
				{Icon ? (
					<Icon
						size={12}
						strokeWidth={2}
						className={cn(chipIconClassName, appearance.color)}
					/>
				) : null}
				{item ? <span className="truncate">{item.title}</span> : null}
				<span className="shrink-0 tabular-nums text-muted-foreground">
					{item ? `#${reference.number}` : label}
				</span>
			</Link>
		) : (
			<Link
				ref={ref}
				to={href}
				onClick={resolveKindThenNavigate}
				className={markdownLinkClassName}
			>
				{children}
			</Link>
		);

	return (
		<ReferenceHoverCard trigger={trigger} onOpenChange={setOpen}>
			<ItemHoverCard state={cardState(query)} label={label} />
		</ReferenceHoverCard>
	);
}

function CommitReferenceLink({
	reference,
	origin,
	children,
}: {
	reference: Ref<"commit">;
	origin: ResourceReferenceOrigin;
	children?: ReactNode;
}) {
	const scope = useGitHubQueryScope();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const input = {
		owner: reference.owner,
		repo: reference.repo,
		sha: reference.sha,
	};
	const query = useQuery({
		...githubCommitReferenceQueryOptions(scope, input),
		enabled: open,
		placeholderData: () => cachedCommitReference(queryClient, scope, input),
	});

	const trigger = (
		<Link
			to={reference.href}
			className={cn(
				origin === "url" ? chipClassName : markdownLinkClassName,
				"font-mono text-[0.9em]",
			)}
		>
			{origin === "url" ? (
				<GitCommitIcon
					size={12}
					strokeWidth={2}
					className={cn(chipIconClassName, "text-muted-foreground")}
				/>
			) : null}
			{children}
		</Link>
	);

	return (
		<ReferenceHoverCard trigger={trigger} onOpenChange={setOpen}>
			<CommitHoverCard
				state={cardState(query)}
				label={`Commit ${reference.sha.slice(0, 7)}`}
			/>
		</ReferenceHoverCard>
	);
}

function PlainReferenceChip({
	href,
	icon,
	children,
}: {
	href: string;
	icon: ReactNode;
	children?: ReactNode;
}) {
	return (
		<Link to={href} className={chipClassName}>
			<span className={chipIconClassName}>{icon}</span>
			<span className="truncate">{children}</span>
		</Link>
	);
}

export function MarkdownReference({
	reference,
	origin,
	children,
}: MarkdownReferenceProps) {
	switch (reference.kind) {
		case "pull":
		case "issue":
		case "issueOrPull":
			return (
				<ItemReferenceLink reference={reference} origin={origin}>
					{children}
				</ItemReferenceLink>
			);
		case "commit":
			return (
				<CommitReferenceLink reference={reference} origin={origin}>
					{children}
				</CommitReferenceLink>
			);
		case "repo":
			return (
				<PlainReferenceChip
					href={reference.href}
					icon={
						<RepoIcon
							size={12}
							strokeWidth={2}
							className="text-muted-foreground"
						/>
					}
				>
					{children}
				</PlainReferenceChip>
			);
		case "release":
			return (
				<PlainReferenceChip
					href={reference.href}
					icon={
						<PackageIcon
							size={12}
							strokeWidth={2}
							className="text-muted-foreground"
						/>
					}
				>
					{reference.tag}
				</PlainReferenceChip>
			);
		case "user":
			return (
				<Link to={reference.href} className={markdownLinkClassName}>
					{children}
				</Link>
			);
	}
}
