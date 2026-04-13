import {
	BuildingIcon,
	ChevronDownIcon,
	ExternalLinkIcon,
	FollowersIcon,
	LocationIcon,
	PenIcon,
} from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { Button } from "@diffkit/ui/components/button";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ContributionGraph } from "#/components/profile/contribution-graph";
import { PinnedRepoCard } from "#/components/profile/pinned-repo-card";
import { UserActivityFeed } from "#/components/profile/user-activity-feed";
import {
	githubUserActivityQueryOptions,
	githubUserContributionsQueryOptions,
	githubUserPinnedReposQueryOptions,
	githubUserProfileQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type { GitHubUserProfile } from "#/lib/github.types";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/$owner/")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubUserProfileQueryOptions(scope, params.owner),
		);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));
		void context.queryClient.prefetchQuery(
			githubUserPinnedReposQueryOptions(scope, params.owner),
		);
		void context.queryClient.prefetchQuery(
			githubUserContributionsQueryOptions(scope, params.owner),
		);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`@${params.owner}`),
			description: `GitHub profile for ${params.owner}.`,
			robots: "noindex",
		}),
	component: ProfilePage,
});

function ProfilePage() {
	const { owner } = Route.useParams();
	const { user } = Route.useRouteContext();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	// Server-side: available immediately from loader
	const profileQuery = useQuery(githubUserProfileQueryOptions(scope, owner));
	const viewerQuery = useQuery(githubViewerQueryOptions(scope));
	const pinnedReposQuery = useQuery(
		githubUserPinnedReposQueryOptions(scope, owner),
	);

	// Client-side: load after mount
	const contributionsQuery = useQuery({
		...githubUserContributionsQueryOptions(scope, owner),
		enabled: hasMounted,
	});

	const profile = profileQuery.data;
	const contributions = contributionsQuery.data;
	const pinnedRepos = pinnedReposQuery.data;
	const isOwnProfile = viewerQuery.data?.login === owner;

	const activityQuery = useInfiniteQuery({
		...githubUserActivityQueryOptions(scope, owner, isOwnProfile),
		enabled: hasMounted && viewerQuery.data !== undefined,
	});
	const activity = activityQuery.data?.pages.flat();

	if (profileQuery.error) throw profileQuery.error;
	if (profileQuery.data === null) throw new Error("Not found");

	return (
		<div className="overflow-stable h-full">
			{/* Banner — contribution graph with aurora overlay */}
			<div className="relative h-48 overflow-hidden sm:h-56">
				{contributions ? (
					<>
						{/* Contribution graph */}
						<ContributionGraph
							calendar={contributions}
							className="absolute inset-0 opacity-60 dark:opacity-40"
						/>

						{/* Edge fades */}
						<div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
						<div className="pointer-events-none absolute left-0 top-0 h-full w-48 bg-gradient-to-r from-card to-transparent" />
						<div className="pointer-events-none absolute right-0 top-0 h-full w-48 bg-gradient-to-l from-card to-transparent" />
					</>
				) : null}
			</div>

			{/* Profile content */}
			<div className="relative mx-auto max-w-3xl px-6">
				{/* Avatar — overlaps the banner */}
				<div className="-mt-16 flex items-end justify-between sm:-mt-20">
					<Avatar className="size-28 border-4 border-card sm:size-32">
						{profile ? (
							<>
								<AvatarImage src={profile.avatarUrl} alt={profile.login} />
								<AvatarFallback>
									{(profile.name ?? profile.login).charAt(0).toUpperCase()}
								</AvatarFallback>
							</>
						) : (
							<Skeleton className="size-full rounded-full" />
						)}
					</Avatar>

					{isOwnProfile && (
						<Button variant="ghost" size="icon" className="mb-1 size-8" asChild>
							<a
								href={`https://github.com/settings/profile`}
								target="_blank"
								rel="noopener noreferrer"
							>
								<PenIcon size={14} strokeWidth={2} />
							</a>
						</Button>
					)}
				</div>

				{/* User info */}
				{profile ? (
					<div className="mt-3 flex flex-col gap-3 pb-8">
						<div className="flex flex-col gap-0.5">
							<h1 className="text-2xl font-semibold tracking-tight">
								{profile.name ?? profile.login}
							</h1>
							<div className="flex items-center gap-2 text-base text-muted-foreground">
								<span>@{profile.login}</span>
								<span className="text-border">·</span>
								<span className="text-sm">
									Joined{" "}
									{new Date(profile.createdAt).toLocaleDateString("en-US", {
										month: "long",
										year: "numeric",
									})}
								</span>
							</div>
						</div>

						{profile.bio && (
							<p className="max-w-lg text-sm leading-relaxed">{profile.bio}</p>
						)}

						{/* Metadata row */}
						<ProfileMetadata profile={profile} />

						{/* Followers / Following */}
						<div className="flex items-center gap-4 text-sm">
							<a
								href={`https://github.com/${profile.login}?tab=followers`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
							>
								<FollowersIcon size={15} strokeWidth={1.75} />
								<span className="font-semibold text-foreground">
									{formatCount(profile.followers)}
								</span>
								<span>
									{profile.followers === 1 ? "follower" : "followers"}
								</span>
							</a>
							<span className="text-border">·</span>
							<a
								href={`https://github.com/${profile.login}?tab=following`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground transition-colors hover:text-foreground"
							>
								<span className="font-semibold text-foreground">
									{formatCount(profile.following)}
								</span>{" "}
								following
							</a>
						</div>

						{/* Pinned Repos */}
						{pinnedRepos && pinnedRepos.length > 0 && (
							<section className="flex flex-col gap-2 pt-6">
								<h2 className="text-sm font-medium text-muted-foreground">
									Pinned
								</h2>
								<div className="grid grid-cols-2 gap-3">
									{pinnedRepos.map((repo) => (
										<PinnedRepoCard key={repo.name} repo={repo} />
									))}
								</div>
							</section>
						)}

						{/* Activity */}
						{activity && activity.length > 0 && (
							<section className="flex flex-col pt-6">
								<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
									<h2 className="text-xs font-medium">Recent activity</h2>
									<span className="text-xs tabular-nums text-muted-foreground">
										{activity.length}
									</span>
								</div>
								<UserActivityFeed events={activity} />
								{activityQuery.hasNextPage && (
									<Button
										variant="secondary"
										size="sm"
										className="mx-auto mt-2 rounded-full"
										disabled={activityQuery.isFetchingNextPage}
										onClick={() => activityQuery.fetchNextPage()}
									>
										{activityQuery.isFetchingNextPage ? (
											<Spinner className="size-3.5" />
										) : (
											<ChevronDownIcon size={14} strokeWidth={2} />
										)}
										Load more
									</Button>
								)}
							</section>
						)}
					</div>
				) : (
					<ProfileSkeleton />
				)}
			</div>
		</div>
	);
}

function ProfileMetadata({ profile }: { profile: GitHubUserProfile }) {
	const items: Array<{
		icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
		label: string;
		href?: string;
	}> = [];

	if (profile.company) {
		items.push({ icon: BuildingIcon, label: profile.company });
	}
	if (profile.location) {
		items.push({ icon: LocationIcon, label: profile.location });
	}
	if (profile.blog) {
		const url = profile.blog.startsWith("http")
			? profile.blog
			: `https://${profile.blog}`;
		const displayUrl = profile.blog
			.replace(/^https?:\/\//, "")
			.replace(/\/$/, "");
		items.push({ icon: ExternalLinkIcon, label: displayUrl, href: url });
	}
	if (profile.twitterUsername) {
		items.push({
			icon: ExternalLinkIcon,
			label: `@${profile.twitterUsername}`,
			href: `https://x.com/${profile.twitterUsername}`,
		});
	}

	if (items.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
			{items.map((item) => {
				const content = (
					<span className="flex items-center gap-1.5">
						<item.icon size={14} strokeWidth={1.75} />
						<span>{item.label}</span>
					</span>
				);

				if (item.href) {
					return (
						<a
							key={item.label}
							href={item.href}
							target="_blank"
							rel="noopener noreferrer"
							className="transition-colors hover:text-foreground"
						>
							{content}
						</a>
					);
				}

				return <span key={item.label}>{content}</span>;
			})}
		</div>
	);
}

function ProfileSkeleton() {
	return (
		<div className="mt-3 flex flex-col gap-3 pb-8">
			<div className="flex flex-col gap-1.5">
				<Skeleton className="h-7 w-48" />
				<Skeleton className="h-5 w-32" />
			</div>
			<Skeleton className="h-4 w-72" />
			<div className="flex items-center gap-3">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-28" />
			</div>
			<div className="flex items-center gap-4">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-20" />
			</div>
		</div>
	);
}

function formatCount(count: number): string {
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	}
	return count.toString();
}
