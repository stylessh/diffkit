import { buildSeo, formatPageTitle } from "#/lib/seo";

/** Head tags for a signed-in page: titled for the tab, never indexed. */
export function privatePageSeo(
	match: { pathname: string },
	page: { title: string; description: string },
) {
	return buildSeo({
		path: match.pathname,
		title: formatPageTitle(page.title),
		description: page.description,
		robots: "noindex",
	});
}
