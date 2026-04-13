import {
	CheckIcon,
	CloseIcon,
	IssuesIcon,
	PlusSignIcon,
	SearchIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	MarkdownEditor,
	type MentionCandidate,
} from "@diffkit/ui/components/markdown-editor";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { DetailSidebar } from "#/components/details/detail-sidebar";
import { createIssue } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoCollaboratorsQueryOptions,
	githubRepoLabelsQueryOptions,
} from "#/lib/github.query";
import type { GitHubLabel, RepoCollaborator } from "#/lib/github.types";

const routeApi = getRouteApi("/_protected/$owner/$repo/issues/new");

export function NewIssuePage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo } = routeApi.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);

	return <NewIssueForm owner={owner} repo={repo} scope={scope} />;
}

function NewIssueForm({
	owner,
	repo,
	scope,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [selectedLabels, setSelectedLabels] = useState<GitHubLabel[]>([]);
	const [selectedAssignees, setSelectedAssignees] = useState<
		RepoCollaborator[]
	>([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Prefetch labels
	const labelsQuery = useQuery(
		githubRepoLabelsQueryOptions(scope, { owner, repo }),
	);
	const repoLabels = labelsQuery.data ?? [];

	// Collaborators for mentions
	const collaboratorsQuery = useQuery(
		githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
	);

	const mentionCandidates: MentionCandidate[] = useMemo(
		() =>
			(collaboratorsQuery.data ?? []).map((c) => ({
				id: c.login,
				label: c.login,
				avatarUrl: c.avatarUrl,
			})),
		[collaboratorsQuery.data],
	);

	const mentionConfig = useMemo(
		() => ({
			candidates: mentionCandidates,
			isLoading: collaboratorsQuery.isLoading,
		}),
		[mentionCandidates, collaboratorsQuery.isLoading],
	);

	const toggleLabel = useCallback((label: GitHubLabel) => {
		setSelectedLabels((prev) => {
			const exists = prev.some((l) => l.name === label.name);
			if (exists) return prev.filter((l) => l.name !== label.name);
			return [...prev, label];
		});
	}, []);

	const toggleAssignee = useCallback((collaborator: RepoCollaborator) => {
		setSelectedAssignees((prev) => {
			const exists = prev.some((a) => a.login === collaborator.login);
			if (exists) return prev.filter((a) => a.login !== collaborator.login);
			return [...prev, collaborator];
		});
	}, []);

	const handleSubmit = async () => {
		if (!title.trim()) return;
		setSubmitting(true);
		setError(null);

		try {
			const result = await createIssue({
				data: {
					owner,
					repo,
					title: title.trim(),
					body: body.trim() || undefined,
					labels:
						selectedLabels.length > 0
							? selectedLabels.map((l) => l.name)
							: undefined,
					assignees:
						selectedAssignees.length > 0
							? selectedAssignees.map((a) => a.login)
							: undefined,
				},
			});

			if (result.ok) {
				await queryClient.invalidateQueries({
					predicate: (query) => {
						const key = query.queryKey;
						return (
							Array.isArray(key) &&
							key.some(
								(k) =>
									typeof k === "string" &&
									(k.includes("issues") || k.includes("repoMeta")),
							)
						);
					},
				});
				router.navigate({
					to: "/$owner/$repo/issues/$issueId",
					params: { owner, repo, issueId: String(result.issueNumber) },
				});
			} else {
				setError(result.error);
			}
		} catch {
			setError("Failed to create issue. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	const canSubmit = title.trim().length > 0 && !submitting;

	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-16 px-3 py-10 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				{/* Main */}
				<div className="flex min-w-0 flex-col gap-6">
					{/* Breadcrumb */}
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Link
							to="/$owner/$repo"
							params={{ owner, repo }}
							className="transition-colors hover:text-foreground"
						>
							{owner}/{repo}
						</Link>
						<span>/</span>
						<span>New issue</span>
					</div>

					{/* Header */}
					<div className="flex items-center gap-3">
						<div className="shrink-0 text-green-500">
							<IssuesIcon size={20} strokeWidth={2} />
						</div>
						<h1 className="text-xl font-semibold tracking-tight">
							Create new issue
						</h1>
					</div>

					{/* Title */}
					<div className="flex flex-col gap-2">
						<label
							htmlFor="issue-title"
							className="text-sm font-medium text-foreground"
						>
							Title <span className="text-destructive">*</span>
						</label>
						<input
							id="issue-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Issue title"
							className="flex h-9 w-full rounded-md border bg-surface-1 px-3 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
						/>
					</div>

					{/* Body */}
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-foreground">
							Description
						</span>
						<MarkdownEditor
							value={body}
							onChange={setBody}
							placeholder="Describe the issue..."
							mentions={mentionConfig}
						/>
					</div>

					{/* Error */}
					{error && (
						<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{error}
						</div>
					)}

					{/* Actions */}
					<div className="flex items-center justify-end gap-3">
						<Button variant="ghost" asChild>
							<Link to="/$owner/$repo" params={{ owner, repo }}>
								Cancel
							</Link>
						</Button>
						<Button
							disabled={!canSubmit}
							onClick={handleSubmit}
							iconLeft={
								submitting ? (
									<Spinner size={14} />
								) : (
									<IssuesIcon size={14} strokeWidth={2} />
								)
							}
						>
							Create issue
						</Button>
					</div>
				</div>

				{/* Sidebar */}
				<NewIssueSidebar
					repoLabels={repoLabels}
					selectedLabels={selectedLabels}
					onToggleLabel={toggleLabel}
					isLoading={labelsQuery.isLoading}
					selectedAssignees={selectedAssignees}
					onToggleAssignee={toggleAssignee}
					scope={scope}
					owner={owner}
					repo={repo}
				/>
			</div>
		</div>
	);
}

function NewIssueSidebar({
	repoLabels,
	selectedLabels,
	onToggleLabel,
	isLoading,
	selectedAssignees,
	onToggleAssignee,
	scope,
	owner,
	repo,
}: {
	repoLabels: GitHubLabel[];
	selectedLabels: GitHubLabel[];
	onToggleLabel: (label: GitHubLabel) => void;
	isLoading: boolean;
	selectedAssignees: RepoCollaborator[];
	onToggleAssignee: (collaborator: RepoCollaborator) => void;
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
}) {
	return (
		<DetailSidebar>
			<AssigneesSection
				selectedAssignees={selectedAssignees}
				onToggleAssignee={onToggleAssignee}
				scope={scope}
				owner={owner}
				repo={repo}
			/>

			<NewIssueLabelsPicker
				repoLabels={repoLabels}
				selectedLabels={selectedLabels}
				onToggleLabel={onToggleLabel}
				isLoading={isLoading}
			/>
		</DetailSidebar>
	);
}

function NewIssueLabelsPicker({
	repoLabels,
	selectedLabels,
	onToggleLabel,
	isLoading,
}: {
	repoLabels: GitHubLabel[];
	selectedLabels: GitHubLabel[];
	onToggleLabel: (label: GitHubLabel) => void;
	isLoading: boolean;
}) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement>(null);

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
		const el = listRef.current?.querySelector(`[data-index="${index}"]`);
		if (el) {
			el.scrollIntoView({ block: "nearest" });
		}
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
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (focusedIndex >= 0 && focusedIndex < filtered.length) {
				onToggleLabel(filtered[focusedIndex]);
			}
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Labels
				</h3>
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
								onChange={(e) => {
									setSearch(e.target.value);
									setFocusedIndex(-1);
								}}
								onKeyDown={handleKeyDown}
								placeholder="Search labels..."
								className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							/>
						</div>
						<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
							{isLoading ? (
								<p className="px-3 py-4 text-center text-xs text-muted-foreground">
									Loading…
								</p>
							) : filtered.length === 0 ? (
								<p className="px-3 py-4 text-center text-xs text-muted-foreground">
									{search ? "No labels found" : "No labels available"}
								</p>
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
											className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 ${focusedIndex === i ? "bg-surface-1" : ""}`}
										>
											<span
												className="size-3 shrink-0 rounded-full"
												style={{
													backgroundColor: `#${label.color}`,
												}}
											/>
											<span className="min-w-0 flex-1 truncate">
												{label.name}
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
								})
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
			{selectedLabels.length > 0 ? (
				<div className="flex flex-wrap gap-1.5">
					{selectedLabels.map((label) => (
						<span
							key={label.name}
							className="group/label label-pill relative rounded-full px-2.5 py-0.5 text-xs font-medium"
							style={
								{
									"--label-color": `#${label.color}`,
								} as React.CSSProperties
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

function AssigneesSection({
	selectedAssignees,
	onToggleAssignee,
	scope,
	owner,
	repo,
}: {
	selectedAssignees: RepoCollaborator[];
	onToggleAssignee: (collaborator: RepoCollaborator) => void;
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
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

	const prefetchCollaborators = useCallback(() => {
		void queryClient.prefetchQuery(collaboratorsOptions);
	}, [queryClient, collaboratorsOptions]);

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
		const el = listRef.current?.querySelector(`[data-index="${index}"]`);
		if (el) {
			el.scrollIntoView({ block: "nearest" });
		}
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
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (focusedIndex >= 0 && focusedIndex < filtered.length) {
				onToggleAssignee(filtered[focusedIndex]);
			}
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Assignees
				</h3>
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
							onMouseEnter={prefetchCollaborators}
							onFocus={prefetchCollaborators}
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
								onChange={(e) => {
									setSearch(e.target.value);
									setFocusedIndex(-1);
								}}
								onKeyDown={handleKeyDown}
								placeholder="Search people..."
								className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							/>
						</div>
						<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
							{collaboratorsQuery.isLoading ? (
								<p className="px-3 py-4 text-center text-xs text-muted-foreground">
									Loading…
								</p>
							) : filtered.length === 0 ? (
								<p className="px-3 py-4 text-center text-xs text-muted-foreground">
									{search ? "No people found" : "No collaborators available"}
								</p>
							) : (
								filtered.map((collaborator, i) => {
									const isSelected = selectedLogins.has(collaborator.login);
									return (
										<button
											key={collaborator.login}
											type="button"
											data-index={i}
											onClick={() => onToggleAssignee(collaborator)}
											onMouseEnter={() => setFocusedIndex(i)}
											className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 ${focusedIndex === i ? "bg-surface-1" : ""}`}
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
								})
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
			{selectedAssignees.length > 0 ? (
				<div className="flex flex-col gap-2">
					{selectedAssignees.map((assignee) => (
						<div
							key={assignee.login}
							className="group/assignee flex items-center gap-2"
						>
							<img
								src={assignee.avatarUrl}
								alt={assignee.login}
								className="size-5 rounded-full border border-border"
							/>
							<span className="min-w-0 flex-1 truncate text-sm">
								{assignee.login}
							</span>
							<button
								type="button"
								onClick={() => onToggleAssignee(assignee)}
								className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-red-400 group-hover/assignee:opacity-100"
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
