import { createFileRoute } from "@tanstack/react-router";
import {
	CodeRoutePage,
	prefetchCodeRoute,
} from "#/components/repo/code/code-route";
import { cleanSplat } from "#/lib/code-browsing/code-location";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/blob/$")({
	ssr: false,
	loader: ({ context, params }) => {
		prefetchCodeRoute(
			context.queryClient,
			{ userId: context.user.id },
			{
				owner: params.owner,
				repo: params.repo,
				splat: params._splat,
				view: "blob",
			},
		);
	},
	head: ({ match, params }) => {
		const name = cleanSplat(params._splat).split("/").pop();
		return privatePageSeo(match, {
			title: name
				? `${name} · ${params.owner}/${params.repo}`
				: `${params.owner}/${params.repo}`,
			description: `View a file in ${params.owner}/${params.repo}.`,
		});
	},
	component: BlobPage,
});

function BlobPage() {
	const { owner, repo, _splat } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<CodeRoutePage
			scope={scope}
			owner={owner}
			repo={repo}
			splat={_splat}
			view="blob"
		/>
	);
}
