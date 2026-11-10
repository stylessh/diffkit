import { CloseIcon, IssuesIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	MarkdownEditor,
	type MentionCandidate,
} from "@diffkit/ui/components/markdown-editor";
import { PageHeaderTitle } from "@diffkit/ui/components/page-header";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetailSidebar } from "#/components/details/detail-sidebar";
import { RepoCrumb, RepoPageHeader } from "#/components/repo/repo-page-header";
import { MentionSkeletonRows } from "#/components/shared/picker-skeleton-rows";
import { createIssue } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoCollaboratorsQueryOptions,
	githubRepoLabelsQueryOptions,
	githubRepoTemplateQueryOptions,
} from "#/lib/github.query";
import type { GitHubLabel, RepoCollaborator } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	issueEntityKey,
} from "#/lib/github-query-updates";
import { SidebarPicker, type SidebarPickerLeading } from "./sidebar-picker";

const NO_COLLABORATORS: RepoCollaborator[] = [];

const routeApi = getRouteApi("/_protected/$owner/$repo/issues/new");

type Submission =
	| { kind: "idle" }
	| { kind: "submitting" }
	| { kind: "failed"; message: string };

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
	const [submission, setSubmission] = useState<Submission>({ kind: "idle" });

	const labelsQuery = useQuery(
		githubRepoLabelsQueryOptions(scope, { owner, repo }),
	);
	const repoLabels = labelsQuery.data ?? [];

	const collaboratorsQuery = useQuery(
		githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
	);

	const templateQuery = useQuery(
		githubRepoTemplateQueryOptions(scope, { owner, repo, kind: "issue" }),
	);
	const templateAppliedRef = useRef(false);
	useEffect(() => {
		if (templateAppliedRef.current) return;
		const template = templateQuery.data;
		if (!template) return;
		templateAppliedRef.current = true;
		setBody((current) => (current ? current : template));
	}, [templateQuery.data]);

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
			isLoading: collaboratorsQuery.isPending,
			loadingPlaceholder: <MentionSkeletonRows />,
		}),
		[mentionCandidates, collaboratorsQuery.isPending],
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
		setSubmission({ kind: "submitting" });

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
				await invalidateGitHubEntities(
					queryClient,
					scope,
					[issueEntityKey({ owner, repo, issueNumber: result.issueNumber })],
					"created",
				);
				router.navigate({
					to: "/$owner/$repo/issues/$issueId",
					params: { owner, repo, issueId: String(result.issueNumber) },
				});
			} else {
				setSubmission({ kind: "failed", message: result.error });
			}
		} catch {
			setSubmission({
				kind: "failed",
				message: "Failed to create issue. Please try again.",
			});
		}
	};

	const submitting = submission.kind === "submitting";
	const canSubmit = title.trim().length > 0 && !submitting;

	return (
		<RepoPageHeader
			owner={owner}
			repo={repo}
			scope={scope}
			active="issues"
			trail={
				<>
					<RepoCrumb asChild>
						<Link to="/$owner/$repo/issues" params={{ owner, repo }}>
							Issues
						</Link>
					</RepoCrumb>
					<PageHeaderTitle asChild>
						<span>New issue</span>
					</PageHeaderTitle>
				</>
			}
			bodyClassName="px-0"
		>
			<div className="mx-auto grid max-w-7xl gap-16 px-4 pt-6 md:px-[46px] xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				<div className="flex min-w-0 flex-col gap-6">
					<h1 className="text-[22px] leading-8 font-semibold text-foreground">
						Create new issue
					</h1>

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
							className="flex h-9 w-full rounded-md border-[0.5px] bg-surface-1 px-3 py-1 text-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
						/>
					</div>

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

					{submission.kind === "failed" ? (
						<div
							role="alert"
							className="rounded-lg border-[0.5px] border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
						>
							{submission.message}
						</div>
					) : null}

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

				<NewIssueSidebar
					repoLabels={repoLabels}
					selectedLabels={selectedLabels}
					onToggleLabel={toggleLabel}
					isLabelsLoading={labelsQuery.isPending}
					collaborators={collaboratorsQuery.data ?? NO_COLLABORATORS}
					selectedAssignees={selectedAssignees}
					onToggleAssignee={toggleAssignee}
					isCollaboratorsLoading={collaboratorsQuery.isPending}
				/>
			</div>
		</RepoPageHeader>
	);
}

