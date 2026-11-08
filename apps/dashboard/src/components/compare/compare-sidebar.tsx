import { CheckIcon, CloseIcon, PlusSignIcon, SearchIcon } from "@diffkit/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useCallback, useMemo, useRef, useState } from "react";
import { DetailSidebar } from "#/components/details/detail-sidebar";
import {
	type GitHubQueryScope,
	githubOrgTeamsQueryOptions,
	githubRepoCollaboratorsQueryOptions,
	githubRepoLabelsQueryOptions,
} from "#/lib/github.query";
import type {
	GitHubLabel,
	OrgTeam,
	RepoCollaborator,
} from "#/lib/github.types";

export function CompareSidebar({
	owner,
	repo,
	scope,
	viewerLogin,
	selectedLabels,
	onToggleLabel,
	selectedAssignees,
	onToggleAssignee,
	selectedReviewers,
	onToggleReviewer,
	selectedTeamReviewers,
	onToggleTeamReviewer,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	viewerLogin: string | null;
	selectedLabels: GitHubLabel[];
	onToggleLabel: (label: GitHubLabel) => void;
	selectedAssignees: RepoCollaborator[];
	onToggleAssignee: (c: RepoCollaborator) => void;
	selectedReviewers: RepoCollaborator[];
	onToggleReviewer: (c: RepoCollaborator) => void;
	selectedTeamReviewers: OrgTeam[];
	onToggleTeamReviewer: (t: OrgTeam) => void;
}) {
	return (
		<DetailSidebar>
			<ReviewersPicker
				owner={owner}
				repo={repo}
				scope={scope}
				viewerLogin={viewerLogin}
				selectedReviewers={selectedReviewers}
				onToggleReviewer={onToggleReviewer}
				selectedTeamReviewers={selectedTeamReviewers}
				onToggleTeamReviewer={onToggleTeamReviewer}
			/>
			<AssigneesPicker
				owner={owner}
				repo={repo}
				scope={scope}
				selectedAssignees={selectedAssignees}
				onToggleAssignee={onToggleAssignee}
			/>
			<LabelsPicker
				owner={owner}
				repo={repo}
				scope={scope}
				selectedLabels={selectedLabels}
				onToggleLabel={onToggleLabel}
			/>
		</DetailSidebar>
	);
}

function SidebarSectionHeader({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between">
			<h3 className="text-[13px] font-[450] text-muted-foreground">{title}</h3>
			{children}
		</div>
	);
}

const PickerTrigger = forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		label: string;
		onPrefetch?: () => void;
	}
>(function PickerTrigger(
	{ label, onPrefetch, onMouseEnter, onFocus, className, ...props },
	ref,
) {
	return (
		<button
			ref={ref}
			type="button"
			aria-label={label}
			onMouseEnter={(e) => {
				onPrefetch?.();
				onMouseEnter?.(e);
			}}
			onFocus={(e) => {
				onPrefetch?.();
				onFocus?.(e);
			}}
			className={cn(
				"flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
				className,
			)}
			{...props}
		>
			<PlusSignIcon size={14} strokeWidth={2} />
		</button>
	);
});

function PickerSearchInput({
	value,
	onChange,
	onKeyDown,
	placeholder,
}: {
	value: string;
	onChange: (v: string) => void;
	onKeyDown: (e: React.KeyboardEvent) => void;
	placeholder: string;
}) {
	return (
		<div className="flex items-center gap-2 border-b-[0.5px] px-3 py-2">
			<SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={onKeyDown}
				placeholder={placeholder}
				className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			/>
		</div>
	);
}

function EmptyPickerState({
	isLoading,
	hasSearch,
	emptyLabel,
	emptySearchLabel,
}: {
	isLoading: boolean;
	hasSearch: boolean;
	emptyLabel: string;
	emptySearchLabel: string;
}) {
	return (
		<p className="px-3 py-4 text-center text-xs text-muted-foreground">
			{isLoading ? "Loading…" : hasSearch ? emptySearchLabel : emptyLabel}
		</p>
	);
}

