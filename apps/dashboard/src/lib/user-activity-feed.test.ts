import { describe, expect, it } from "vitest";
import type { UserActivityEvent } from "./github.types";
import { buildActivityMonths } from "./user-activity-feed";

function event(
	overrides: Partial<UserActivityEvent> &
		Pick<UserActivityEvent, "id" | "type" | "createdAt">,
): UserActivityEvent {
	return {
		repo: {
			name: "lumen-labs/beacon",
			url: "https://github.com/lumen-labs/beacon",
		},
		actor: { login: "nova", avatarUrl: "" },
		action: null,
		title: null,
		ref: null,
		refType: null,
		commits: null,
		commentBody: null,
		prDetail: null,
		issueDetail: null,
		...overrides,
	};
}

const pull = (number: number, state: string) => ({
	number,
	body: null,
	additions: 1,
	deletions: 0,
	comments: 0,
	changedFiles: 1,
	state,
	isDraft: false,
	url: "",
	headRef: null,
	baseRef: null,
	labels: [],
});

describe("buildActivityMonths", () => {
	it("groups by month, newest month first, and drops months with nothing to show", () => {
		const months = buildActivityMonths([
			event({ id: "a", type: "WatchEvent", createdAt: "2026-09-03T10:00:00Z" }),
			event({ id: "b", type: "WatchEvent", createdAt: "2026-10-02T10:00:00Z" }),
			event({
				id: "c",
				type: "CreateEvent",
				createdAt: "2026-08-02T10:00:00Z",
			}),
		]);
		expect(months.map((month) => month.label)).toEqual([
			"October 2026",
			"September 2026",
		]);
	});

	it("shows a pull request once, in its latest state", () => {
		const [month] = buildActivityMonths([
			event({
				id: "opened",
				type: "PullRequestEvent",
				action: "opened",
				createdAt: "2026-10-01T10:00:00Z",
				prDetail: pull(7, "open"),
			}),
			event({
				id: "merged",
				type: "PullRequestEvent",
				action: "closed",
				createdAt: "2026-10-04T10:00:00Z",
				prDetail: pull(7, "merged"),
			}),
		]);
		expect(month.items).toHaveLength(1);
		expect(month.items[0]).toMatchObject({
			kind: "pull",
			at: "2026-10-04T10:00:00Z",
		});
	});

	it("folds a month's pushes into one commits line, sorted among the rest by its latest push", () => {
		const [month] = buildActivityMonths([
			event({
				id: "p1",
				type: "PushEvent",
				createdAt: "2026-10-01T10:00:00Z",
				commits: [
					{ sha: "1", message: "a" },
					{ sha: "2", message: "b" },
				],
			}),
			event({
				id: "star",
				type: "WatchEvent",
				createdAt: "2026-10-05T10:00:00Z",
			}),
			event({
				id: "p2",
				type: "PushEvent",
				createdAt: "2026-10-09T10:00:00Z",
				repo: { name: "lumen-labs/orbit", url: "" },
				commits: [{ sha: "3", message: "c" }],
			}),
		]);
		expect(month.items.map((item) => item.kind)).toEqual(["commits", "event"]);
		expect(month.items[0]).toMatchObject({
			kind: "commits",
			total: 3,
			at: "2026-10-09T10:00:00Z",
			repos: [
				{ name: "lumen-labs/beacon", commits: 2 },
				{ name: "lumen-labs/orbit", commits: 1 },
			],
		});
	});
});
