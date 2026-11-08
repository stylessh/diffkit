import { GitCompareIcon, GitPullRequestIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Callout, CalloutContent } from "@diffkit/ui/components/callout";
import { BranchBadge } from "@diffkit/ui/components/detail-layout";
import type { MentionCandidate } from "@diffkit/ui/components/markdown-editor";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { toast } from "@diffkit/ui/components/sonner";
import {
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { type ReactNode, useMemo, useReducer, useState } from "react";
import {
	type CompareRefs,
	formatCompareSplat,
	resolveCompareRefs,
} from "#/lib/compare-ref";
import type { CompareDetail } from "#/lib/github.functions";
import { createPullRequest } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubCompareDetailQueryOptions,
	githubRepoBranchesListInfiniteQueryOptions,
	githubRepoCollaboratorsQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoTemplateQueryOptions,
	githubRepoViewerPermissionQueryOptions,
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
	type PullRequestAccess,
	pullRequestAccess,
	pullRequestBody,
	pullRequestDraftReducer,
	pullRequestTitle,
	suggestPullRequestTitle,
} from "#/lib/pull-request-draft";
import { useHasMounted } from "#/lib/use-has-mounted";
import { CompareBranchBar, type CompareBranches } from "./compare-branch-bar";
import { CompareDiffView } from "./compare-diff-view";
import { CompareForm, type SubmitState } from "./compare-form";
import { CompareProperties } from "./compare-properties";
import { CompareRecentBranches } from "./compare-recent-branches";

type CompareView =
	| { kind: "choose-branch" }
	| { kind: "loading" }
	| { kind: "unavailable" }
	| { kind: "ready"; compare: CompareDetail };

function resolveCompareView(
	head: string | null,
	query: { isPending: boolean; data: CompareDetail | null | undefined },
): CompareView {
	if (head === null) return { kind: "choose-branch" };
	if (query.isPending) return { kind: "loading" };
	return query.data
		? { kind: "ready", compare: query.data }
		: { kind: "unavailable" };
}

