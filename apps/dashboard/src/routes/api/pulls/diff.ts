import { createFileRoute } from "@tanstack/react-router";
import type { PullDiffParams } from "#/lib/pull-diff-request.server";
import { guardRoute } from "#/lib/route-safety.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const DIFF_USER_AGENT = "diffkit-dashboard";

const handlePullDiff = guardRoute(
	"pulls-diff",
	async (request: Request) => {
		const [
			{ handlePullDiffRequest },
			{ getGitHubContextForRepository },
			emulator,
		] = await Promise.all([
			import("#/lib/pull-diff-request.server"),
			import("#/lib/github/installations"),
			import("#/lib/github-emulator.server"),
		]);
		return handlePullDiffRequest(request, {
			fetchApiDiff: async (params: PullDiffParams, signal) => {
				const context = await getGitHubContextForRepository(params);
				if (!context) return { kind: "unauthenticated" };
				// Our own signal also keeps the request policy's 12 s timeout off a
				// stream that can legitimately take longer.
				const response = await context.octokit.request(
					"GET /repos/{owner}/{repo}/pulls/{pull_number}",
					{
						owner: params.owner,
						repo: params.repo,
						pull_number: params.number,
						mediaType: { format: "diff" },
						request: { parseSuccessResponseBody: false, signal },
					},
				);
				return {
					kind: "diff",
					body: response.data as unknown as ReadableStream<Uint8Array>,
				};
			},
			fetchPublicDiff: emulator.isGitHubEmulatorEnabled()
				? null
				: (params, signal) =>
						fetch(
							`https://github.com/${params.owner}/${params.repo}/pull/${params.number}.diff`,
							{
								redirect: "follow",
								signal,
								headers: { "User-Agent": DIFF_USER_AGENT },
							},
						),
		});
	},
	"pulls_diff_unavailable",
);

export const Route = createFileRoute("/api/pulls/diff")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: ({ request }) => handlePullDiff(request),
		},
	},
});
