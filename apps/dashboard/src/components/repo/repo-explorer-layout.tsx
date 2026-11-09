import { FolderIcon, PanelLeftIcon } from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { Skeleton, SkeletonBox } from "skullet/react";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import { type CodeView, isCommitSha } from "#/lib/code-browsing/code-location";
import { parentPath } from "#/lib/code-browsing/tree-index";
import { setExplorerPath } from "#/lib/explorer-path-store";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";
import { useRegisterTab } from "#/lib/use-register-tab";
import { BranchComparisonBanner } from "./branch-comparison-banner";
import { BlameView } from "./code/blame-view";
import type { BlobLocation } from "./code/blob-header";
import { CodePathHeader } from "./code/code-path-header";
import {
	type DirectoryListing,
	useDirectoryListing,
} from "./code/use-directory-listing";
import { CodeFileView } from "./code-file-view";
import { FolderView } from "./folder-view";
import { RepoFileTreeSidebar } from "./repo-file-tree-sidebar";
import { RepoHeader } from "./repo-header";
import { SAMPLE_TREE_ENTRIES } from "./repo-samples";
import { iconButtonClassName, RepoCard, RepoEmptyState } from "./repo-ui";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void) {
	const query = window.matchMedia(DESKTOP_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

function useIsDesktop() {
	return useSyncExternalStore(
		subscribeDesktop,
		() => window.matchMedia(DESKTOP_QUERY).matches,
		() => true,
	);
}

type ExplorerProps = {
	scope: GitHubQueryScope;
	repo: RepoOverview;
	location: BlobLocation;
	view: CodeView;
};

export function RepoExplorerLayout({
	scope,
	repo,
	location,
	view,
}: ExplorerProps) {
	const isDesktop = useIsDesktop();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { owner, repo: repoName, ref, path } = location;

	setExplorerPath(path);

	useRegisterTab({
		type: "repo",
		title: `${owner}/${repo.name}`,
		url: `/${owner}/${repoName}`,
		repo: `${owner}/${repoName}`,
		iconColor: "text-muted-foreground",
		avatarUrl: repo.ownerAvatarUrl,
	});

	const sidebar = (
		<RepoFileTreeSidebar
			owner={owner}
			repoName={repoName}
			currentRef={ref}
			scope={scope}
		/>
	);

	const content = (
		<div className="h-full overflow-y-auto">
			<CodePathHeader
				scope={scope}
				repo={repo}
				location={location}
				view={view}
				leading={
					isDesktop ? null : (
						<button
							type="button"
							onClick={() => setDrawerOpen(true)}
							className={iconButtonClassName}
							aria-label="Open file tree"
						>
							<PanelLeftIcon size={16} strokeWidth={2} />
						</button>
					)
				}
			/>
			<div className="mx-auto flex max-w-[1080px] flex-col gap-3 px-3 pt-3 pb-16 md:px-6 md:pt-4">
				{ref !== repo.defaultBranch && !isCommitSha(ref) ? (
					<BranchComparisonBanner
						owner={owner}
						repo={repoName}
						scope={scope}
						currentBranch={ref}
						defaultBranch={repo.defaultBranch}
					/>
				) : null}
				<ExplorerContent
					scope={scope}
					repo={repo}
					location={location}
					view={view}
				/>
			</div>
		</div>
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader owner={owner} repo={repoName} scope={scope} active="code" />
			<div className="flex min-h-0 flex-1 border-t-[0.5px] border-header-rule">
				{isDesktop ? (
					<ResizablePanelGroup direction="horizontal" className="flex-1">
						<ResizablePanel defaultSize={22} minSize={14} maxSize={40}>
							{sidebar}
						</ResizablePanel>
						<ResizableHandle className="w-[0.5px] bg-header-rule" />
						<ResizablePanel defaultSize={78}>{content}</ResizablePanel>
					</ResizablePanelGroup>
				) : (
					<>
						<div className="min-w-0 flex-1 overflow-hidden">{content}</div>
						<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
							<DrawerContent className="max-h-[70dvh]">
								<DrawerTitle className="sr-only">File tree</DrawerTitle>
								{sidebar}
							</DrawerContent>
						</Drawer>
					</>
				)}
			</div>
		</div>
	);
}

function ExplorerContent({ scope, repo, location, view }: ExplorerProps) {
	switch (view) {
		case "tree":
			return <TreeContent scope={scope} repo={repo} location={location} />;
		case "blob":
			return <BlobRouteContent scope={scope} location={location} />;
		case "blame":
			return <BlameView scope={scope} location={location} />;
	}
}

function TreeContent({ scope, repo, location }: Omit<ExplorerProps, "view">) {
	const listing = useDirectoryListing(scope, location);
	return (
		<DirectoryListingView
			listing={listing}
			missing={
				<RepoEmptyState
					icon={<FolderIcon />}
					title={`${location.path} doesn't exist at ${location.ref}`}
					action={<BrowseRefLink location={location} />}
				/>
			}
		>
			{(entries) => (
				<FolderView
					entries={entries}
					repo={repo}
					owner={location.owner}
					repoName={location.repo}
					currentRef={location.ref}
					currentPath={location.path}
					scope={scope}
				/>
			)}
		</DirectoryListingView>
	);
}

type DirectoryListingViewProps = {
	listing: DirectoryListing;
	missing: ReactNode;
	children: (
		entries: Extract<DirectoryListing, { status: "ready" }>["entries"],
	) => ReactNode;
};

function DirectoryListingView(props: DirectoryListingViewProps) {
	return (
		<Skeleton
			loading={props.listing.status === "loading"}
			label="Loading folder"
		>
			<DirectoryListingBody {...props} />
		</Skeleton>
	);
}

function DirectoryListingBody({
	listing,
	missing,
	children,
}: DirectoryListingViewProps) {
	switch (listing.status) {
		case "loading":
			return <SkeletonSample>{children(SAMPLE_TREE_ENTRIES)}</SkeletonSample>;
		case "missing":
			return <RepoCard>{missing}</RepoCard>;
		case "error":
			return (
				<RepoCard>
					<RepoEmptyState title="Couldn't load this folder">
						{listing.error.message}
					</RepoEmptyState>
				</RepoCard>
			);
		case "ready":
			return <>{children(listing.entries)}</>;
	}
}

function BlobRouteContent({
	scope,
	location,
}: {
	scope: GitHubQueryScope;
	location: BlobLocation;
}) {
	const parent = useDirectoryListing(scope, {
		...location,
		path: parentPath(location.path),
	});
	const entry =
		parent.status === "ready"
			? parent.entries.find((candidate) => candidate.path === location.path)
			: undefined;
	return <CodeFileView scope={scope} location={location} entry={entry} />;
}

function BrowseRefLink({ location }: { location: BlobLocation }) {
	return (
		<Link
			to="/$owner/$repo/tree/$"
			params={{
				owner: location.owner,
				repo: location.repo,
				_splat: location.ref,
			}}
			className="text-[13px] font-medium text-foreground hover:underline"
		>
			Browse {location.ref}
		</Link>
	);
}

export function ExplorerSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 border-t-[0.5px] border-header-rule">
			<div className="hidden w-[22%] shrink-0 flex-col gap-2 border-r-[0.5px] border-header-rule p-3 md:flex">
				<SkeletonBox width="100%" height={28} radius={8} />
				{["a", "b", "c", "d", "e", "f"].map((key) => (
					<SkeletonBox key={key} width="75%" height={16} radius={4} />
				))}
			</div>
			<div className="flex-1">
				<div className="flex h-11 items-center gap-2 border-b-[0.5px] border-header-rule px-4">
					<SkeletonBox width={96} height={28} radius={6} />
					<SkeletonBox width={192} height={16} radius={4} />
				</div>
				<div className="px-6 pt-4">
					<SkeletonBox width="100%" height={256} radius={8} />
				</div>
			</div>
		</div>
	);
}
