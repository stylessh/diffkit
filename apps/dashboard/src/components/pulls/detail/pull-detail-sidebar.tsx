import {
	CalendarIcon,
	ClockIcon,
	CloseIcon,
	CommentIcon,
	FileIcon,
	GitCommitIcon,
	GitMergeIcon,
	MessageIcon,
} from "@diffkit/icons";
import {
	LineCounts,
	PanelAddButton,
	PanelGoButton,
	PanelPill,
	PanelRow,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import {
	MenuHead,
	MenuRowEnd,
	menuRowClassName,
} from "@diffkit/ui/components/menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	DetailParticipantAvatars,
	DetailSidebar,
	DetailSidebarRow,
	DetailSidebarSection,
} from "#/components/details/detail-sidebar";
import {
	PanelPicker,
	PanelPickerEmpty,
} from "#/components/details/panel-picker";
import { LabelsSection } from "#/components/issues/labels-section";
import { PullStackSection } from "#/components/pulls/stack/pull-stack-section";
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
import { getPrStateConfig } from "#/lib/pr-state";
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
			<PullStackSection pr={pr} owner={owner} repo={repo} scope={scope} />

			<PullPropertiesSection pr={pr} />

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
				<div className="flex flex-col gap-1">
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
	const teamsOptions = githubOrgTeamsQueryOptions(scope, {
		org: owner,
		owner,
		repo,
	});

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

	const botCandidates = useMemo(
		() => candidates.filter((candidate) => candidate.type === "Bot"),
		[candidates],
	);
	const userCandidates = useMemo(
		() => candidates.filter((candidate) => candidate.type !== "Bot"),
		[candidates],
	);

	const filteredUsers = useMemo(() => {
		if (!search) return userCandidates;
		const query = search.toLowerCase();
		return userCandidates.filter((candidate) =>
			candidate.login.toLowerCase().includes(query),
		);
	}, [userCandidates, search]);

	const filteredBots = useMemo(() => {
		if (!search) return botCandidates;
		const query = search.toLowerCase();
		return botCandidates.filter((candidate) =>
			candidate.login.toLowerCase().includes(query),
		);
	}, [botCandidates, search]);

	const filteredTeams = useMemo(() => {
		if (!search) return teams;
		const query = search.toLowerCase();
		return teams.filter(
			(team) =>
				team.name.toLowerCase().includes(query) ||
				team.slug.toLowerCase().includes(query),
		);
	}, [teams, search]);

	const collaboratorByLogin = useMemo(
		() => new Map(collaborators.map((c) => [c.login, c])),
		[collaborators],
	);
	const teamBySlug = useMemo(
		() => new Map(teams.map((t) => [t.slug, t])),
		[teams],
	);

	const pageQueryKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber,
	});

	const toggleReviewer = (login: string) => {
		const isRequested = requestedLogins.has(login);
		const collaborator = collaboratorByLogin.get(login);

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
													url:
														collaborator?.url ?? `https://github.com/${login}`,
													type: collaborator?.type ?? "User",
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
		const team = teamBySlug.get(slug);

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
		for (const bot of filteredBots) {
			items.push({ kind: "user", login: bot.login });
		}
		for (const collaborator of filteredUsers) {
			items.push({ kind: "user", login: collaborator.login });
		}
		return items;
	}, [filteredBots, filteredTeams, filteredUsers]);

	const scrollToFocused = useCallback((index: number) => {
		const element = listRef.current?.querySelector(`[data-index="${index}"]`);
		if (element) {
			element.scrollIntoView({ block: "nearest" });
		}
	}, []);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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
		} else if (!search && /^[1-9]$/.test(event.key)) {
			// As in Linear's pickers, a number toggles the row it labels.
			const item = flatItems[Number(event.key) - 1];
			if (!item) return;
			event.preventDefault();
			if (item.kind === "team") {
				toggleTeam(item.slug);
			} else {
				toggleReviewer(item.login);
			}
		}
	};

	const openPicker = () => {
		prefetchReviewers();
		setPickerOpen(true);
	};

	const renderOption = (
		item: ReviewerItem,
		index: number,
		content: React.ReactNode,
		selected: boolean,
	) => (
		<button
			key={item.kind === "team" ? `team-${item.slug}` : item.login}
			type="button"
			role="option"
			aria-selected={selected}
			data-index={index}
			data-active={focusedIndex === index}
			onClick={() =>
				item.kind === "team"
					? toggleTeam(item.slug)
					: toggleReviewer(item.login)
			}
			onMouseEnter={() => setFocusedIndex(index)}
			className={menuRowClassName}
		>
			{content}
			<MenuRowEnd
				checked={selected}
				shortcut={!search && index < 9 ? index + 1 : undefined}
			/>
		</button>
	);

	const reviewerRows = (
		<>
			{pr.requestedTeams.map((team) => (
				<PanelRow key={`team-${team.slug}`}>
					{isOpen ? (
						<PanelPill asChild icon={<TeamMark />}>
							<button
								type="button"
								aria-haspopup="listbox"
								aria-expanded={pickerOpen}
								onClick={openPicker}
							>
								{team.name}
							</button>
						</PanelPill>
					) : (
						<PanelPill icon={<TeamMark />}>{team.name}</PanelPill>
					)}
				</PanelRow>
			))}
			{pr.requestedReviewers.map((reviewer) => (
				<div
					key={reviewer.login}
					className="group/row flex w-fit max-w-full items-center gap-2.5"
				>
					{isOpen ? (
						<PanelPill asChild icon={<PanelAvatar src={reviewer.avatarUrl} />}>
							<button
								type="button"
								aria-haspopup="listbox"
								aria-expanded={pickerOpen}
								onClick={openPicker}
							>
								{reviewer.login}
							</button>
						</PanelPill>
					) : (
						<PanelPill icon={<PanelAvatar src={reviewer.avatarUrl} />}>
							{reviewer.login}
						</PanelPill>
					)}
					<PanelGoButton asChild aria-label={`Open ${reviewer.login}`}>
						<Link to="/$owner" params={{ owner: reviewer.login }} />
					</PanelGoButton>
				</div>
			))}
			{!hasReviewers ? (
				isOpen ? (
					<PanelPill asChild muted>
						<button
							type="button"
							aria-haspopup="listbox"
							aria-expanded={pickerOpen}
							onMouseEnter={prefetchReviewers}
							onClick={openPicker}
						>
							Request reviewers
						</button>
					</PanelPill>
				) : (
					<PanelPill muted>No reviewers</PanelPill>
				)
			) : isOpen ? (
				<PanelAddButton
					aria-label="Add reviewer"
					aria-haspopup="listbox"
					aria-expanded={pickerOpen}
					onMouseEnter={prefetchReviewers}
					onClick={openPicker}
				/>
			) : null}
		</>
	);

	return (
		<PanelSection label="Reviewers">
			<PanelPicker
				open={pickerOpen}
				onOpenChange={(open) => {
					setPickerOpen(open);
					if (!open) {
						setSearch("");
						setFocusedIndex(-1);
					}
				}}
				search={search}
				onSearchChange={(value) => {
					setSearch(value);
					setFocusedIndex(-1);
				}}
				onKeyDown={handleKeyDown}
				placeholder="Request review from…"
				listRef={listRef}
				anchor={reviewerRows}
			>
				{isLoading ? (
					<PanelPickerEmpty>Loading…</PanelPickerEmpty>
				) : flatItems.length === 0 ? (
					<PanelPickerEmpty>
						{search ? `No one matches “${search}”` : "No one to request"}
					</PanelPickerEmpty>
				) : (
					<>
						{filteredTeams.length > 0 ? <MenuHead>Teams</MenuHead> : null}
						{filteredTeams.map((team, index) =>
							renderOption(
								{ kind: "team", slug: team.slug },
								index,
								<>
									<TeamMark />
									<span className="truncate">{team.name}</span>
								</>,
								requestedTeamSlugs.has(team.slug),
							),
						)}
						{filteredBots.length > 0 ? <MenuHead>Bots</MenuHead> : null}
						{filteredBots.map((bot, index) =>
							renderOption(
								{ kind: "user", login: bot.login },
								filteredTeams.length + index,
								<>
									<PanelAvatar src={bot.avatarUrl} size={16} />
									<span className="truncate">{bot.login}</span>
								</>,
								requestedLogins.has(bot.login),
							),
						)}
						{filteredUsers.length > 0 &&
						(filteredTeams.length > 0 || filteredBots.length > 0) ? (
							<MenuHead>People</MenuHead>
						) : null}
						{filteredUsers.map((collaborator, index) =>
							renderOption(
								{ kind: "user", login: collaborator.login },
								filteredTeams.length + filteredBots.length + index,
								<>
									<PanelAvatar src={collaborator.avatarUrl} size={16} />
									<span className="truncate">{collaborator.login}</span>
								</>,
								requestedLogins.has(collaborator.login),
							),
						)}
					</>
				)}
			</PanelPicker>
		</PanelSection>
	);
}

