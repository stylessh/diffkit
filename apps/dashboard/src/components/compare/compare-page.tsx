import { GitCompareIcon, GitPullRequestIcon } from "@diffkit/icons";
import { BranchBadge } from "@diffkit/ui/components/detail-layout";
import type { MentionCandidate } from "@diffkit/ui/components/markdown-editor";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { toast } from "@diffkit/ui/components/sonner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	DetailPageSkeletonLayout,
	StaggerItem,
} from "#/components/details/detail-page";
import { createPullRequest } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubCompareDetailQueryOptions,
	githubRepoCollaboratorsQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoTemplateQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type {
	GitHubLabel,
	OrgTeam,
	RepoCollaborator,
} from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { CompareDiffView } from "./compare-diff-view";
import { CompareForm } from "./compare-form";
import { CompareHeader } from "./compare-header";
import { CompareSidebar } from "./compare-sidebar";

export function ComparePage({
	owner,
	repo,
	base,
	head,
	scope,
	showForm = false,
}: {
	owner: string;
	repo: string;
	base: string;
	head: string;
	scope: GitHubQueryScope;
	showForm?: boolean;
}) {
	const hasMounted = useHasMounted();
	const router = useRouter();
	const queryClient = useQueryClient();

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});
	const compareQuery = useQuery({
		...githubCompareDetailQueryOptions(scope, { owner, repo, base, head }),
		enabled: hasMounted,
	});
	const collaboratorsQuery = useQuery({
		...githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const templateQuery = useQuery({
		...githubRepoTemplateQueryOptions(scope, { owner, repo, kind: "pr" }),
		enabled: hasMounted && showForm,
	});

	const repoData = overviewQuery.data;
	const viewer = viewerQuery.data ?? null;
	const compare = compareQuery.data;

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

	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const templateAppliedRef = useRef(false);
	useEffect(() => {
		if (!showForm) return;
		if (templateAppliedRef.current) return;
		const template = templateQuery.data;
		if (!template) return;
		templateAppliedRef.current = true;
		setBody((current) => (current ? current : template));
	}, [showForm, templateQuery.data]);
	const [selectedLabels, setSelectedLabels] = useState<GitHubLabel[]>([]);
	const [selectedAssignees, setSelectedAssignees] = useState<
		RepoCollaborator[]
	>([]);
	const [selectedReviewers, setSelectedReviewers] = useState<
		RepoCollaborator[]
	>([]);
	const [selectedTeamReviewers, setSelectedTeamReviewers] = useState<OrgTeam[]>(
		[],
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const toggleLabel = useCallback((label: GitHubLabel) => {
		setSelectedLabels((prev) =>
			prev.some((l) => l.name === label.name)
				? prev.filter((l) => l.name !== label.name)
				: [...prev, label],
		);
	}, []);

	const toggleAssignee = useCallback((c: RepoCollaborator) => {
		setSelectedAssignees((prev) =>
			prev.some((a) => a.login === c.login)
				? prev.filter((a) => a.login !== c.login)
				: [...prev, c],
		);
	}, []);

	const toggleReviewer = useCallback((c: RepoCollaborator) => {
		setSelectedReviewers((prev) =>
			prev.some((r) => r.login === c.login)
				? prev.filter((r) => r.login !== c.login)
				: [...prev, c],
		);
	}, []);

	const toggleTeamReviewer = useCallback((t: OrgTeam) => {
		setSelectedTeamReviewers((prev) =>
			prev.some((r) => r.slug === t.slug)
				? prev.filter((r) => r.slug !== t.slug)
				: [...prev, t],
		);
	}, []);

	const handleSubmit = useCallback(
		async (draft: boolean) => {
			if (!title.trim()) return;
			setSubmitting(true);
			setError(null);

			try {
				const result = await createPullRequest({
					data: {
						owner,
						repo,
						base,
						head,
						title: title.trim(),
						body: body.trim() || undefined,
						draft,
						labels:
							selectedLabels.length > 0
								? selectedLabels.map((l) => l.name)
								: undefined,
						assignees:
							selectedAssignees.length > 0
								? selectedAssignees.map((a) => a.login)
								: undefined,
						reviewers:
							selectedReviewers.length > 0
								? selectedReviewers.map((r) => r.login)
								: undefined,
						teamReviewers:
							selectedTeamReviewers.length > 0
								? selectedTeamReviewers.map((t) => t.slug)
								: undefined,
					},
				});

				if (result.ok) {
					const INVALIDATE_SEGMENTS = new Set([
						"pulls",
						"overview",
						"recentPushableBranch",
						"branchComparison",
						"compareDetail",
					]);
					await queryClient.invalidateQueries({
						predicate: (query) => {
							const key = query.queryKey;
							if (!Array.isArray(key)) return false;
							return key.some(
								(k) => typeof k === "string" && INVALIDATE_SEGMENTS.has(k),
							);
						},
					});
					if (result.warnings && result.warnings.length > 0) {
						toast.warning("Pull request created with some issues", {
							description: result.warnings.join("\n"),
						});
					}
					router.navigate({
						to: "/$owner/$repo/pull/$pullId",
						params: { owner, repo, pullId: String(result.pullNumber) },
					});
				} else {
					setError(result.error || "Failed to create pull request.");
				}
			} catch {
				setError("Failed to create pull request. Please try again.");
			} finally {
				setSubmitting(false);
			}
		},
		[
			base,
			body,
			head,
			owner,
			queryClient,
			repo,
			router,
			selectedAssignees,
			selectedLabels,
			selectedReviewers,
			selectedTeamReviewers,
			title,
		],
	);

	if (overviewQuery.error) throw overviewQuery.error;
	if (compareQuery.error) throw compareQuery.error;
	if (overviewQuery.isPending || compareQuery.isPending) {
		return <ComparePageSkeleton />;
	}
	if (!repoData) return <ComparePageSkeleton />;
	if (!compare) {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<ComparePageHeader owner={owner} repo={repo} title="Compare changes" />
				<div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-6 py-20 text-center">
					<h2 className="text-[15px] font-medium text-foreground">
						Nothing to compare
					</h2>
					<p className="text-[13px] font-[450] text-muted-foreground">
						<BranchBadge>{base}</BranchBadge> and{" "}
						<BranchBadge>{head}</BranchBadge> are identical, or one of them
						doesn't exist.
					</p>
				</div>
			</div>
		);
	}

	const refs = (
		<CompareHeader
			owner={owner}
			repo={repo}
			base={base}
			head={head}
			compare={compare}
		/>
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<ComparePageHeader
				owner={owner}
				repo={repo}
				title={showForm ? "Open a pull request" : "Compare changes"}
				actions={
					!showForm && compare.aheadBy > 0 ? (
						<Link
							to="/$owner/$repo/compare/$"
							params={{ owner, repo, _splat: `${base}...${head}` }}
							search={{ expand: 1 }}
							className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-indigo px-3 text-xs font-medium text-indigo-foreground shadow-[0_1px_1px_0_lch(0_0_0/0.12),0_3px_6px_-2px_lch(0_0_0/0.12)] transition-colors hover:bg-indigo/90"
						>
							<GitPullRequestIcon size={14} strokeWidth={2} />
							Create pull request
						</Link>
					) : undefined
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{showForm ? (
					<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,34%)]">
						<div className="mx-auto flex w-full max-w-[780px] min-w-0 flex-col gap-6 px-4 pt-6 pb-12 md:px-[46px]">
							{refs}
							<CompareForm
								owner={owner}
								repo={repo}
								title={title}
								body={body}
								onTitleChange={setTitle}
								onBodyChange={setBody}
								onSubmit={handleSubmit}
								submitting={submitting}
								error={error}
								canSubmit={title.trim().length > 0 && compare.aheadBy > 0}
								mentionConfig={mentionConfig}
							/>
						</div>
						<aside
							aria-label="Pull request properties"
							className="min-w-0 self-start px-4 pt-2 pb-10 md:px-[46px] lg:pt-6 lg:pr-3 lg:pl-0"
						>
							<div className="flex max-w-80 flex-col">
								<CompareSidebar
									owner={owner}
									repo={repo}
									scope={scope}
									viewerLogin={viewer?.login ?? null}
									selectedLabels={selectedLabels}
									onToggleLabel={toggleLabel}
									selectedAssignees={selectedAssignees}
									onToggleAssignee={toggleAssignee}
									selectedReviewers={selectedReviewers}
									onToggleReviewer={toggleReviewer}
									selectedTeamReviewers={selectedTeamReviewers}
									onToggleTeamReviewer={toggleTeamReviewer}
								/>
							</div>
						</aside>
					</div>
				) : null}

				<div
					className={cn(
						"px-[14px] pb-6 max-md:px-2",
						showForm ? "border-t-[0.5px] border-header-rule pt-4" : "pt-2",
					)}
				>
					<CompareDiffView
						header={showForm ? undefined : refs}
						commits={compare.commits}
						files={compare.files}
						filesTruncated={compare.filesTruncated}
						owner={owner}
						repo={repo}
					/>
				</div>
			</div>
		</div>
	);
}

