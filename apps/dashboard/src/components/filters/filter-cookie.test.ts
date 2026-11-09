// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
	parseRememberedViews,
	readRememberedView,
	rememberView,
} from "./filter-cookie";

afterEach(() => {
	// biome-ignore lint/suspicious/noDocumentCookie: test teardown
	document.cookie = "diffkit-filters=; path=/; max-age=0";
});

describe("remembered list views", () => {
	it("ignores corrupted cookies and entries from the old cookie shape", () => {
		const legacy = {
			pulls: { searchQuery: "fix", activeFilters: [], sortId: "updated" },
			issues: { filters: "status:open", sort: 7 },
		};
		const header = `a=1; diffkit-filters=${encodeURIComponent(JSON.stringify(legacy))}`;
		expect(parseRememberedViews(header)).toEqual({
			issues: { filters: "status:open" },
		});
		expect(parseRememberedViews("diffkit-filters=%E0%A4%A")).toEqual({});
	});

	it("keeps one view per list and forgets a list whose view was cleared", () => {
		rememberView("pulls", { filters: "author:nova", sort: "created" });
		rememberView("issues", { filters: "label:bug" });
		expect(readRememberedView("pulls")).toEqual({
			filters: "author:nova",
			sort: "created",
		});

		rememberView("pulls", {});
		expect(readRememberedView("pulls")).toBeNull();
		expect(readRememberedView("issues")).toEqual({ filters: "label:bug" });
	});
});
