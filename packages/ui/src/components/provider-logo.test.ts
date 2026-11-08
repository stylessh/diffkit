import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProviderLogo, providerLabel } from "./provider-logo";

describe("SpaceXAI provider branding", () => {
	it("uses the SpaceXAI provider name", () => {
		expect(providerLabel("xai")).toBe("SpaceXAI");
	});

	it("identifies the provider for assistive technology", () => {
		const html = renderToStaticMarkup(
			createElement(ProviderLogo, { provider: "xai", size: 14 }),
		);

		expect(html).toContain('aria-label="SpaceXAI"');
	});
});
