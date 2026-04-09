import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/lib/site-config";

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: async () => {
				const lines = [
					"User-agent: *",
					"Allow: /",
					"Disallow: /api/",
					`Sitemap: ${siteConfig.url}/sitemap.xml`,
				];

				return new Response(lines.join("\n"), {
					headers: {
						"Cache-Control": "public, max-age=0, s-maxage=3600",
						"Content-Type": "text/plain; charset=utf-8",
					},
				});
			},
		},
	},
});
