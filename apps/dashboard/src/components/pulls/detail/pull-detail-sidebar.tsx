import {
	CalendarIcon,
	CheckIcon,
	ClockIcon,
	CloseIcon,
	CommentIcon,
	GitMergeIcon,
	MessageIcon,
	PlusSignIcon,
	SearchIcon,
} from "@diffkit/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	DetailParticipantAvatars,
	DetailSidebar,
	DetailSidebarRow,
	DetailSidebarSection,
} from "#/components/details/detail-sidebar";
import { LabelsSection } from "#/components/issues/labels-section";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	removeReviewRequest,
	requestPullReviewers,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubOrgTeamsQueryOptions,
	githubQueryKeys,
	githubRepoCollaboratorsQueryOptions,
} from "#/lib/github.query";
import type {
	GitHubActor,
	PullComment,
	PullCommit,
	PullDetail,
	PullPageData,
} from "#/lib/github.types";
import { useOptimisticMutation } from "#/lib/use-optimistic-mutation";

export function PullDetailSidebar({
	pr,
	owner,
	repo,
	pullNumber,
	scope,
	comments,
	commits,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	comments: PullComment[];
	commits: PullCommit[];
}) {
	return (
		<DetailSidebar>
			<LabelsSection
				currentLabels={pr.labels}
				owner={owner}
				repo={repo}
				issueNumber={pullNumber}
				scope={scope}
				pageQueryKey={githubQueryKeys.pulls.page(scope, {
					owner,
					repo,
					pullNumber,
				})}
			/>

			<ReviewersSection
				pr={pr}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
				scope={scope}
			/>

			<DetailSidebarSection title="Participants">
				<ParticipantsList pr={pr} comments={comments} commits={commits} />
			</DetailSidebarSection>

			<DetailSidebarSection title="Details">
				<div className="flex flex-col gap-2 text-xs">
					<DetailSidebarRow icon={CalendarIcon} label="Created">
						{formatRelativeTime(pr.createdAt)}
					</DetailSidebarRow>
					<DetailSidebarRow icon={ClockIcon} label="Updated">
						{formatRelativeTime(pr.updatedAt)}
					</DetailSidebarRow>
					{pr.mergedAt && (
						<DetailSidebarRow icon={GitMergeIcon} label="Merged">
							{formatRelativeTime(pr.mergedAt)}
						</DetailSidebarRow>
					)}
					{pr.closedAt && !pr.mergedAt && (
						<DetailSidebarRow icon={CloseIcon} label="Closed">
							{formatRelativeTime(pr.closedAt)}
						</DetailSidebarRow>
					)}
					<DetailSidebarRow icon={CommentIcon} label="Comments">
						<span className="tabular-nums">{pr.comments}</span>
					</DetailSidebarRow>
					<DetailSidebarRow icon={MessageIcon} label="Review comments">
						<span className="tabular-nums">{pr.reviewComments}</span>
					</DetailSidebarRow>
				</div>
			</DetailSidebarSection>
		</DetailSidebar>
	);
}

