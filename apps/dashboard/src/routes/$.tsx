import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFoundScreen } from "#/components/layouts/not-found-screen";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/$")({
	beforeLoad: () => {
		throw notFound();
	},
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Page not found"),
			description: "Check the URL or return to your dashboard.",
			robots: "noindex",
			includeCanonical: false,
		}),
	notFoundComponent: NotFoundScreen,
});
