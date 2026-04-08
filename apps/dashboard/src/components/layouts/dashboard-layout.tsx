import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Outlet } from "@tanstack/react-router";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { DashboardTopbar } from "./dashboard-topbar";

const routeApi = getRouteApi("/_protected");

export function DashboardLayout() {
	const { user } = routeApi.useRouteContext();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const pullsQuery = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});
	const issuesQuery = useQuery({
		...githubMyIssuesQueryOptions(scope),
		enabled: hasMounted,
	});
	const pullCount = pullsQuery.data
		? pullsQuery.data.reviewRequested.length +
			pullsQuery.data.assigned.length +
			pullsQuery.data.authored.length +
			pullsQuery.data.mentioned.length +
			pullsQuery.data.involved.length
		: undefined;
	const issueCount = issuesQuery.data
		? issuesQuery.data.assigned.length +
			issuesQuery.data.authored.length +
			issuesQuery.data.mentioned.length
		: undefined;
	const tabsReady = hasMounted && Boolean(pullsQuery.data && issuesQuery.data);

	return (
		<div className="flex h-dvh flex-col bg-muted">
			<DashboardTopbar
				user={user}
				tabsReady={tabsReady}
				counts={{
					pulls: pullCount,
					issues: issueCount,
					reviews: pullsQuery.data?.reviewRequested.length,
				}}
			/>
			<div className="flex flex-1 flex-col overflow-hidden p-2 pt-0">
				<div className="flex-1 overflow-hidden rounded-xl border bg-card shadow-[0_1px_4px_0_rgba(0,0,0,0.03)]">
					<div className="h-full">
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
}
