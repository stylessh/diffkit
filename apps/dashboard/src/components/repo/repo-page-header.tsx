import { cn } from "@diffkit/ui/lib/utils";
import type { ReactNode, RefObject } from "react";
import {
	ActiveFilters,
	ListActions,
	type ListFiltersConfig,
} from "#/components/filters/list-toolbar";
import { RepoHeader } from "#/components/repo/repo-header";
import type { RepoNavKey } from "#/components/repo/repo-nav";
import { SearchQueryProvider } from "#/components/shared/search-highlight";
import type { GitHubQueryScope } from "#/lib/github.query";

export function RepoPageHeader({
	owner,
	repo,
	scope,
	active,
	trail,
	tabActions,
	filters,
	toolbar,
	searchQuery = "",
	scrollRef,
	bodyClassName,
	children,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	active?: RepoNavKey;
	trail?: ReactNode;
	tabActions?: ReactNode;
	filters?: ListFiltersConfig;
	toolbar?: ReactNode;
	searchQuery?: string;
	scrollRef?: RefObject<HTMLDivElement | null>;
	bodyClassName?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active={active}
				trail={trail}
				tabActions={
					tabActions || filters ? (
						<>
							{tabActions}
							{filters ? <ListActions {...filters} /> : null}
						</>
					) : undefined
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col border-t-[0.5px] border-header-rule">
				{filters ? <ActiveFilters {...filters} /> : null}
				{toolbar}
				<div
					ref={scrollRef}
					className={cn(
						"min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-10",
						bodyClassName,
					)}
				>
					<SearchQueryProvider
						query={filters?.state.searchQuery ?? searchQuery}
					>
						{children}
					</SearchQueryProvider>
				</div>
			</div>
		</div>
	);
}

export { PageHeaderCrumb as RepoCrumb } from "@diffkit/ui/components/page-header";
