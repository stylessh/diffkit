import { createFileRoute } from "@tanstack/react-router";
import { ProductMapPage } from "#/components/product-map/product-map-page";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/map")({
	ssr: false,
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Product map · ${params.owner}/${params.repo}`,
			description: `The product areas of ${params.owner}/${params.repo}, in plain language.`,
		}),
	component: ProductMapRoute,
});

function ProductMapRoute() {
	const { owner, repo } = Route.useParams();
	return <ProductMapPage owner={owner} repo={repo} />;
}