/** A person's avatar in a panel row (14px) or menu row (16px), with a hairline ring. */
function PanelAvatar({ src, size = 14 }: { src: string; size?: number }) {
	return (
		<img
			src={src}
			alt=""
			width={size}
			height={size}
			className="shrink-0 rounded-full ring-[0.5px] ring-chip-border"
			style={{ width: size, height: size }}
		/>
	);
}

/** A team's mark: a rounded square with its initial, as an avatar stand-in. */
function TeamMark() {
	return (
		<span
			aria-hidden
			className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-pill-neutral text-[9px] font-semibold text-muted-foreground"
		>
			T
		</span>
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

/** Linear's Properties section: where the pull request stands at a glance. */
function PullPropertiesSection({ pr }: { pr: PullDetail }) {
	const state = getPrStateConfig(pr);
	const StateIcon = state.icon;
	return (
		<PanelSection label="Properties">
			<PanelRow
				icon={<StateIcon size={14} strokeWidth={2} className={state.color} />}
			>
				{state.label}
			</PanelRow>
			<PanelRow icon={<FileIcon size={14} strokeWidth={2} />}>
				<span className="tabular-nums">
					{pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
				</span>
				<LineCounts additions={pr.additions} deletions={pr.deletions} />
			</PanelRow>
			<PanelRow icon={<GitCommitIcon size={14} strokeWidth={2} />}>
				<span className="tabular-nums">
					{pr.commits} {pr.commits === 1 ? "commit" : "commits"}
				</span>
			</PanelRow>
		</PanelSection>
	);
}