/** The page's breadcrumb row: the repository › what this page does. */
function ComparePageHeader({
	owner,
	repo,
	title,
	actions,
}: {
	owner: string;
	repo: string;
	title: string;
	actions?: ReactNode;
}) {
	return (
		<PageHeader actions={actions}>
			<PageHeaderCrumb asChild>
				<Link to="/$owner/$repo" params={{ owner, repo }}>
					{owner}/{repo}
				</Link>
			</PageHeaderCrumb>
			<PageHeaderTitle>
				<GitCompareIcon
					size={14}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
				{title}
			</PageHeaderTitle>
		</PageHeader>
	);
}

function ComparePageSkeleton() {
	return (
		<DetailPageSkeletonLayout mainItemCount={3}>
			<StaggerItem index={0}>
				<div className="flex flex-col gap-3">
					<div className="h-4 w-32 animate-pulse rounded bg-surface-1" />
					<div className="h-7 w-3/5 animate-pulse rounded bg-surface-1" />
				</div>
			</StaggerItem>
			<StaggerItem index={1}>
				<div className="flex flex-col gap-3 rounded-lg border-[0.5px] p-4">
					<div className="h-9 w-full animate-pulse rounded bg-surface-1" />
					<div className="h-32 w-full animate-pulse rounded bg-surface-1" />
				</div>
			</StaggerItem>
			<StaggerItem index={2}>
				<div className="h-40 w-full animate-pulse rounded-lg bg-surface-1" />
			</StaggerItem>
		</DetailPageSkeletonLayout>
	);
}
