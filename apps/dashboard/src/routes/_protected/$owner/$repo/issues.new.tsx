import { createFileRoute } from "@tanstack/react-router";
import { NewIssuePage } from "#/components/issues/new/new-issue-page";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/issues/new")({
	ssr: false,
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`New Issue · ${params.owner}/${params.repo}`),
			description: `Create a new issue in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: NewIssuePage,
});
