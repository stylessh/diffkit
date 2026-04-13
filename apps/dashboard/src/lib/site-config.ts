import {
	CHROME_EXTENSION_STORE_URL,
	FIREFOX_EXTENSION_STORE_URL,
} from "#/lib/extension-store-url";

type SiteConfig = {
	name: string;
	domain: string;
	url: string;
	/** Chrome Web Store URL for the DiffKit redirect extension. */
	chromeExtensionStoreUrl: string;
	/** Firefox Add-ons URL for the DiffKit redirect extension. */
	firefoxExtensionStoreUrl: string;
	githubRepositoryUrl: string;
	themeColor: string;
	socialImagePath: string;
	defaultTitle: string;
	defaultDescription: string;
	manifestName: string;
	manifestCategories: string[];
};

export const siteConfig: SiteConfig = {
	name: "DiffKit",
	domain: "diff-kit.com",
	url: "https://diff-kit.com",
	chromeExtensionStoreUrl: CHROME_EXTENSION_STORE_URL,
	firefoxExtensionStoreUrl: FIREFOX_EXTENSION_STORE_URL,
	githubRepositoryUrl: "https://github.com/stylessh/diffkit",
	themeColor: "#00C943",
	socialImagePath: "/logo512.png",
	defaultTitle:
		"DiffKit | GitHub dashboard for pull requests, issues, and reviews",
	defaultDescription:
		"DiffKit helps developers track pull requests, issues, and code reviews across GitHub in one fast, focused dashboard.",
	manifestName: "DiffKit Dashboard",
	manifestCategories: ["developer tools", "productivity"],
};
