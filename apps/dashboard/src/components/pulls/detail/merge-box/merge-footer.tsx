import { ChevronDownIcon, GitMergeIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Checkbox } from "@diffkit/ui/components/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { MenuCheck } from "@diffkit/ui/components/menu";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useReducer, useState } from "react";
import { mergePullRequest } from "#/lib/github.functions";
import type { GitHubQueryScope } from "#/lib/github.query";
import {
	invalidateGitHubEntities,
	pullEntityKey,
	removePullFromOpenViews,
	repoEntityKey,
} from "#/lib/github-query-updates";
import { reportMutationFailure } from "./mutation-failure";
import type { useMergeBypass } from "./use-merge-bypass";

const MERGE_STRATEGIES = [
	{ value: "merge", label: "Create a merge commit" },
	{ value: "squash", label: "Squash and merge" },
	{ value: "rebase", label: "Rebase and merge" },
] as const;

type MergeMethod = (typeof MERGE_STRATEGIES)[number]["value"];

type CommitDraft = { title: string; description: string };

type MergeState =
	| { phase: "idle" }
	| { phase: "confirming"; draft: CommitDraft }
	| { phase: "merging"; draft: CommitDraft };

type MergeEvent =
	| { type: "review"; title: string }
	| { type: "edit"; draft: Partial<CommitDraft> }
	| { type: "cancel" }
	| { type: "submit" }
	| { type: "reject" };

/** A successful merge has no transition: the refreshed pull request replaces the merge box. */
function mergeReducer(state: MergeState, event: MergeEvent): MergeState {
	switch (event.type) {
		case "review":
			return {
				phase: "confirming",
				draft: { title: event.title, description: "" },
			};
		case "edit":
			return state.phase === "confirming"
				? { ...state, draft: { ...state.draft, ...event.draft } }
				: state;
		case "cancel":
			return state.phase === "confirming" ? { phase: "idle" } : state;
		case "submit":
			return state.phase === "confirming"
				? { phase: "merging", draft: state.draft }
				: state;
		case "reject":
			return state.phase === "merging"
				? { phase: "confirming", draft: state.draft }
				: state;
	}
}

export function MergeFooter({
	scope,
	isMergeBlocked,
	canMerge,
	bypass,
	owner,
	repo,
	pullNumber,
	prTitle,
	firstCommitMessage,
}: {
	scope: GitHubQueryScope;
	isMergeBlocked: boolean;
	canMerge: boolean;
	bypass: ReturnType<typeof useMergeBypass>;
	owner: string;
	repo: string;
	pullNumber: number;
	prTitle: string;
	firstCommitMessage?: string;
}) {
	const [mergeMethod, setMergeMethod] = useState<MergeMethod>("squash");
	const [state, dispatch] = useReducer(mergeReducer, { phase: "idle" });
	const queryClient = useQueryClient();

	if (!canMerge) return null;

	const strategy =
		MERGE_STRATEGIES.find((s) => s.value === mergeMethod) ??
		MERGE_STRATEGIES[0];
	const isBlocked = isMergeBlocked && !bypass.shouldBypass;

	const defaultCommitTitle =
		mergeMethod === "squash"
			? (firstCommitMessage?.split("\n")[0] ?? `${prTitle} (#${pullNumber})`)
			: `Merge pull request #${pullNumber}`;

	const merge = async (draft: CommitDraft) => {
		dispatch({ type: "submit" });
		try {
			const result = await mergePullRequest({
				data: {
					owner,
					repo,
					pullNumber,
					mergeMethod,
					bypassProtections: bypass.shouldBypass,
					commitTitle: draft.title || undefined,
					commitMessage: draft.description || undefined,
				},
			});
			if (result.ok) {
				removePullFromOpenViews(queryClient, scope, {
					owner,
					repo,
					pullNumber,
				});
				await invalidateGitHubEntities(queryClient, scope, [
					pullEntityKey({ owner, repo, pullNumber }),
					repoEntityKey({ owner, repo }),
				]);
			} else {
				reportMutationFailure(result, { owner, repo });
				dispatch({ type: "reject" });
			}
		} catch {
			toast.error("Failed to merge pull request");
			dispatch({ type: "reject" });
		}
	};

	if (state.phase !== "idle") {
		const { draft } = state;
		const isMerging = state.phase === "merging";
		return (
			<div className="flex flex-col gap-3 px-4 py-3">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="merge-commit-title" className="text-xs font-medium">
						Commit message
					</label>
					<input
						id="merge-commit-title"
						value={draft.title}
						onChange={(e) =>
							dispatch({ type: "edit", draft: { title: e.target.value } })
						}
						className="flex h-9 w-full rounded-md bg-transparent px-3 py-1 text-sm shadow-card transition-colors placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="merge-commit-desc" className="text-xs font-medium">
						Extended description
					</label>
					<textarea
						id="merge-commit-desc"
						value={draft.description}
						onChange={(e) =>
							dispatch({
								type: "edit",
								draft: { description: e.target.value },
							})
						}
						placeholder="Add an optional extended description..."
						rows={3}
						className="flex w-full resize-none rounded-md bg-transparent px-3 py-2 text-sm shadow-card transition-colors placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						onClick={() => {
							void merge(draft);
						}}
						disabled={isBlocked || isMerging || !draft.title.trim()}
						iconLeft={
							isMerging ? (
								<Spinner size={14} />
							) : (
								<GitMergeIcon size={14} strokeWidth={2} />
							)
						}
					>
						Confirm {strategy.label.toLowerCase()}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => dispatch({ type: "cancel" })}
						disabled={isMerging}
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 px-4 py-3">
			<div className="flex items-center gap-3">
				<p className="min-w-0 flex-1 text-xs font-[450] text-muted-foreground">
					{isBlocked
						? "Merging is blocked until the required checks and reviews pass."
						: "Ready to merge"}
				</p>
				<div className="flex shrink-0 overflow-hidden rounded-md shadow-solid">
					<button
						type="button"
						disabled={isBlocked}
						onClick={() =>
							dispatch({ type: "review", title: defaultCommitTitle })
						}
						className="flex h-7 items-center gap-1.5 bg-merge pr-2.5 pl-3 text-xs font-medium text-white transition-colors hover:bg-merge-hover disabled:opacity-50"
					>
						<GitMergeIcon size={13} strokeWidth={2} />
						{strategy.label}
					</button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								disabled={isBlocked}
								aria-label="Merge options"
								className="flex h-7 items-center border-l-[0.5px] border-white/25 bg-merge pr-2 pl-1.5 text-white transition-colors hover:bg-merge-hover disabled:opacity-50"
							>
								<ChevronDownIcon size={13} strokeWidth={2} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-52">
							{MERGE_STRATEGIES.map((option) => (
								<DropdownMenuItem
									key={option.value}
									onClick={() => setMergeMethod(option.value)}
								>
									<span className="flex-1">{option.label}</span>
									{option.value === mergeMethod ? <MenuCheck /> : null}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			{bypass.showOption && (
				<div className="flex items-center gap-2 text-xs text-pill-warning-text">
					<Checkbox
						id="bypass-checks"
						checked={bypass.checked}
						onCheckedChange={(checked) => bypass.setChecked(checked === true)}
					/>
					<label htmlFor="bypass-checks">
						Merge without waiting for requirements to be met (bypass branch
						protections)
					</label>
				</div>
			)}
		</div>
	);
}
