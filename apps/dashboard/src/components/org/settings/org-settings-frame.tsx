import {
	SettingsIcon,
	UserCircleIcon,
	UserMultiple02Icon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { SettingsNavItem } from "@diffkit/ui/components/settings-nav";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	SettingsNotice,
	SettingsSkeleton,
} from "#/components/settings/settings-read";
import { SettingsShell } from "#/components/settings/settings-shell";
import {
	type GitHubQueryScope,
	githubOrgViewerRoleQueryOptions,
} from "#/lib/github.query";
import {
	type OrgSettingsCapabilities,
	orgSettingsCapabilities,
} from "#/lib/settings/org";

type OrgSettingsAccess =
	| { status: "loading" }
	| { status: "member"; capabilities: OrgSettingsCapabilities }
	| { status: "outsider" };

export function useOrgSettingsAccess(
	scope: GitHubQueryScope,
	org: string,
): OrgSettingsAccess {
	const query = useQuery(githubOrgViewerRoleQueryOptions(scope, { org }));
	if (query.isPending) return { status: "loading" };
	const result = query.data;
	if (result?.status !== "ok" || result.data === null) {
		return { status: "outsider" };
	}
	return {
		status: "member",
		capabilities: orgSettingsCapabilities(result.data),
	};
}

export function OrgSettingsFrame({
	org,
	scope,
	children,
}: {
	org: string;
	scope: GitHubQueryScope;
	children: ReactNode;
}) {
	const access = useOrgSettingsAccess(scope, org);
	const params = { org };

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader>
				<PageHeaderCrumb asChild>
					<Link to="/$owner" params={{ owner: org }}>
						{org}
					</Link>
				</PageHeaderCrumb>
				<PageHeaderTitle>Settings</PageHeaderTitle>
			</PageHeader>
			<div className="min-h-0 flex-1 overflow-y-auto pb-10">
				<SettingsShell
					navLabel="Organization settings"
					nav={
						<>
							<SettingsNavItem asChild>
								<Link
									to="/orgs/$org/settings"
									params={params}
									activeOptions={{ exact: true }}
								>
									<SettingsIcon size={14} />
									General
								</Link>
							</SettingsNavItem>
							<SettingsNavItem asChild>
								<Link to="/orgs/$org/settings/members" params={params}>
									<UserCircleIcon size={14} />
									Members
								</Link>
							</SettingsNavItem>
							<SettingsNavItem asChild>
								<Link to="/orgs/$org/settings/teams" params={params}>
									<UserMultiple02Icon size={14} />
									Teams
								</Link>
							</SettingsNavItem>
						</>
					}
				>
					{access.status === "loading" ? <SettingsSkeleton /> : null}
					{access.status === "outsider" ? (
						<SettingsNotice
							title="You're not a member of this organization"
							action={
								<Button asChild variant="outline" size="sm">
									<Link to="/$owner" params={{ owner: org }}>
										Back to {org}
									</Link>
								</Button>
							}
						>
							Only members can see its settings.
						</SettingsNotice>
					) : null}
					{access.status === "member" ? children : null}
				</SettingsShell>
			</div>
		</div>
	);
}
