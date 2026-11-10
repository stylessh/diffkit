import { createFileRoute } from "@tanstack/react-router";
import { NewIssuePage } from "#/components/issues/new/new-issue-page";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/issues/new")({
	ssr: false,
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `New Issue · ${params.owner}/${params.repo}`,
			description: `Create a new issue in ${params.owner}/${params.repo}.`,
		}),
	component: NewIssuePage,
});
