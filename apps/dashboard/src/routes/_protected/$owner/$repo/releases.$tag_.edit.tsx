import { createFileRoute } from "@tanstack/react-router";
import { ReleaseFormPage } from "#/components/releases/release-form-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoReleaseQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/releases/$tag_/edit",
)({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoReleaseQueryOptions(scope, { ...input, tag: params.tag }),
		);
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoViewerPermissionQueryOptions(scope, input),
		);
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Edit release ${params.tag} · ${params.owner}/${params.repo}`,
			description: `Edit release ${params.tag} of ${params.owner}/${params.repo}.`,
		}),
	component: EditReleaseRoute,
});

function EditReleaseRoute() {
	const { owner, repo, tag } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<ReleaseFormPage owner={owner} repo={repo} scope={scope} editTag={tag} />
	);
}
