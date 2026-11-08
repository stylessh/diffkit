import { toast } from "@diffkit/ui/components/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
	type CodeView,
	codeHref,
	isFullCommitSha,
} from "#/lib/code-browsing/code-location";
import { formatLineHash, parseLineHash } from "#/lib/code-browsing/line-range";
import {
	type GitHubQueryScope,
	githubRefHeadCommitQueryOptions,
} from "#/lib/github.query";
import { useGlobalShortcuts } from "#/lib/shortcuts";

type PermalinkInput = {
	owner: string;
	repo: string;
	ref: string;
	path: string;
	view: CodeView;
};

export function usePermalink(scope: GitHubQueryScope, input: PermalinkInput) {
	const queryClient = useQueryClient();
	const { owner, repo, ref, path, view } = input;

	const copy = useCallback(async () => {
		try {
			const sha = isFullCommitSha(ref)
				? ref
				: (
						await queryClient.fetchQuery(
							githubRefHeadCommitQueryOptions(scope, { owner, repo, ref }),
						)
					)?.sha;
			if (!sha) throw new Error("Unknown commit");
			const url = `${window.location.origin}${codeHref(
				view,
				{ owner, repo, ref: sha, path },
				formatLineHash(parseLineHash(window.location.hash)),
			)}`;
			await navigator.clipboard.writeText(url);
			toast.success("Permalink copied", { description: url });
		} catch {
			toast.error("Couldn't copy the permalink");
		}
	}, [queryClient, scope, owner, repo, ref, path, view]);

	useGlobalShortcuts([
		{ shortcut: { key: "y" }, onTrigger: () => void copy() },
	]);

	return copy;
}