function ReviewersSection({
	pr,
	owner,
	repo,
	pullNumber,
	scope,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
}) {
	const { mutate } = useOptimisticMutation();
	const queryClient = useQueryClient();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement>(null);

	const collaboratorsOptions = githubRepoCollaboratorsQueryOptions(scope, {
		owner,
		repo,
	});
	const teamsOptions = githubOrgTeamsQueryOptions(scope, owner);

	const collaboratorsQuery = useQuery({
		...collaboratorsOptions,
		enabled: pickerOpen,
	});
	const teamsQuery = useQuery({
		...teamsOptions,
		enabled: pickerOpen,
	});

	const prefetchReviewers = useCallback(() => {
		void queryClient.prefetchQuery(collaboratorsOptions);
		void queryClient.prefetchQuery(teamsOptions);
	}, [queryClient, collaboratorsOptions, teamsOptions]);

	const collaborators = collaboratorsQuery.data ?? [];
	const teams = teamsQuery.data ?? [];
	const isLoading = collaboratorsQuery.isLoading || teamsQuery.isLoading;
	const isOpen = !pr.isMerged && pr.state !== "closed";

	const requestedLogins = useMemo(
		() => new Set(pr.requestedReviewers.map((reviewer) => reviewer.login)),
		[pr.requestedReviewers],
	);
	const requestedTeamSlugs = useMemo(
		() => new Set(pr.requestedTeams.map((team) => team.slug)),
		[pr.requestedTeams],
	);

	const candidates = useMemo(() => {
		const authorLogin = pr.author?.login;
		return collaborators.filter(
			(collaborator) => collaborator.login !== authorLogin,
		);
	}, [collaborators, pr.author?.login]);

	const filteredUsers = useMemo(() => {
		if (!search) return candidates;
		const query = search.toLowerCase();
		return candidates.filter((candidate) =>
			candidate.login.toLowerCase().includes(query),
		);
	}, [candidates, search]);

	const filteredTeams = useMemo(() => {
		if (!search) return teams;
		const query = search.toLowerCase();
		return teams.filter(
			(team) =>
				team.name.toLowerCase().includes(query) ||
				team.slug.toLowerCase().includes(query),
		);
	}, [teams, search]);

	const pageQueryKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber,
	});

	const toggleReviewer = (login: string) => {
		const isRequested = requestedLogins.has(login);
		const collaborator = collaborators.find(
			(candidate) => candidate.login === login,
		);

		mutate({
			mutationFn: () =>
				isRequested
					? removeReviewRequest({
							data: { owner, repo, pullNumber, reviewers: [login] },
						})
					: requestPullReviewers({
							data: { owner, repo, pullNumber, reviewers: [login] },
						}),
			isSuccess: (r) => r.ok,
			updates: [
				{
					queryKey: pageQueryKey,
					updater: (prev: PullPageData) => ({
						...prev,
						detail: prev.detail
							? {
									...prev.detail,
									requestedReviewers: isRequested
										? prev.detail.requestedReviewers.filter(
												(reviewer) => reviewer.login !== login,
											)
										: [
												...prev.detail.requestedReviewers,
												{
													login,
													avatarUrl: collaborator?.avatarUrl ?? "",
													url: `https://github.com/${login}`,
													type: "User",
												},
											],
								}
							: prev.detail,
					}),
				},
			],
		});
	};

	const toggleTeam = (slug: string) => {
		const isRequested = requestedTeamSlugs.has(slug);
		const team = teams.find((candidate) => candidate.slug === slug);

		mutate({
			mutationFn: () =>
				isRequested
					? removeReviewRequest({
							data: { owner, repo, pullNumber, teamReviewers: [slug] },
						})
					: requestPullReviewers({
							data: { owner, repo, pullNumber, teamReviewers: [slug] },
						}),
			isSuccess: (r) => r.ok,
			updates: [
				{
					queryKey: pageQueryKey,
					updater: (prev: PullPageData) => ({
						...prev,
						detail: prev.detail
							? {
									...prev.detail,
									requestedTeams: isRequested
										? prev.detail.requestedTeams.filter(
												(requestedTeam) => requestedTeam.slug !== slug,
											)
										: [
												...prev.detail.requestedTeams,
												{
													slug,
													name: team?.name ?? slug,
													url: `https://github.com/orgs/${owner}/teams/${slug}`,
												},
											],
								}
							: prev.detail,
					}),
				},
			],
		});
	};

	const hasReviewers =
		pr.requestedReviewers.length > 0 || pr.requestedTeams.length > 0;

	type ReviewerItem =
		| { kind: "team"; slug: string }
		| { kind: "user"; login: string };

	const flatItems = useMemo<ReviewerItem[]>(() => {
		const items: ReviewerItem[] = [];
		for (const team of filteredTeams)
			items.push({ kind: "team", slug: team.slug });
		for (const collaborator of filteredUsers) {
			items.push({ kind: "user", login: collaborator.login });
		}
		return items;
	}, [filteredTeams, filteredUsers]);

	const scrollToFocused = useCallback((index: number) => {
		const element = listRef.current?.querySelector(`[data-index="${index}"]`);
		if (element) {
			element.scrollIntoView({ block: "nearest" });
		}
	}, []);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (flatItems.length === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			const next = focusedIndex < flatItems.length - 1 ? focusedIndex + 1 : 0;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			const next = focusedIndex > 0 ? focusedIndex - 1 : flatItems.length - 1;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (event.key === "Enter") {
			event.preventDefault();
			if (focusedIndex < 0) return;
			const item = flatItems[focusedIndex];
			if (item.kind === "team") {
				toggleTeam(item.slug);
			} else {
				toggleReviewer(item.login);
			}
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Reviewers
				</h3>
				{isOpen && (
					<Popover
						open={pickerOpen}
						onOpenChange={(open) => {
							setPickerOpen(open);
							if (!open) {
								setSearch("");
								setFocusedIndex(-1);
							}
						}}
					>
						<PopoverTrigger asChild>
							<button
								type="button"
								onMouseEnter={prefetchReviewers}
								onFocus={prefetchReviewers}
								className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
							>
								<PlusSignIcon size={14} strokeWidth={2} />
							</button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-64 p-0">
							<div className="flex items-center gap-2 border-b px-3 py-2">
								<SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
								<input
									value={search}
									onChange={(event) => {
										setSearch(event.target.value);
										setFocusedIndex(-1);
									}}
									onKeyDown={handleKeyDown}
									placeholder="Search people and teams..."
									className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
								/>
							</div>
							<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
								{isLoading ? (
									<p className="px-3 py-4 text-center text-xs text-muted-foreground">
										Loading…
									</p>
								) : filteredUsers.length === 0 && filteredTeams.length === 0 ? (
									<p className="px-3 py-4 text-center text-xs text-muted-foreground">
										No results found
									</p>
								) : (
									<>
										{filteredTeams.length > 0 && (
											<>
												<p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
													Teams
												</p>
												{filteredTeams.map((team, index) => {
													const isSelected = requestedTeamSlugs.has(team.slug);
													return (
														<button
															key={`team-${team.slug}`}
															type="button"
															data-index={index}
															onClick={() => toggleTeam(team.slug)}
															onMouseEnter={() => setFocusedIndex(index)}
															className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 disabled:opacity-50 ${focusedIndex === index ? "bg-surface-1" : ""}`}
														>
															<div className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 text-[10px] font-semibold text-muted-foreground">
																T
															</div>
															<span className="min-w-0 flex-1 truncate">
																{team.name}
															</span>
															{isSelected && (
																<CheckIcon
																	size={14}
																	strokeWidth={2}
																	className="shrink-0 text-green-500"
																/>
															)}
														</button>
													);
												})}
											</>
										)}
										{filteredUsers.length > 0 && (
											<>
												<p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
													People
												</p>
												{filteredUsers.map((collaborator, index) => {
													const itemIndex = filteredTeams.length + index;
													const isSelected = requestedLogins.has(
														collaborator.login,
													);
													return (
														<button
															key={collaborator.login}
															type="button"
															data-index={itemIndex}
															onClick={() => toggleReviewer(collaborator.login)}
															onMouseEnter={() => setFocusedIndex(itemIndex)}
															className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 disabled:opacity-50 ${focusedIndex === itemIndex ? "bg-surface-1" : ""}`}
														>
															<img
																src={collaborator.avatarUrl}
																alt={collaborator.login}
																className="size-5 rounded-full border border-border"
															/>
															<span className="min-w-0 flex-1 truncate">
																{collaborator.login}
															</span>
															{isSelected && (
																<CheckIcon
																	size={14}
																	strokeWidth={2}
																	className="shrink-0 text-green-500"
																/>
															)}
														</button>
													);
												})}
											</>
										)}
									</>
								)}
							</div>
						</PopoverContent>
					</Popover>
				)}
			</div>
			{hasReviewers ? (
				<div className="flex flex-col gap-2">
					{pr.requestedTeams.map((team) => (
						<div
							key={`team-${team.slug}`}
							className="group/reviewer flex items-center gap-2"
						>
							<div className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 text-[10px] font-semibold text-muted-foreground">
								T
							</div>
							<span className="min-w-0 flex-1 truncate text-sm">
								{team.name}
							</span>
							{isOpen && (
								<button
									type="button"
									onClick={() => toggleTeam(team.slug)}
									className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-red-400 group-hover/reviewer:opacity-100 disabled:opacity-50"
								>
									<CloseIcon size={12} strokeWidth={2} />
								</button>
							)}
						</div>
					))}
					{pr.requestedReviewers.map((reviewer) => (
						<div
							key={reviewer.login}
							className="group/reviewer flex items-center gap-2"
						>
							<img
								src={reviewer.avatarUrl}
								alt={reviewer.login}
								className="size-5 rounded-full border border-border"
							/>
							<span className="min-w-0 flex-1 truncate text-sm">
								{reviewer.login}
							</span>
							{isOpen && (
								<button
									type="button"
									onClick={() => toggleReviewer(reviewer.login)}
									className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-red-400 group-hover/reviewer:opacity-100 disabled:opacity-50"
								>
									<CloseIcon size={12} strokeWidth={2} />
								</button>
							)}
						</div>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">No reviewers requested</p>
			)}
		</div>
	);
}

function ParticipantsList({
	pr,
	comments,
	commits,
}: {
	pr: PullDetail;
	comments: PullComment[];
	commits: PullCommit[];
}) {
	const seen = new Set<string>();
	const participants: GitHubActor[] = [];

	const addActor = (actor: GitHubActor | null) => {
		if (actor && !seen.has(actor.login)) {
			seen.add(actor.login);
			participants.push(actor);
		}
	};

	addActor(pr.author);
	for (const comment of comments) {
		addActor(comment.author);
	}
	for (const commit of commits) {
		addActor(commit.author);
	}

	if (participants.length === 0) {
		return <p className="text-xs text-muted-foreground">No participants yet</p>;
	}

	return <DetailParticipantAvatars actors={participants} />;
}
