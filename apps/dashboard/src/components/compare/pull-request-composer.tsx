import {
	FileIcon,
	GitCommitHorizontalIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import { Checkbox } from "@diffkit/ui/components/checkbox";
import {
	LineCounts,
	PanelRow,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useMemo, useReducer, useState } from "react";
import { DetailSidebar, RepoRow } from "#/components/details/detail-sidebar";
import {
	DraftPage,
	type DraftSubmission,
} from "#/components/details/draft-page";
import { MentionSkeletonRows } from "#/components/shared/picker-skeleton-rows";
import type { CompareDetail } from "#/lib/github.functions";
import { createPullRequest } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoCollaboratorsQueryOptions,
	githubRepoTemplateQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import {
	invalidateGitHubEntities,
	milestonesEntityKey,
	pullEntityKey,
	repoEntityKey,
} from "#/lib/github-query-updates";
import {
	buildCreatePullRequestInput,
	emptyPullRequestDraft,
	pullRequestBody,
	pullRequestDraftReducer,
	pullRequestTitle,
	suggestPullRequestTitle,
} from "#/lib/pull-request-draft";
import type { CompareBranches } from "./compare-branch-bar";
import { CompareDiffView } from "./compare-diff-view";
import { CompareProperties } from "./compare-properties";
import { CompareRefPicker } from "./compare-ref-picker";
import {
	SAMPLE_COMPARE_COMMITS,
	SAMPLE_COMPARE_FILES,
} from "./compare-samples";

const SAMPLE_COMPARE: CompareDetail = {
	aheadBy: SAMPLE_COMPARE_COMMITS.length,
	behindBy: 0,
	status: "ahead",
	totalCommits: SAMPLE_COMPARE_COMMITS.length,
	mergeBaseSha: "sample",
	commits: SAMPLE_COMPARE_COMMITS,
	files: SAMPLE_COMPARE_FILES,
	filesTruncated: false,
};

function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** `compare` is null until the branches and the viewer's access are known. */
export function PullRequestComposer({
	compare,
	owner,
	repo,
	scope,
	base,
	head,
	defaultBranch,
	branches,
	onBaseChange,
	onHeadChange,
}: {
	compare: CompareDetail | null;
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	base: string;
	head: string;
	defaultBranch: string;
	branches: CompareBranches;
	onBaseChange: (ref: string) => void;
	onHeadChange: (ref: string) => void;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [draft, dispatch] = useReducer(
		pullRequestDraftReducer,
		emptyPullRequestDraft,
	);
	const [submission, setSubmission] = useState<DraftSubmission>({
		status: "idle",
	});

	const viewerQuery = useQuery(githubViewerQueryOptions(scope));
	const collaboratorsQuery = useQuery(
		githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
	);
	const templateQuery = useQuery(
		githubRepoTemplateQueryOptions(scope, { owner, repo, kind: "pr" }),
	);

	const mentions = useMemo<MentionConfig>(
		() => ({
			candidates: (collaboratorsQuery.data ?? []).map((collaborator) => ({
				id: collaborator.login,
				label: collaborator.login,
				avatarUrl: collaborator.avatarUrl,
			})),
			isLoading: collaboratorsQuery.isPending,
			loadingPlaceholder: <MentionSkeletonRows />,
		}),
		[collaboratorsQuery.data, collaboratorsQuery.isPending],
	);

	const detail = compare ?? SAMPLE_COMPARE;
	const titleSuggestion = suggestPullRequestTitle(detail.commits, head);
	const bodyTemplate = templateQuery.data ?? "";
	const additions = detail.files.reduce((sum, f) => sum + f.additions, 0);
	const deletions = detail.files.reduce((sum, f) => sum + f.deletions, 0);
	const pickerProps = {
		branches: branches.items,
		defaultBranch,
		loading: branches.loading,
		truncated: branches.truncated,
	};

	const handleSubmit = async () => {
		const input = buildCreatePullRequestInput({
			owner,
			repo,
			base,
			head,
			draft,
			titleSuggestion,
			bodyTemplate,
		});
		if (!input) return;

		setSubmission({ status: "submitting" });
		const result = await createPullRequest({ data: input }).catch(() => null);
		if (!result?.ok) {
			setSubmission({
				status: "failed",
				message:
					result?.error || "Failed to create pull request. Please try again.",
			});
			return;
		}
		// The pull request exists from here on, so nothing below may offer Create again.
		try {
			await invalidateGitHubEntities(
				queryClient,
				scope,
				[
					pullEntityKey({ owner, repo, pullNumber: result.pullNumber }),
					repoEntityKey({ owner, repo }),
					...(draft.milestone ? [milestonesEntityKey({ owner, repo })] : []),
				],
				"created",
			);
		} finally {
			if (result.warnings && result.warnings.length > 0) {
				toast.warning("Pull request created with some issues", {
					description: result.warnings.join("\n"),
				});
			}
			await router.navigate({
				to: "/$owner/$repo/pull/$pullId",
				params: { owner, repo, pullId: String(result.pullNumber) },
			});
		}
	};

	return (
		<DraftPage
			owner={owner}
			repo={repo}
			heading="New pull request"
			loading={compare === null}
			title={pullRequestTitle(draft, titleSuggestion)}
			titlePlaceholder="Pull request title"
			onTitleChange={(value) => dispatch({ type: "title-edited", value })}
			body={pullRequestBody(draft, bodyTemplate)}
			bodyPrompt="Describe the changes"
			onBodyChange={(value) => dispatch({ type: "body-edited", value })}
			mentions={mentions}
			submission={submission}
			submitLabel={
				draft.isDraft ? "Create draft pull request" : "Create pull request"
			}
			submitIcon={<GitPullRequestIcon size={14} strokeWidth={2} />}
			cancel={
				<Link to="/$owner/$repo/pulls" params={{ owner, repo }}>
					Cancel
				</Link>
			}
			onSubmit={handleSubmit}
			titleDetail={
				<div className="flex flex-wrap items-center gap-2 text-xs font-[450] text-muted-foreground">
					<span>Merge into</span>
					<CompareRefPicker
						{...pickerProps}
						label="Base branch"
						value={base}
						placeholder="Choose base"
						onSelect={onBaseChange}
					/>
					<span>from</span>
					<CompareRefPicker
						{...pickerProps}
						label="Compare branch"
						value={head}
						placeholder="Choose a branch"
						onSelect={onHeadChange}
					/>
				</div>
			}
			files={
				compare
					? {
							count: compare.files.length,
							additions,
							deletions,
							content: (
								<CompareDiffView
									commits={compare.commits}
									files={compare.files}
									filesTruncated={compare.filesTruncated}
									mergeBaseSha={compare.mergeBaseSha}
									owner={owner}
									repo={repo}
								/>
							),
						}
					: undefined
			}
			panel={
				<DetailSidebar>
					<PanelSection label="Properties">
						<RepoRow owner={owner} repo={repo} />
						<PanelRow
							muted
							icon={<GitCommitHorizontalIcon size={14} strokeWidth={2} />}
						>
							{plural(detail.aheadBy, "commit")} ahead
						</PanelRow>
						<PanelRow muted icon={<FileIcon size={14} strokeWidth={2} />}>
							{plural(detail.files.length, "file")}
							<LineCounts
								additions={additions}
								deletions={deletions}
								className="text-xs"
							/>
						</PanelRow>
						<label
							htmlFor="pr-draft"
							className="mt-1 flex h-7 w-fit cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] font-[450] text-text-header"
						>
							<Checkbox
								id="pr-draft"
								checked={draft.isDraft}
								disabled={submission.status === "submitting"}
								onCheckedChange={(checked) =>
									dispatch({ type: "draft-set", value: checked === true })
								}
							/>
							Create as draft
						</label>
					</PanelSection>
					<CompareProperties
						owner={owner}
						repo={repo}
						scope={scope}
						viewerLogin={viewerQuery.data?.login ?? null}
						draft={draft}
						dispatch={dispatch}
					/>
				</DetailSidebar>
			}
		/>
	);
}
