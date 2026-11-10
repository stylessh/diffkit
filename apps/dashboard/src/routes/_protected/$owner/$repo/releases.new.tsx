import { createFileRoute } from "@tanstack/react-router";
import { ReleaseFormPage } from "#/components/releases/release-form-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoRefNamesQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

type NewReleaseSearch = {
	/** Prefill the tag, e.g. from the tags page "Create release" action. */
	tag?: string;
};

export const Route = createFileRoute("/_protected/$owner/$repo/releases/new")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): NewReleaseSearch => ({
		tag:
			typeof search.tag === "string" && search.tag.trim()
				? search.tag.trim()
				: undefined,
	}),
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoViewerPermissionQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoRefNamesQueryOptions(scope, { ...input, kind: "tags" }),
		);
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `New release · ${params.owner}/${params.repo}`,
			description: `Draft a new release for ${params.owner}/${params.repo}.`,
		}),
	component: NewReleaseRoute,
});

function NewReleaseRoute() {
	const { owner, repo } = Route.useParams();
	const { tag } = Route.useSearch();
	const scope = useGitHubQueryScope();
	return (
		<ReleaseFormPage owner={owner} repo={repo} scope={scope} initialTag={tag} />
	);
}
