import type { GitHubActor } from "#/lib/github.types";

/** Mention candidates in the order given, then commenters from the most recent back. */
export function getInvolvedUsers(
	leading: readonly (GitHubActor | null | undefined)[],
	comments: readonly { author: GitHubActor | null }[] | undefined,
): GitHubActor[] {
	const seen = new Set<string>();
	const users: GitHubActor[] = [];

	const add = (actor: GitHubActor | null | undefined) => {
		if (!actor || seen.has(actor.login)) return;
		seen.add(actor.login);
		users.push(actor);
	};

	for (const actor of leading) add(actor);
	if (comments) {
		for (let i = comments.length - 1; i >= 0; i--) add(comments[i].author);
	}

	return users;
}
