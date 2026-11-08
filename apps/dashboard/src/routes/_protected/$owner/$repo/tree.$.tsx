import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
	CodeRoutePage,
	prefetchCodeRoute,
} from "#/components/repo/code/code-route";
import { cleanSplat } from "#/lib/code-browsing/code-location";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/tree/$")({
	ssr: false,
	loader: ({ context, params }) => {
		prefetchCodeRoute(
			context.queryClient,
			{ userId: context.user.id },
			{
				owner: params.owner,
				repo: params.repo,
				splat: params._splat,
				view: "tree",
			},
		);
	},
	head: ({ match, params }) => {
		const name = cleanSplat(params._splat).split("/").pop();
		return buildSeo({
			path: match.pathname,
			title: formatPageTitle(
				name
					? `${name} · ${params.owner}/${params.repo}`
					: `${params.owner}/${params.repo}`,
			),
			description: `Browse files in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		});
	},
	component: TreePage,
});

function TreePage() {
	const { user } = Route.useRouteContext();
	const { owner, repo, _splat } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<CodeRoutePage
			scope={scope}
			owner={owner}
			repo={repo}
			splat={_splat}
			view="tree"
		/>
	);
}
