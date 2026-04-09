import { siteConfig } from "./site-config";

const MAX_DESCRIPTION_LENGTH = 160;
const SEO_ROBOTS_INDEX =
	"index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
const SEO_ROBOTS_NOINDEX = "noindex, nofollow, noarchive";

export const PRIVATE_ROUTE_HEADERS = {
	"X-Robots-Tag": SEO_ROBOTS_NOINDEX,
};

type SeoInput = {
	siteUrl?: string;
	path: string;
	title: string;
	description: string;
	imagePath?: string;
	imageAlt?: string;
	robots?: "index" | "noindex";
	type?: "website" | "article";
	includeCanonical?: boolean;
};

type WebSiteSchemaInput = {
	siteUrl?: string;
	path?: string;
};

export function buildSeo({
	description,
	imageAlt = `${siteConfig.name} preview`,
	imagePath = siteConfig.socialImagePath,
	includeCanonical = true,
	path,
	robots = "index",
	siteUrl = siteConfig.url,
	title,
	type = "website",
}: SeoInput) {
	const canonicalUrl = toAbsoluteUrl(siteUrl, path);
	const imageUrl = toAbsoluteUrl(siteUrl, imagePath);
	const normalizedDescription = summarizeText(description);
	const robotsContent =
		robots === "noindex" ? SEO_ROBOTS_NOINDEX : SEO_ROBOTS_INDEX;

	return {
		links: includeCanonical
			? [{ rel: "canonical", href: canonicalUrl }]
			: undefined,
		meta: [
			{ title },
			{ name: "description", content: normalizedDescription },
			{ name: "robots", content: robotsContent },
			{ name: "googlebot", content: robotsContent },
			{ property: "og:site_name", content: siteConfig.name },
			{ property: "og:type", content: type },
			{ property: "og:title", content: title },
			{ property: "og:description", content: normalizedDescription },
			{ property: "og:url", content: canonicalUrl },
			{ property: "og:image", content: imageUrl },
			{ property: "og:image:alt", content: imageAlt },
			{ name: "twitter:card", content: "summary" },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: normalizedDescription },
			{ name: "twitter:image", content: imageUrl },
		],
	};
}

export function buildWebSiteSchema({
	path = "/",
	siteUrl = siteConfig.url,
}: WebSiteSchemaInput) {
	const siteRoot = toAbsoluteUrl(siteUrl, "/");

	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				name: siteConfig.name,
				url: siteRoot,
				description: siteConfig.defaultDescription,
				publisher: {
					"@type": "Organization",
					name: siteConfig.name,
					url: siteRoot,
					logo: {
						"@type": "ImageObject",
						url: toAbsoluteUrl(siteUrl, siteConfig.socialImagePath),
					},
					sameAs: [siteConfig.githubRepositoryUrl],
				},
			},
			{
				"@type": "WebPage",
				name: siteConfig.defaultTitle,
				url: toAbsoluteUrl(siteUrl, path),
				isPartOf: {
					"@id": siteRoot,
				},
			},
		],
	};
}

export function buildSoftwareApplicationSchema(siteUrl: string) {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: siteConfig.name,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Web",
		description: siteConfig.defaultDescription,
		url: toAbsoluteUrl(siteUrl, "/login"),
		image: toAbsoluteUrl(siteUrl, siteConfig.socialImagePath),
		codeRepository: siteConfig.githubRepositoryUrl,
	};
}

export function summarizeText(
	input: string | null | undefined,
	fallback = siteConfig.defaultDescription,
) {
	if (!input) return fallback;

	const normalized = input
		.replace(/!\[[^\]]*]\([^)]*\)/g, " ")
		.replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
		.replace(/`{1,3}[^`]*`{1,3}/g, " ")
		.replace(/[*_~>#-]+/g, " ")
		.replace(/<\/?[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (!normalized) return fallback;
	if (normalized.length <= MAX_DESCRIPTION_LENGTH) return normalized;

	return `${normalized.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}...`;
}

export function formatPageTitle(value: string) {
	return value.includes(siteConfig.name)
		? value
		: `${value} | ${siteConfig.name}`;
}

export function toAbsoluteUrl(siteUrl: string, path: string) {
	return new URL(path, ensureTrailingSlash(siteUrl)).toString();
}

function ensureTrailingSlash(value: string) {
	return value.endsWith("/") ? value : `${value}/`;
}