function NewIssueSidebar({
	repoLabels,
	selectedLabels,
	onToggleLabel,
	isLabelsLoading,
	collaborators,
	selectedAssignees,
	onToggleAssignee,
	isCollaboratorsLoading,
}: {
	repoLabels: GitHubLabel[];
	selectedLabels: GitHubLabel[];
	onToggleLabel: (label: GitHubLabel) => void;
	isLabelsLoading: boolean;
	collaborators: RepoCollaborator[];
	selectedAssignees: RepoCollaborator[];
	onToggleAssignee: (collaborator: RepoCollaborator) => void;
	isCollaboratorsLoading: boolean;
}) {
	return (
		<DetailSidebar>
			<AssigneesSection
				collaborators={collaborators}
				selectedAssignees={selectedAssignees}
				onToggleAssignee={onToggleAssignee}
				isLoading={isCollaboratorsLoading}
			/>
			<LabelsSection
				repoLabels={repoLabels}
				selectedLabels={selectedLabels}
				onToggleLabel={onToggleLabel}
				isLoading={isLabelsLoading}
			/>
		</DetailSidebar>
	);
}

const LABEL_LEADING: SidebarPickerLeading = { shape: "avatar", size: 12 };
const ASSIGNEE_LEADING: SidebarPickerLeading = { shape: "avatar", size: 20 };

const labelName = (label: GitHubLabel) => label.name;
const collaboratorLogin = (collaborator: RepoCollaborator) =>
	collaborator.login;

function LabelsSection({
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
	const selectedNames = useMemo(
		() => new Set(selectedLabels.map(labelName)),
		[selectedLabels],
	);

	return (
		<SidebarPicker
			title="Labels"
			placeholder="Search labels..."
			items={repoLabels}
			getName={labelName}
			renderLeading={(label) => (
				<span
					className="size-3 shrink-0 rounded-full"
					style={{ backgroundColor: `#${label.color}` }}
				/>
			)}
			leading={LABEL_LEADING}
			selectedNames={selectedNames}
			onToggle={onToggleLabel}
			loading={isLoading}
			emptyLabel="No labels available"
			noMatchLabel="No labels found"
		>
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
		</SidebarPicker>
	);
}

function AssigneesSection({
	collaborators,
	selectedAssignees,
	onToggleAssignee,
	isLoading,
}: {
	collaborators: RepoCollaborator[];
	selectedAssignees: RepoCollaborator[];
	onToggleAssignee: (collaborator: RepoCollaborator) => void;
	isLoading: boolean;
}) {
	const selectedLogins = useMemo(
		() => new Set(selectedAssignees.map(collaboratorLogin)),
		[selectedAssignees],
	);
	const people = useMemo(
		() => collaborators.filter((collaborator) => collaborator.type !== "Bot"),
		[collaborators],
	);

	return (
		<SidebarPicker
			title="Assignees"
			placeholder="Search people..."
			items={people}
			getName={collaboratorLogin}
			renderLeading={(collaborator) => (
				<img
					src={collaborator.avatarUrl}
					alt={collaborator.login}
					className="size-5 rounded-full ring-[0.5px] ring-chip-border"
				/>
			)}
			leading={ASSIGNEE_LEADING}
			selectedNames={selectedLogins}
			onToggle={onToggleAssignee}
			loading={isLoading}
			emptyLabel="No collaborators available"
			noMatchLabel="No people found"
		>
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
								className="size-5 rounded-full ring-[0.5px] ring-chip-border"
							/>
							<span className="min-w-0 flex-1 truncate text-sm">
								{assignee.login}
							</span>
							<button
								type="button"
								onClick={() => onToggleAssignee(assignee)}
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
		</SidebarPicker>
	);
}
