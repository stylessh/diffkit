// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
	parseFilterCookie,
	readFilterCookieClient,
	writeFilterCookie,
} from "./filter-cookie";

const store = {
	pulls: {
		searchQuery: "fix",
		activeFilters: [{ fieldId: "repo", values: ["a/b"] }],
		sortId: "updated",
	},
};

afterEach(() => {
	// biome-ignore lint/suspicious/noDocumentCookie: test teardown
	document.cookie = "diffkit-filters=; path=/; max-age=0";
});

describe("parseFilterCookie", () => {
	it("reads the filter store among other cookies", () => {
		const header = `a=1; diffkit-filters=${encodeURIComponent(JSON.stringify(store))}; b=2`;
		expect(parseFilterCookie(header)).toEqual(store);
	});

	it("keeps '=' inside the value", () => {
		const value = { pulls: { ...store.pulls, searchQuery: "a=b" } };
		const header = `diffkit-filters=${encodeURIComponent(JSON.stringify(value))}`;
		expect(parseFilterCookie(header)).toEqual(value);
	});

	it("falls back to defaults for missing, corrupted or non-object cookies", () => {
		expect(parseFilterCookie("")).toEqual({});
		expect(parseFilterCookie(undefined)).toEqual({});
		expect(parseFilterCookie("diffkit-filters=%E0%A4%A")).toEqual({});
		expect(parseFilterCookie("diffkit-filters=not-json")).toEqual({});
		expect(parseFilterCookie("diffkit-filters=%5B1%5D")).toEqual({});
		expect(parseFilterCookie("other-diffkit-filters=%7B%7D")).toEqual({});
	});
});

describe("readFilterCookieClient", () => {
	it("round-trips what writeFilterCookie stores, synchronously", () => {
		writeFilterCookie(store);
		expect(readFilterCookieClient()).toEqual(store);
	});
});