function LabelsPicker({
	owner,
	repo,
	scope,
	selectedLabels,
	onToggleLabel,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	selectedLabels: GitHubLabel[];
	onToggleLabel: (label: GitHubLabel) => void;
}) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement>(null);

	const labelsQuery = useQuery(
		githubRepoLabelsQueryOptions(scope, { owner, repo }),
	);
	const repoLabels = labelsQuery.data ?? [];

	const selectedNames = useMemo(
		() => new Set(selectedLabels.map((l) => l.name)),
		[selectedLabels],
	);

	const filtered = useMemo(() => {
		if (!search) return repoLabels;
		const q = search.toLowerCase();
		return repoLabels.filter((l) => l.name.toLowerCase().includes(q));
	}, [repoLabels, search]);

	const scrollToFocused = useCallback((index: number) => {
		listRef.current
			?.querySelector(`[data-index="${index}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (filtered.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = focusedIndex < filtered.length - 1 ? focusedIndex + 1 : 0;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const next = focusedIndex > 0 ? focusedIndex - 1 : filtered.length - 1;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "Enter" && focusedIndex >= 0) {
			e.preventDefault();
			onToggleLabel(filtered[focusedIndex]);
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<SidebarSectionHeader title="Labels">
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
						<PickerTrigger label="Add labels" />
					</PopoverTrigger>
					<PopoverContent align="end" className="w-64 p-0">
						<PickerSearchInput
							value={search}
							onChange={(v) => {
								setSearch(v);
								setFocusedIndex(-1);
							}}
							onKeyDown={handleKeyDown}
							placeholder="Search labels…"
						/>
						<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
							{filtered.length === 0 ? (
								<EmptyPickerState
									isLoading={labelsQuery.isLoading}
									hasSearch={search.length > 0}
									emptyLabel="No labels available"
									emptySearchLabel="No labels found"
								/>
							) : (
								filtered.map((label, i) => {
									const isSelected = selectedNames.has(label.name);
									return (
										<button
											key={label.name}
											type="button"
											data-index={i}
											onClick={() => onToggleLabel(label)}
											onMouseEnter={() => setFocusedIndex(i)}
											className={cn(
												"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1",
												focusedIndex === i && "bg-surface-1",
											)}
										>
											<span
												className="size-3 shrink-0 rounded-full"
												style={{ backgroundColor: `#${label.color}` }}
											/>
											<span className="min-w-0 flex-1 truncate">
												{label.name}
											</span>
											{isSelected && (
												<CheckIcon
													size={14}
													strokeWidth={2}
													className="shrink-0 text-success"
												/>
											)}
										</button>
									);
								})
							)}
						</div>
					</PopoverContent>
				</Popover>
			</SidebarSectionHeader>
			{selectedLabels.length > 0 ? (
				<div className="flex flex-wrap gap-1.5">
					{selectedLabels.map((label) => (
						<span
							key={label.name}
							className="group/label label-pill relative rounded-full px-2.5 py-0.5 text-xs font-medium"
							style={
								{ "--label-color": `#${label.color}` } as React.CSSProperties
							}
						>
							{label.name}
							<button
								type="button"
								onClick={() => onToggleLabel(label)}
								className="label-pill-close-gradient absolute inset-y-0 right-0 flex items-center overflow-hidden rounded-r-full pl-5 pr-1.5 opacity-0 transition-opacity group-hover/label:opacity-100"
							>
								<span className="relative flex size-4 items-center justify-center rounded-full hover:bg-black/15">
									<CloseIcon size={10} strokeWidth={2.5} />
								</span>
							</button>
						</span>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">No labels</p>
			)}
		</div>
	);
}

function AssigneesPicker({
	owner,
	repo,
	scope,
	selectedAssignees,
	onToggleAssignee,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	selectedAssignees: RepoCollaborator[];
	onToggleAssignee: (c: RepoCollaborator) => void;
}) {
	const queryClient = useQueryClient();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement>(null);

	const collaboratorsOptions = githubRepoCollaboratorsQueryOptions(scope, {
		owner,
		repo,
	});
	const collaboratorsQuery = useQuery({
		...collaboratorsOptions,
		enabled: pickerOpen,
	});
	const prefetch = useCallback(
		() => void queryClient.prefetchQuery(collaboratorsOptions),
		[queryClient, collaboratorsOptions],
	);

	const collaborators = collaboratorsQuery.data ?? [];
	const selectedLogins = useMemo(
		() => new Set(selectedAssignees.map((a) => a.login)),
		[selectedAssignees],
	);

	const filtered = useMemo(() => {
		const users = collaborators.filter((c) => c.type !== "Bot");
		if (!search) return users;
		const q = search.toLowerCase();
		return users.filter((c) => c.login.toLowerCase().includes(q));
	}, [collaborators, search]);

	const scrollToFocused = useCallback((index: number) => {
		listRef.current
			?.querySelector(`[data-index="${index}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (filtered.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = focusedIndex < filtered.length - 1 ? focusedIndex + 1 : 0;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const next = focusedIndex > 0 ? focusedIndex - 1 : filtered.length - 1;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "Enter" && focusedIndex >= 0) {
			e.preventDefault();
			onToggleAssignee(filtered[focusedIndex]);
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<SidebarSectionHeader title="Assignees">
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
						<PickerTrigger label="Add assignees" onPrefetch={prefetch} />
					</PopoverTrigger>
					<PopoverContent align="end" className="w-64 p-0">
						<PickerSearchInput
							value={search}
							onChange={(v) => {
								setSearch(v);
								setFocusedIndex(-1);
							}}
							onKeyDown={handleKeyDown}
							placeholder="Search people…"
						/>
						<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
							{filtered.length === 0 ? (
								<EmptyPickerState
									isLoading={collaboratorsQuery.isLoading}
									hasSearch={search.length > 0}
									emptyLabel="No collaborators available"
									emptySearchLabel="No people found"
								/>
							) : (
								filtered.map((c, i) => {
									const isSelected = selectedLogins.has(c.login);
									return (
										<button
											key={c.login}
											type="button"
											data-index={i}
											onClick={() => onToggleAssignee(c)}
											onMouseEnter={() => setFocusedIndex(i)}
											className={cn(
												"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1",
												focusedIndex === i && "bg-surface-1",
											)}
										>
											<img
												src={c.avatarUrl}
												alt={c.login}
												className="size-5 rounded-full border-[0.5px] border-border"
											/>
											<span className="min-w-0 flex-1 truncate">{c.login}</span>
											{isSelected && (
												<CheckIcon
													size={14}
													strokeWidth={2}
													className="shrink-0 text-success"
												/>
											)}
										</button>
									);
								})
							)}
						</div>
					</PopoverContent>
				</Popover>
			</SidebarSectionHeader>
			{selectedAssignees.length > 0 ? (
				<div className="flex flex-col gap-2">
					{selectedAssignees.map((a) => (
						<div
							key={a.login}
							className="group/assignee flex items-center gap-2"
						>
							<img
								src={a.avatarUrl}
								alt={a.login}
								className="size-5 rounded-full border-[0.5px] border-border"
							/>
							<span className="min-w-0 flex-1 truncate text-sm">{a.login}</span>
							<button
								type="button"
								onClick={() => onToggleAssignee(a)}
								className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-danger group-hover/assignee:opacity-100"
							>
								<CloseIcon size={12} strokeWidth={2} />
							</button>
						</div>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">No one assigned</p>
			)}
		</div>
	);
}

function ReviewersPicker({
	owner,
	repo,
	scope,
	viewerLogin,
	selectedReviewers,
	onToggleReviewer,
	selectedTeamReviewers,
	onToggleTeamReviewer,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	viewerLogin: string | null;
	selectedReviewers: RepoCollaborator[];
	onToggleReviewer: (c: RepoCollaborator) => void;
	selectedTeamReviewers: OrgTeam[];
	onToggleTeamReviewer: (t: OrgTeam) => void;
}) {
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
	const prefetch = useCallback(() => {
		void queryClient.prefetchQuery(collaboratorsOptions);
		void queryClient.prefetchQuery(teamsOptions);
	}, [queryClient, collaboratorsOptions, teamsOptions]);

	const collaborators = collaboratorsQuery.data ?? [];
	const teams = teamsQuery.data ?? [];
	const selectedLogins = useMemo(
		() => new Set(selectedReviewers.map((r) => r.login)),
		[selectedReviewers],
	);
	const selectedTeamSlugs = useMemo(
		() => new Set(selectedTeamReviewers.map((t) => t.slug)),
		[selectedTeamReviewers],
	);

	const candidates = useMemo(
		() => collaborators.filter((c) => c.login !== viewerLogin),
		[collaborators, viewerLogin],
	);
	const filteredUsers = useMemo(() => {
		if (!search) return candidates;
		const q = search.toLowerCase();
		return candidates.filter((c) => c.login.toLowerCase().includes(q));
	}, [candidates, search]);
	const filteredTeams = useMemo(() => {
		if (!search) return teams;
		const q = search.toLowerCase();
		return teams.filter(
			(t) =>
				t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
		);
	}, [teams, search]);

	type Item =
		| { kind: "user"; data: RepoCollaborator }
		| { kind: "team"; data: OrgTeam };
	const flatItems = useMemo<Item[]>(
		() => [
			...filteredTeams.map<Item>((t) => ({ kind: "team", data: t })),
			...filteredUsers.map<Item>((u) => ({ kind: "user", data: u })),
		],
		[filteredTeams, filteredUsers],
	);

	const scrollToFocused = useCallback((index: number) => {
		listRef.current
			?.querySelector(`[data-index="${index}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (flatItems.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = focusedIndex < flatItems.length - 1 ? focusedIndex + 1 : 0;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const next = focusedIndex > 0 ? focusedIndex - 1 : flatItems.length - 1;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "Enter" && focusedIndex >= 0) {
			e.preventDefault();
			const item = flatItems[focusedIndex];
			if (item.kind === "user") onToggleReviewer(item.data);
			else onToggleTeamReviewer(item.data);
		}
	};

	const hasSelections =
		selectedReviewers.length > 0 || selectedTeamReviewers.length > 0;

	return (
		<div className="flex flex-col gap-2.5">
			<SidebarSectionHeader title="Reviewers">
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
						<PickerTrigger label="Add reviewers" onPrefetch={prefetch} />
					</PopoverTrigger>
					<PopoverContent align="end" className="w-64 p-0">
						<PickerSearchInput
							value={search}
							onChange={(v) => {
								setSearch(v);
								setFocusedIndex(-1);
							}}
							onKeyDown={handleKeyDown}
							placeholder="Search reviewers…"
						/>
						<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
							{flatItems.length === 0 ? (
								<EmptyPickerState
									isLoading={
										collaboratorsQuery.isLoading || teamsQuery.isLoading
									}
									hasSearch={search.length > 0}
									emptyLabel="No reviewers available"
									emptySearchLabel="No matches found"
								/>
							) : (
								flatItems.map((item, i) => {
									const isSelected =
										item.kind === "user"
											? selectedLogins.has(item.data.login)
											: selectedTeamSlugs.has(item.data.slug);
									return (
										<button
											key={
												item.kind === "user"
													? `u:${item.data.login}`
													: `t:${item.data.slug}`
											}
											type="button"
											data-index={i}
											onClick={() => {
												if (item.kind === "user") onToggleReviewer(item.data);
												else onToggleTeamReviewer(item.data);
											}}
											onMouseEnter={() => setFocusedIndex(i)}
											className={cn(
												"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1",
												focusedIndex === i && "bg-surface-1",
											)}
										>
											{item.kind === "user" ? (
												<img
													src={item.data.avatarUrl}
													alt={item.data.login}
													className="size-5 rounded-full border-[0.5px] border-border"
												/>
											) : (
												<div className="flex size-5 items-center justify-center rounded-full bg-surface-2 text-[10px] font-medium">
													T
												</div>
											)}
											<span className="min-w-0 flex-1 truncate">
												{item.kind === "user"
													? item.data.login
													: `${owner}/${item.data.slug}`}
											</span>
											{isSelected && (
												<CheckIcon
													size={14}
													strokeWidth={2}
													className="shrink-0 text-success"
												/>
											)}
										</button>
									);
								})
							)}
						</div>
					</PopoverContent>
				</Popover>
			</SidebarSectionHeader>
			{hasSelections ? (
				<div className="flex flex-col gap-2">
					{selectedTeamReviewers.map((t) => (
						<div
							key={`t:${t.slug}`}
							className="group/reviewer flex items-center gap-2"
						>
							<div className="flex size-5 items-center justify-center rounded-full bg-surface-2 text-[10px] font-medium">
								T
							</div>
							<span className="min-w-0 flex-1 truncate text-sm">
								{owner}/{t.slug}
							</span>
							<button
								type="button"
								onClick={() => onToggleTeamReviewer(t)}
								className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-danger group-hover/reviewer:opacity-100"
							>
								<CloseIcon size={12} strokeWidth={2} />
							</button>
						</div>
					))}
					{selectedReviewers.map((r) => (
						<div
							key={`u:${r.login}`}
							className="group/reviewer flex items-center gap-2"
						>
							<img
								src={r.avatarUrl}
								alt={r.login}
								className="size-5 rounded-full border-[0.5px] border-border"
							/>
							<span className="min-w-0 flex-1 truncate text-sm">{r.login}</span>
							<button
								type="button"
								onClick={() => onToggleReviewer(r)}
								className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-danger group-hover/reviewer:opacity-100"
							>
								<CloseIcon size={12} strokeWidth={2} />
							</button>
						</div>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">No reviewers</p>
			)}
		</div>
	);
}
