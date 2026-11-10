import { createServerFn } from "@tanstack/react-start";
import { executeGitHubGraphQL } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { dedupeGitHubRead } from "./request-dedup";
import { identityValidator } from "./validators";

export type RepoTemplateKind = "pr" | "issue";

type RepoTemplateInput = {
	owner: string;
	repo: string;
	kind: RepoTemplateKind;
};

const PR_TEMPLATE_PATHS = [
	".github/pull_request_template.md",
	".github/PULL_REQUEST_TEMPLATE.md",
	"docs/pull_request_template.md",
	"docs/PULL_REQUEST_TEMPLATE.md",
	"pull_request_template.md",
	"PULL_REQUEST_TEMPLATE.md",
];

const ISSUE_TEMPLATE_PATHS = [
	".github/ISSUE_TEMPLATE.md",
	".github/issue_template.md",
	"docs/ISSUE_TEMPLATE.md",
	"docs/issue_template.md",
	"ISSUE_TEMPLATE.md",
	"issue_template.md",
];

type RepoTemplateGraphQLResponse = {
	repository: {
		[alias: string]: { text: string | null } | null;
	} | null;
};

export const getRepoTemplate = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoTemplateInput>)
	.handler(async ({ data }): Promise<string | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		try {
			return await dedupeGitHubRead<string | null>({
				userId: context.session.user.id,
				resource: `repo.template.${data.kind}.v1`,
				params: data,
				fetcher: async () => {
					const paths =
						data.kind === "pr" ? PR_TEMPLATE_PATHS : ISSUE_TEMPLATE_PATHS;
					const fields = paths
						.map(
							(path, i) =>
								`p${i}: object(expression: "HEAD:${path}") { ... on Blob { text } }`,
						)
						.join("\n");

					const response =
						await executeGitHubGraphQL<RepoTemplateGraphQLResponse>(
							context,
							`github repo template ${data.kind} ${data.owner}/${data.repo}`,
							`query($owner: String!, $repo: String!) {
								repository(owner: $owner, name: $repo) {
									${fields}
								}
							}`,
							{ owner: data.owner, repo: data.repo },
						);

					const repository = response.repository;
					let body: string | null = null;
					if (repository) {
						for (let i = 0; i < paths.length; i++) {
							const entry = repository[`p${i}`];
							const text = entry?.text;
							if (text && text.length > 0) {
								body = text;
								break;
							}
						}
					}

					return body;
				},
			});
		} catch {
			return null;
		}
	});
