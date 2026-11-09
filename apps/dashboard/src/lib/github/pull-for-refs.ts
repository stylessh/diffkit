import { createServerFn } from "@tanstack/react-start";
import { getGitHubContextForRepository } from "./installations";
import { dedupeGitHubRead } from "./request-dedup";
import { identityValidator } from "./validators";

export type OpenPullForRefsInput = {
	owner: string;
	repo: string;
	base: string;
	/** `owner:branch`, as GitHub's pull request list filters heads. */
	head: string;
};

export type OpenPullForRefs = { number: number } | null;

export const getOpenPullForRefs = createServerFn({ method: "GET" })
	.validator(identityValidator<OpenPullForRefsInput>)
	.handler(async ({ data }): Promise<OpenPullForRefs> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		try {
			return await dedupeGitHubRead<OpenPullForRefs>({
				userId: context.session.user.id,
				resource: "pulls.forRefs.v1",
				params: data,
				fetcher: async () => {
					const response = await context.octokit.rest.pulls.list({
						owner: data.owner,
						repo: data.repo,
						head: data.head,
						base: data.base,
						state: "open",
						per_page: 1,
					});
					const pull = response.data.find((p) => p.base.ref === data.base);
					return pull ? { number: pull.number } : null;
				},
			});
		} catch {
			return null;
		}
	});
