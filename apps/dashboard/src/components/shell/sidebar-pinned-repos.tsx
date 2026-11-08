import { MoreHorizontalIcon, PlusSignIcon, RepoIcon } from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { openRepoPicker } from "#/lib/shell/shell-overlay";
import { useCurrentRepo } from "#/lib/shell/use-shell-actions";
import {
	canPinMoreRepos,
	type RepoRef,
	repoFullName,
	updateWorkspaceRepos,
	useWorkspaceRepos,
	withoutPinnedRepo,
} from "#/lib/shell/workspace-repos";
import {
	RailTooltip,
	type SidebarDensity,
	SidebarSection,
	sidebarRowClassName,
} from "./sidebar-nav";

function isSameRepo(a: RepoRef | null, b: RepoRef) {
	return (
		a !== null &&
		repoFullName(a).toLowerCase() === repoFullName(b).toLowerCase()
	);
}

function PinnedRepoRow({
	repo,
	userId,
	active,
	density,
}: {
	repo: RepoRef;
	userId: string;
	active: boolean;
	density: SidebarDensity;
}) {
	const fullName = repoFullName(repo);
	const link = (
		<Link
			to="/$owner/$repo"
			params={{ owner: repo.owner, repo: repo.name }}
			preload="intent"
			aria-label={density === "rail" ? fullName : undefined}
			aria-current={active ? "page" : undefined}
			className={cn(
				sidebarRowClassName(density),
				density === "full" && "flex-1 pr-8",
				active && "bg-nav-selected text-foreground",
			)}
		>
			<RepoIcon size={14} strokeWidth={2} className="shrink-0" />
			{density === "full" ? (
				<span className="truncate">
					<span className="text-muted-foreground">{repo.owner}/</span>
					{repo.name}
				</span>
			) : null}
		</Link>
	);

	if (density === "rail") {
		return (
			<RailTooltip density={density} label={fullName}>
				{link}
			</RailTooltip>
		);
	}

	return (
		<div className="group/pin relative flex">
			{link}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={`${fullName} options`}
						className="absolute top-0.5 right-4 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/pin:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
					>
						<MoreHorizontalIcon size={14} strokeWidth={2} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-48">
					<DropdownMenuItem
						onSelect={() =>
							updateWorkspaceRepos(userId, (state) =>
								withoutPinnedRepo(state, repo),
							)
						}
					>
						Unpin
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export function SidebarPinnedRepos({
	userId,
	density,
}: {
	userId: string;
	density: SidebarDensity;
}) {
	const workspace = useWorkspaceRepos(userId);
	const currentRepo = useCurrentRepo();
	const canPin = canPinMoreRepos(workspace);
	const pinRepo = () => openRepoPicker({ kind: "pin" });

	return (
		<SidebarSection
			label="Repositories"
			labelTo="/repos"
			density={density}
			action={
				canPin && workspace.pinned.length > 0 ? (
					<button
						type="button"
						aria-label="Pin a repository"
						onClick={pinRepo}
						className="flex size-5 items-center justify-center rounded-md hover:text-foreground"
					>
						<PlusSignIcon size={12} strokeWidth={2} />
					</button>
				) : null
			}
		>
			{workspace.pinned.map((repo) => (
				<PinnedRepoRow
					key={repoFullName(repo)}
					repo={repo}
					userId={userId}
					active={isSameRepo(currentRepo, repo)}
					density={density}
				/>
			))}
			{workspace.pinned.length === 0 ? (
				<RailTooltip density={density} label="Pin a repository">
					<button
						type="button"
						onClick={pinRepo}
						aria-label={density === "rail" ? "Pin a repository" : undefined}
						className={cn(
							sidebarRowClassName(density),
							"text-muted-foreground",
						)}
					>
						<PlusSignIcon size={14} strokeWidth={2} className="shrink-0" />
						{density === "full" ? (
							<span className="truncate">Pin a repository</span>
						) : null}
					</button>
				</RailTooltip>
			) : null}
		</SidebarSection>
	);
}
