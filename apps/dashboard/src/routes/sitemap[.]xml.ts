import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/lib/site-config";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const lastModified = new Date().toISOString();
				const pages = [
					{
						loc: `${siteConfig.url}/login`,
						changefreq: "weekly",
						priority: "0.8",
					},
				];

				const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
	.map(
		(page) => `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
	)
	.join("\n")}
</urlset>`;

				return new Response(xml, {
					headers: {
						"Cache-Control": "public, max-age=0, s-maxage=3600",
						"Content-Type": "application/xml; charset=utf-8",
					},
				});
			},
		},
	},
});
