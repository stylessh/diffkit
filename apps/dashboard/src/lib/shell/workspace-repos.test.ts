import { describe, expect, it } from "vitest";
import {
	MAX_PINNED_REPOS,
	MAX_RECENT_REPOS,
	parseWorkspaceRepos,
	type WorkspaceRepos,
	withoutPinnedRepo,
	withPinnedRepo,
	withRecentRepo,
} from "./workspace-repos";

const repo = (owner: string, name: string) => ({ owner, name });
const empty: WorkspaceRepos = { pinned: [], recent: [] };

describe("parseWorkspaceRepos", () => {
	it("falls back to an empty workspace for corrupt or foreign values", () => {
		expect(parseWorkspaceRepos(null)).toEqual(empty);
		expect(parseWorkspaceRepos("{not json")).toEqual(empty);
		expect(parseWorkspaceRepos('"a string"')).toEqual(empty);
	});

	it("drops malformed entries and case-insensitive duplicates", () => {
		const raw = JSON.stringify({
			pinned: [
				repo("lumen-labs", "beacon"),
				{ owner: "lumen-labs" },
				repo("Lumen-Labs", "Beacon"),
				repo("", "orbit"),
				repo("nova", "dotfiles"),
			],
			recent: "nope",
		});
		expect(parseWorkspaceRepos(raw)).toEqual({
			pinned: [repo("lumen-labs", "beacon"), repo("nova", "dotfiles")],
			recent: [],
		});
	});

	it("caps stored lists at their limits", () => {
		const many = Array.from({ length: 30 }, (_, i) => repo("o", `r${i}`));
		const parsed = parseWorkspaceRepos(
			JSON.stringify({ pinned: many, recent: many }),
		);
		expect(parsed.pinned).toHaveLength(MAX_PINNED_REPOS);
		expect(parsed.recent).toHaveLength(MAX_RECENT_REPOS);
	});
});

describe("withRecentRepo", () => {
	it("moves a revisited repo to the front without duplicating it", () => {
		const state = {
			pinned: [],
			recent: [repo("a", "one"), repo("b", "two"), repo("c", "three")],
		};
		expect(withRecentRepo(state, repo("B", "Two")).recent).toEqual([
			repo("B", "Two"),
			repo("a", "one"),
			repo("c", "three"),
		]);
	});

	it("keeps the same state when the repo is already first", () => {
		const state = { pinned: [], recent: [repo("a", "one")] };
		expect(withRecentRepo(state, repo("a", "one"))).toBe(state);
	});

	it("forgets the oldest repo past the limit", () => {
		let state = empty;
		for (let i = 0; i <= MAX_RECENT_REPOS; i++) {
			state = withRecentRepo(state, repo("o", `r${i}`));
		}
		expect(state.recent).toHaveLength(MAX_RECENT_REPOS);
		expect(state.recent.at(-1)).toEqual(repo("o", "r1"));
	});
});

describe("pinning", () => {
	it("appends a repo once and unpins it regardless of case", () => {
		const pinned = withPinnedRepo(
			withPinnedRepo(empty, repo("a", "one")),
			repo("A", "ONE"),
		);
		expect(pinned.pinned).toEqual([repo("a", "one")]);
		expect(withoutPinnedRepo(pinned, repo("A", "One")).pinned).toEqual([]);
	});

	it("refuses to pin past the limit", () => {
		const full = {
			pinned: Array.from({ length: MAX_PINNED_REPOS }, (_, i) =>
				repo("o", `r${i}`),
			),
			recent: [],
		};
		expect(withPinnedRepo(full, repo("o", "extra"))).toBe(full);
	});
});
