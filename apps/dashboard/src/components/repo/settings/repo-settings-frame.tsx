import {
	ActionsIcon,
	GitBranchIcon,
	LabelIcon,
	LinkIcon,
	SettingsIcon,
	UserMultiple02Icon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { SettingsNavItem } from "@diffkit/ui/components/settings-nav";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Skeleton } from "skullet/react";
import {
	SettingsNotice,
	SettingsRowsSample,
} from "#/components/settings/settings-read";
import { SettingsShell } from "#/components/settings/settings-shell";
import {
	type GitHubQueryScope,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import {
	type RepoSettingsCapabilities,
	repoSettingsCapabilities,
} from "#/lib/settings/permissions";
import { RepoPageHeader } from "../repo-page-header";

type RepoSettingsAccess =
	| { status: "loading" }
	| { status: "ready"; capabilities: RepoSettingsCapabilities };

export function useRepoSettingsAccess(
	scope: GitHubQueryScope,
	owner: string,
	repo: string,
): RepoSettingsAccess {
	const query = useQuery(
		githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
	);
	if (query.isPending) return { status: "loading" };
	return {
		status: "ready",
		capabilities: repoSettingsCapabilities(query.data?.permission ?? null),
	};
}

export function RepoSettingsFrame({
	owner,
	repo,
	scope,
	children,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	children: ReactNode;
}) {
	const access = useRepoSettingsAccess(scope, owner, repo);
	const capabilities =
		access.status === "ready" ? access.capabilities : undefined;
	const params = { owner, repo };

	return (
		<RepoPageHeader owner={owner} repo={repo} scope={scope} active="settings">
			<SettingsShell
				navLabel="Repository settings"
				nav={
					<>
						{capabilities?.administer ? (
							<>
								<SettingsNavItem asChild>
									<Link
										to="/$owner/$repo/settings"
										params={params}
										activeOptions={{ exact: true }}
									>
										<SettingsIcon size={14} />
										General
									</Link>
								</SettingsNavItem>
								<SettingsNavItem asChild>
									<Link to="/$owner/$repo/settings/branches" params={params}>
										<GitBranchIcon size={14} />
										Branches &amp; rules
									</Link>
								</SettingsNavItem>
								<SettingsNavItem asChild>
									<Link to="/$owner/$repo/settings/access" params={params}>
										<UserMultiple02Icon size={14} />
										Collaborators &amp; teams
									</Link>
								</SettingsNavItem>
								<SettingsNavItem asChild>
									<Link to="/$owner/$repo/settings/webhooks" params={params}>
										<LinkIcon size={14} />
										Webhooks
									</Link>
								</SettingsNavItem>
								<SettingsNavItem asChild>
									<Link to="/$owner/$repo/settings/actions" params={params}>
										<ActionsIcon size={14} />
										Actions
									</Link>
								</SettingsNavItem>
							</>
						) : null}
						{capabilities?.manageLabels ? (
							<SettingsNavItem asChild>
								<Link to="/$owner/$repo/settings/labels" params={params}>
									<LabelIcon size={14} />
									Labels
								</Link>
							</SettingsNavItem>
						) : null}
					</>
				}
			>
				{children}
			</SettingsShell>
		</RepoPageHeader>
	);
}

export function RepoSettingsGate({
	owner,
	repo,
	scope,
	need,
	children,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	need: keyof RepoSettingsCapabilities;
	children: ReactNode;
}) {
	const access = useRepoSettingsAccess(scope, owner, repo);

	return (
		<Skeleton loading={access.status === "loading"} label="Loading settings">
			<div className="flex flex-col gap-8">
				<RepoSettingsGateContent
					access={access}
					owner={owner}
					repo={repo}
					need={need}
				>
					{children}
				</RepoSettingsGateContent>
			</div>
		</Skeleton>
	);
}

function RepoSettingsGateContent({
	access,
	owner,
	repo,
	need,
	children,
}: {
	access: RepoSettingsAccess;
	owner: string;
	repo: string;
	need: keyof RepoSettingsCapabilities;
	children: ReactNode;
}) {
	if (access.status === "loading") return <SettingsRowsSample />;
	if (access.capabilities[need]) return <>{children}</>;
	const canManageLabels = access.capabilities.manageLabels;
	return (
		<SettingsNotice
			title="You don't have access to this page"
			action={
				<Button asChild variant="outline" size="sm">
					{canManageLabels ? (
						<Link to="/$owner/$repo/settings/labels" params={{ owner, repo }}>
							Go to labels
						</Link>
					) : (
						<Link to="/$owner/$repo" params={{ owner, repo }}>
							Back to {owner}/{repo}
						</Link>
					)}
				</Button>
			}
		>
			{need === "administer"
				? "These settings are for repository admins."
				: "Managing labels needs triage access or higher."}
		</SettingsNotice>
	);
}