export function ComparePage({
	owner,
	repo,
	refs,
	scope,
	showForm,
}: {
	owner: string;
	repo: string;
	refs: CompareRefs;
	scope: GitHubQueryScope;
	showForm: boolean;
}) {
	const hasMounted = useHasMounted();
	const router = useRouter();

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const branchesQuery = useInfiniteQuery({
		...githubRepoBranchesListInfiniteQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const defaultBranch = overviewQuery.data?.defaultBranch ?? null;
	const resolved = defaultBranch
		? resolveCompareRefs(refs, defaultBranch)
		: null;

	const permissionQuery = useQuery({
		...githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const compareQuery = useQuery({
		...githubCompareDetailQueryOptions(scope, {
			owner,
			repo,
			base: resolved?.base ?? "",
			head: resolved?.head ?? "",
		}),
		enabled: hasMounted && Boolean(resolved?.base && resolved.head),
	});

	if (overviewQuery.error) throw overviewQuery.error;
	if (!resolved?.base || !defaultBranch) return <ComparePageSkeleton />;

	const firstBranchPage = branchesQuery.data?.pages[0];
	const branches: CompareBranches = {
		items: firstBranchPage?.branches ?? [],
		loading: branchesQuery.isPending,
		truncated: firstBranchPage?.hasNextPage ?? false,
	};
	const { base, head } = resolved;
	const view = resolveCompareView(head, compareQuery);
	const access = pullRequestAccess({
		permission: permissionQuery.data,
		head: head ?? "",
		repoOwner: owner,
	});
	const compare = view.kind === "ready" ? view.compare : null;
	const existingPull =
		branches.items.find((branch) => branch.name === head)?.pullRequest ?? null;
	const openPull = existingPull?.state === "OPEN" ? existingPull : null;

	const navigateTo = (next: { base: string; head: string | null }) => {
		void router.navigate({
			to: "/$owner/$repo/compare/$",
			params: {
				owner,
				repo,
				_splat: formatCompareSplat(next.base, next.head),
			},
			search: showForm ? { expand: 1 } : {},
		});
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader
				actions={
					view.kind === "ready" &&
					view.compare.aheadBy > 0 &&
					!showForm &&
					access === "allowed" ? (
						openPull ? (
							<Button asChild variant="outline" size="sm">
								<Link
									to="/$owner/$repo/pull/$pullId"
									params={{ owner, repo, pullId: String(openPull.number) }}
								>
									<GitPullRequestIcon size={14} strokeWidth={2} />
									View <ShortPullRequest /> #{openPull.number}
								</Link>
							</Button>
						) : (
							<CreatePullRequestLink
								owner={owner}
								repo={repo}
								base={base}
								head={head}
							/>
						)
					) : undefined
				}
			>
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
					{showForm ? "Open a pull request" : "Compare changes"}
				</PageHeaderTitle>
			</PageHeader>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="flex flex-col gap-4 px-3 pt-3 pb-10 md:px-[14px]">
					<CompareBranchBar
						base={base}
						head={head}
						defaultBranch={defaultBranch}
						branches={branches}
						compare={compare}
						onBaseChange={(next) => navigateTo({ base: next, head })}
						onHeadChange={(next) => navigateTo({ base, head: next })}
					/>
					<CompareBody
						view={view}
						owner={owner}
						repo={repo}
						scope={scope}
						base={base}
						head={head}
						defaultBranch={defaultBranch}
						branches={branches}
						showForm={showForm}
						access={access}
					/>
				</div>
			</div>
		</div>
	);
}

function CompareBody({
	view,
	owner,
	repo,
	scope,
	base,
	head,
	defaultBranch,
	branches,
	showForm,
	access,
}: {
	view: CompareView;
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	base: string;
	head: string | null;
	defaultBranch: string;
	branches: CompareBranches;
	showForm: boolean;
	access: PullRequestAccess;
}) {
	switch (view.kind) {
		case "choose-branch":
			return (
				<CompareRecentBranches
					owner={owner}
					repo={repo}
					base={base}
					defaultBranch={defaultBranch}
					branches={branches}
				/>
			);
		case "loading":
			return <CompareBodySkeleton />;
		case "unavailable":
			return <NothingToCompare base={base} head={head} />;
		case "ready":
			return (
				<CompareReady
					compare={view.compare}
					owner={owner}
					repo={repo}
					scope={scope}
					base={base}
					head={head as string}
					showForm={showForm}
					access={access}
				/>
			);
	}
}

function CompareReady({
	compare,
	owner,
	repo,
	scope,
	base,
	head,
	showForm,
	access,
}: {
	compare: CompareDetail;
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	base: string;
	head: string;
	showForm: boolean;
	access: PullRequestAccess;
}) {
	return (
		<>
			{showForm ? (
				compare.aheadBy === 0 ? (
					<Notice>
						{head} has no commits that {base} doesn't, so there is nothing to
						open a pull request for.
					</Notice>
				) : (
					<PullRequestComposer
						compare={compare}
						access={access}
						owner={owner}
						repo={repo}
						scope={scope}
						base={base}
						head={head}
					/>
				)
			) : null}
			<CompareDiffView
				commits={compare.commits}
				files={compare.files}
				filesTruncated={compare.filesTruncated}
				owner={owner}
				repo={repo}
			/>
		</>
	);
}

function PullRequestComposer({
	compare,
	access,
	owner,
	repo,
	scope,
	base,
	head,
}: {
	compare: CompareDetail;
	access: PullRequestAccess;
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	base: string;
	head: string;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [draft, dispatch] = useReducer(
		pullRequestDraftReducer,
		emptyPullRequestDraft,
	);
	const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

	const viewerQuery = useQuery(githubViewerQueryOptions(scope));
	const collaboratorsQuery = useQuery(
		githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
	);
	const templateQuery = useQuery(
		githubRepoTemplateQueryOptions(scope, { owner, repo, kind: "pr" }),
	);

	const mentionConfig = useMemo(() => {
		const candidates: MentionCandidate[] = (collaboratorsQuery.data ?? []).map(
			(collaborator) => ({
				id: collaborator.login,
				label: collaborator.login,
				avatarUrl: collaborator.avatarUrl,
			}),
		);
		return { candidates, isLoading: collaboratorsQuery.isLoading };
	}, [collaboratorsQuery.data, collaboratorsQuery.isLoading]);

	const titleSuggestion = suggestPullRequestTitle(compare.commits, head);
	const bodyTemplate = templateQuery.data ?? "";
	const title = pullRequestTitle(draft, titleSuggestion);
	const body = pullRequestBody(draft, bodyTemplate);

	if (access === "checking") return <ComposerSkeleton />;
	if (access === "read-only") {
		return (
			<Notice>
				You don't have push access to {owner}/{repo}. To open a pull request,
				compare from a fork by choosing its branch as{" "}
				<span className="font-mono">owner:branch</span>.
			</Notice>
		);
	}

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

		setSubmit({ status: "submitting" });
		try {
			const result = await createPullRequest({ data: input });
			if (!result.ok) {
				setSubmit({
					status: "failed",
					message: result.error || "Failed to create pull request.",
				});
				return;
			}
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
			if (result.warnings && result.warnings.length > 0) {
				toast.warning("Pull request created with some issues", {
					description: result.warnings.join("\n"),
				});
			}
			await router.navigate({
				to: "/$owner/$repo/pull/$pullId",
				params: { owner, repo, pullId: String(result.pullNumber) },
			});
		} catch {
			setSubmit({
				status: "failed",
				message: "Failed to create pull request. Please try again.",
			});
		}
	};

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,34%)]">
			<div className="mx-auto w-full max-w-[780px] min-w-0">
				<CompareForm
					owner={owner}
					repo={repo}
					title={title}
					body={body}
					isDraft={draft.isDraft}
					submit={submit}
					canSubmit={title.trim() !== ""}
					mentionConfig={mentionConfig}
					onTitleChange={(value) => dispatch({ type: "title-edited", value })}
					onBodyChange={(value) => dispatch({ type: "body-edited", value })}
					onDraftChange={(value) => dispatch({ type: "draft-set", value })}
					onSubmit={handleSubmit}
				/>
			</div>
			<aside aria-label="Pull request properties" className="min-w-0">
				<div className="flex max-w-80 flex-col">
					<CompareProperties
						owner={owner}
						repo={repo}
						scope={scope}
						viewerLogin={viewerQuery.data?.login ?? null}
						draft={draft}
						dispatch={dispatch}
					/>
				</div>
			</aside>
		</div>
	);
}

function CreatePullRequestLink({
	owner,
	repo,
	base,
	head,
}: {
	owner: string;
	repo: string;
	base: string;
	head: string | null;
}) {
	return (
		<Button asChild variant="accent" size="sm">
			<Link
				to="/$owner/$repo/compare/$"
				params={{ owner, repo, _splat: formatCompareSplat(base, head) }}
				search={{ expand: 1 }}
			>
				<GitPullRequestIcon size={14} strokeWidth={2} />
				Create <ShortPullRequest />
			</Link>
		</Button>
	);
}

function ShortPullRequest() {
	return (
		<>
			<span className="max-sm:hidden">pull request</span>
			<span className="sm:hidden">PR</span>
		</>
	);
}

function Notice({ children }: { children: ReactNode }) {
	return (
		<Callout>
			<CalloutContent className="text-muted-foreground">
				<span>{children}</span>
			</CalloutContent>
		</Callout>
	);
}

function NothingToCompare({
	base,
	head,
}: {
	base: string;
	head: string | null;
}) {
	return (
		<div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-6 py-16 text-center">
			<h2 className="text-[15px] font-medium text-foreground">
				Nothing to compare
			</h2>
			<p className="text-[13px] font-[450] text-muted-foreground">
				<BranchBadge>{base}</BranchBadge> and{" "}
				{head ? <BranchBadge>{head}</BranchBadge> : null} are identical, or one
				of them doesn't exist.
			</p>
		</div>
	);
}

function ComposerSkeleton() {
	return (
		<div className="flex flex-col gap-3">
			<Skeleton className="h-9 w-full rounded-lg" />
			<Skeleton className="h-48 w-full rounded-lg" />
		</div>
	);
}

function CompareBodySkeleton() {
	return (
		<div className="flex flex-col gap-2">
			<Skeleton className="h-9 w-full rounded-lg" />
			<Skeleton className="h-40 w-full rounded-lg" />
		</div>
	);
}

function ComparePageSkeleton() {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader>
				<PageHeaderTitle>
					<GitCompareIcon
						size={14}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
					Compare changes
				</PageHeaderTitle>
			</PageHeader>
			<div className="flex flex-col gap-4 px-3 pt-3 md:px-[14px]">
				<Skeleton className="h-12 w-full rounded-lg" />
				<CompareBodySkeleton />
			</div>
		</div>
	);
}
