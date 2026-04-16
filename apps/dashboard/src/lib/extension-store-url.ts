/** Canonical listing URLs (also used by `siteConfig` for SEO / consistency). */
export const CHROME_EXTENSION_STORE_URL =
	"https://chromewebstore.google.com/detail/celjddfjncnnkgfgldobcahfiimlebll/" as const;

export const FIREFOX_EXTENSION_STORE_URL =
	"https://addons.mozilla.org/addon/diffkit/" as const;

function isFirefoxFamilyUserAgent(ua: string): boolean {
	// Desktop Firefox: "Firefox/123"; Firefox iOS: "FxiOS/123"; avoid relying on siteConfig.
	return /(?:Firefox|FxiOS)\//i.test(ua);
}

/**
 * Resolves the correct extension listing for the user's browser (Firefox AMO vs Chrome Web Store).
 * Uses inline URLs so the install link never depends on a mis-resolved or stale `siteConfig` bundle.
 */
export function getExtensionStoreInstallUrl(): string {
	if (typeof navigator === "undefined") {
		return CHROME_EXTENSION_STORE_URL;
	}
	return isFirefoxFamilyUserAgent(navigator.userAgent)
		? FIREFOX_EXTENSION_STORE_URL
		: CHROME_EXTENSION_STORE_URL;
}
