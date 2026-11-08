import { describe, expect, it } from "vitest";
import { authorFilterDef, labelFilterDef } from "./filter-helpers";
import {
	applyListView,
	type FilterableItem,
	operatorLabel,
	parseFilterString,
	serializeFilters,
	withOperator,
	withValueToggled,
} from "./filter-model";

function item(
	overrides: Partial<FilterableItem> & {
		labels?: { name: string; color: string }[];
	},
): FilterableItem {
	return {
		id: Math.random(),
		number: 1,
		title: "Untitled",
		updatedAt: "2026-11-01T00:00:00Z",
		createdAt: "2026-10-01T00:00:00Z",
		comments: 0,
		author: { login: "nova", avatarUrl: "" },
		repository: { fullName: "lumen-labs/beacon" },
		state: "open",
		labels: [],
		...overrides,
	};
}

describe("filter URL format", () => {
	it("round-trips operators and values that contain the separators", () => {
		const filters = withOperator(
			withValueToggled(
				withValueToggled([], "label", "priority: high"),
				"author",
				"nova",
			),
			"author",
			"is-not",
		);
		const raw = serializeFilters(filters);
		expect(raw).toBe("label:priority%3A high|author!:nova");
		expect(parseFilterString(raw)).toEqual(filters);
	});

	it("reads links in the format the repo lists used before", () => {
		expect(parseFilterString("status:open,closed|author:nova")).toEqual([
			{
				fieldId: "status",
				operator: "is",
				values: new Set(["open", "closed"]),
			},
			{ fieldId: "author", operator: "is", values: new Set(["nova"]) },
		]);
		expect(parseFilterString("nonsense|:x|status:")).toEqual([]);
	});
});

describe("editing filters", () => {
	it("combines values of one field into 'is any of' and drops the field when emptied", () => {
		const one = withValueToggled([], "label", "bug");
		const two = withValueToggled(one, "label", "docs");
		expect(two).toHaveLength(1);
		expect(operatorLabel(two[0])).toBe("is any of");
		expect(operatorLabel(withOperator(two, "label", "is-not")[0])).toBe(
			"is none of",
		);
		expect(
			withValueToggled(withValueToggled(two, "label", "bug"), "label", "docs"),
		).toEqual([]);
	});
});

describe("applyListView", () => {
	const items = [
		item({
			number: 12,
			title: "Fix SSE reconnect",
			headRefName: "fix/sse-reconnect",
			labels: [{ name: "bug", color: "d73a4a" }],
		}),
		item({
			number: 14,
			title: "Docs for the CLI",
			author: { login: "theo-martin", avatarUrl: "" },
			labels: [{ name: "docs", color: "0075ca" }],
		}),
		item({ number: 20, title: "Release 1.4", author: null }),
	];
	const view = {
		searchQuery: "",
		activeFilters: [],
		filterDefs: [authorFilterDef, labelFilterDef],
		sortOptions: [],
		sortId: "updated",
	};
	const titles = (result: FilterableItem[]) => result.map((i) => i.title);

	it("searches title, #number, author and branch", () => {
		expect(
			titles(applyListView(items, { ...view, searchQuery: "#14" })),
		).toEqual(["Docs for the CLI"]);
		expect(
			titles(applyListView(items, { ...view, searchQuery: "theo" })),
		).toEqual(["Docs for the CLI"]);
		expect(
			titles(applyListView(items, { ...view, searchQuery: "sse-reconnect" })),
		).toEqual(["Fix SSE reconnect"]);
	});

	it("ANDs fields, ORs values within a field, and negates 'is not'", () => {
		const labels = withValueToggled(
			withValueToggled([], "label", "bug"),
			"label",
			"docs",
		);
		expect(
			titles(applyListView(items, { ...view, activeFilters: labels })),
		).toEqual(["Fix SSE reconnect", "Docs for the CLI"]);

		const notNova = withOperator(
			withValueToggled(labels, "author", "nova"),
			"author",
			"is-not",
		);
		expect(
			titles(applyListView(items, { ...view, activeFilters: notNova })),
		).toEqual(["Docs for the CLI"]);
	});
});
