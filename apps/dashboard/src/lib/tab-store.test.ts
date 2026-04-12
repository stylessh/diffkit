// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { readStoredTabs, TABS_STORAGE_KEY, type Tab } from "./tab-store";

describe("readStoredTabs", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("keeps persisted repo tabs", () => {
		const storedTabs: Tab[] = [
			{
				id: "repo:diffkit/app",
				type: "repo",
				title: "diffkit/app",
				url: "/diffkit/app",
				repo: "diffkit/app",
				iconColor: "text-muted-foreground",
				avatarUrl: "https://example.com/avatar.png",
			},
		];

		localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(storedTabs));

		expect(readStoredTabs()).toEqual(storedTabs);
	});

	it("clears storage when a tab type is unsupported", () => {
		localStorage.setItem(
			TABS_STORAGE_KEY,
			JSON.stringify([
				{
					id: "project:diffkit/app",
					type: "project",
				},
			]),
		);

		expect(readStoredTabs()).toEqual([]);
		expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
	});
});
