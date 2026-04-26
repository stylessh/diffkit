import type { MentionCandidate } from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetailPageSkeletonLayout } from "#/components/details/detail-page";
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
			<div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-20 text-center">
				<h1 className="text-lg font-semibold">Nothing to compare</h1>
				<p className="text-sm text-muted-foreground">
					<code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
						{base}
					</code>{" "}
					and{" "}
					<code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
						{head}
					</code>{" "}
					are identical, or one of them doesn't exist.
				</p>
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto flex max-w-7xl flex-col gap-10 px-3 py-10 md:px-6">
				{showForm ? (
					<div className="grid gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
						<div className="flex min-w-0 flex-col gap-8">
							<CompareHeader
								owner={owner}
								repo={repo}
								base={base}
								head={head}
								compare={compare}
							/>
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
				) : (
					<CompareHeader
						owner={owner}
						repo={repo}
						base={base}
						head={head}
						compare={compare}
					/>
				)}

				<CompareDiffView
					commits={compare.commits}
					files={compare.files}
					filesTruncated={compare.filesTruncated}
					owner={owner}
					repo={repo}
				/>
			</div>
		</div>
	);
}

function ComparePageSkeleton() {
	return (
		<DetailPageSkeletonLayout>
			<div className="flex flex-col gap-3">
				<div className="h-4 w-32 animate-pulse rounded bg-surface-1" />
				<div className="h-7 w-3/5 animate-pulse rounded bg-surface-1" />
			</div>
			<div className="flex flex-col gap-3 rounded-lg border p-4">
				<div className="h-9 w-full animate-pulse rounded bg-surface-1" />
				<div className="h-32 w-full animate-pulse rounded bg-surface-1" />
			</div>
			<div className="h-40 w-full animate-pulse rounded-lg bg-surface-1" />
		</DetailPageSkeletonLayout>
	);
}
