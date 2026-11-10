import { getGitHubUserContextForRepository } from "./installations";
import {
	type GitHubContext,
	type MutationResult,
	toMutationError,
} from "./shared";

export const NOT_AUTHENTICATED = {
	ok: false,
	error: "Not authenticated",
} as const;

/**
 * Writes go through the viewer's own token so GitHub attributes them to the
 * viewer. `action` completes "Failed to …" in the message shown to the user.
 */
export async function mutateRepository(
	repository: { owner: string; repo: string },
	action: string,
	mutate: (context: GitHubContext) => Promise<unknown>,
): Promise<MutationResult> {
	const context = await getGitHubUserContextForRepository(repository);
	if (!context) {
		return NOT_AUTHENTICATED;
	}

	try {
		await mutate(context);
		return { ok: true };
	} catch (error) {
		return toMutationError(action, error);
	}
}
