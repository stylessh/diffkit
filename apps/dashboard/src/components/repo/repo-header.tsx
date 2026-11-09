import { LockIcon } from "@diffkit/icons";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	RepoNav,
	type RepoNavKey,
	repoSectionLabel,
} from "#/components/repo/repo-nav";
import { RepoStarForkActions } from "#/components/repo/repo-star-fork-actions";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { repoSettingsCapabilities } from "#/lib/settings/permissions";
import { useHasMounted } from "#/lib/use-has-mounted";
import { HairlineBadge } from "./repo-ui";

function useRepoHeaderData(
	owner: string,
	repo: string,
	scope: GitHubQueryScope,
) {
	const hasMounted = useHasMounted();
	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const permissionQuery = useQuery({
		...githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const showSettings = repoSettingsCapabilities(
		permissionQuery.data?.permission ?? null,
	).openSettings;
	return { repoData: overviewQuery.data, showSettings };
}

type RepoNavProps = {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	active?: RepoNavKey;
	tabActions?: ReactNode;
};

export function RepoHeaderNav({
	owner,
	repo,
	scope,
	active,
	tabActions,
}: RepoNavProps) {
	const { repoData, showSettings } = useRepoHeaderData(owner, repo, scope);
	return (
		<RepoNav
			owner={owner}
			repo={repo}
			active={active}
			repoData={repoData}
			actions={tabActions}
			showSettings={showSettings}
		/>
	);
}

export function RepoHeader({
	owner,
	repo,
	scope,
	active,
	trail,
	tabActions,
	withNav = true,
}: RepoNavProps & {
	trail?: ReactNode;
	withNav?: boolean;
}) {
	const { repoData, showSettings } = useRepoHeaderData(owner, repo, scope);
	const name = repoData?.name ?? repo;
	const section = active && active !== "code" ? active : null;

	const repoIcon = repoData?.ownerAvatarUrl ? (
		<img
			src={repoData.ownerAvatarUrl}
			alt=""
			className="size-4 shrink-0 rounded-[4px] ring-[0.5px] ring-chip-border"
		/>
	) : (
		<span aria-hidden className="size-4 shrink-0 rounded-[4px] bg-group" />
	);

	const title = (
		<>
			{repoIcon}
			<span className="truncate">
				<Link
					to="/$owner"
					params={{ owner }}
					className="rounded-sm text-text-header transition-colors hover:text-foreground"
				>
					{owner}
				</Link>
				<span className="text-muted-foreground">/</span>
				{name}
			</span>
		</>
	);

	return (
		<>
			<PageHeader
				actions={
					repoData ? (
						<RepoStarForkActions repo={repoData} scope={scope} />
					) : null
				}
			>
				{trail ? (
					<>
						<PageHeaderCrumb asChild>
							<Link to="/$owner/$repo" params={{ owner, repo }}>
								{repoIcon}
								<span className="truncate">
									{owner}/{name}
								</span>
							</Link>
						</PageHeaderCrumb>
						{trail}
					</>
				) : (
					<>
						{section ? (
							<PageHeaderTitle className="gap-2" asChild>
								<span>{title}</span>
							</PageHeaderTitle>
						) : (
							<PageHeaderTitle className="gap-2">{title}</PageHeaderTitle>
						)}
						{repoData ? (
							<HairlineBadge className="ml-2 gap-1">
								{repoData.isPrivate ? <LockIcon size={10} /> : null}
								{repoData.isPrivate ? "Private" : "Public"}
							</HairlineBadge>
						) : null}
					</>
				)}
			</PageHeader>
			{section ? (
				<h1 className="sr-only">{repoSectionLabel(section)}</h1>
			) : null}
			{withNav ? (
				<RepoNav
					owner={owner}
					repo={repo}
					active={active}
					repoData={repoData}
					actions={tabActions}
					showSettings={showSettings}
				/>
			) : null}
		</>
	);
}
