import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	type GitHubQueryScope,
	githubRepoCollaboratorsQueryOptions,
} from "#/lib/github.query";
import type {
	GitHubActor,
	PullDetail,
	PullReviewComment,
} from "#/lib/github.types";

type Mentionable = Pick<GitHubActor, "login" | "avatarUrl" | "type">;

/**
 * Who an inline comment can mention: the people already in the conversation
 * first, then the repo's collaborators, fetched once a mention is started.
 */
export function useReviewMentions({
	scope,
	owner,
	repo,
	pr,
	reviewComments,
	viewerLogin,
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	pr: PullDetail | undefined;
	reviewComments: readonly PullReviewComment[];
	viewerLogin: string | undefined;
}): MentionConfig {
	const [isActivated, setIsActivated] = useState(false);
	const collaboratorsQuery = useQuery({
		...githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
		enabled: isActivated,
	});
	const collaborators = collaboratorsQuery.data;
	const isLoading = collaboratorsQuery.isLoading;

	return useMemo(() => {
		const seen = new Set<string>(viewerLogin ? [viewerLogin] : []);
		const candidates: MentionConfig["candidates"] = [];
		const add = (person: Mentionable | null | undefined) => {
			if (!person || seen.has(person.login)) return;
			seen.add(person.login);
			candidates.push({
				id: person.login,
				label: person.login,
				avatarUrl: person.avatarUrl,
				secondary: person.type === "Bot" ? "Bot" : undefined,
			});
		};

		add(pr?.author);
		for (const reviewer of pr?.requestedReviewers ?? []) add(reviewer);
		for (let index = reviewComments.length - 1; index >= 0; index--) {
			add(reviewComments[index].author);
		}
		for (const collaborator of collaborators ?? []) add(collaborator);

		return {
			candidates,
			onActivate: () => setIsActivated(true),
			isLoading,
		};
	}, [viewerLogin, pr, reviewComments, collaborators, isLoading]);
}
