import { siteConfig } from "#/lib/site-config";

/**
 * Resolves the correct extension listing for the user's browser (Firefox AMO vs Chrome Web Store).
 */
export function getExtensionStoreInstallUrl(): string {
	if (typeof navigator === "undefined") {
		return siteConfig.chromeExtensionStoreUrl;
	}
	const ua = navigator.userAgent;
	if (/Firefox\//i.test(ua)) {
		return siteConfig.firefoxExtensionStoreUrl;
	}
	return siteConfig.chromeExtensionStoreUrl;
}
