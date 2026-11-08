import { describe, expect, it } from "vitest";
import type { NotificationItem } from "./github.types";
import {
	groupNotifications,
	selectionAfterRemoval,
	stepSelection,
	visibleOrder,
} from "./inbox";

function notification(
	id: string,
	repo: string,
	reason: string,
	updatedAt: string,
): NotificationItem {
	const [owner, name] = repo.split("/");
	return {
		id,
		unread: true,
		reason,
		subject: { title: id, url: null, latestCommentUrl: null, type: "Issue" },
		repository: {
			id: 1,
			name,
			fullName: repo,
			owner: { login: owner, avatarUrl: "", url: "", type: "Organization" },
			private: false,
		},
		participants: [],
		subjectState: null,
		updatedAt,
		lastReadAt: null,
		url: "",
	};
}

const inbox = [
	notification("a", "acme/web", "subscribed", "2026-11-08T09:00:00Z"),
	notification("b", "acme/api", "review_requested", "2026-11-08T08:00:00Z"),
	notification("c", "acme/web", "mention", "2026-11-08T10:00:00Z"),
	notification("d", "acme/api", "mention", "2026-11-07T10:00:00Z"),
];

const ids = (groups: ReturnType<typeof groupNotifications>) =>
	groups.map((group) => [group.title, group.items.map((item) => item.id)]);

describe("groupNotifications", () => {
	it("orders repository groups by their latest activity", () => {
		expect(ids(groupNotifications(inbox, "repository"))).toEqual([
			["acme/web", ["c", "a"]],
			["acme/api", ["b", "d"]],
		]);
	});

	it("orders reason groups by urgency, not recency", () => {
		expect(ids(groupNotifications(inbox, "reason"))).toEqual([
			["Review requested", ["b"]],
			["Mentioned", ["c", "d"]],
			["Watching", ["a"]],
		]);
	});
});

describe("keyboard selection", () => {
	const groups = groupNotifications(inbox, "repository");

	it("walks only expanded groups and stops at the ends", () => {
		const order = visibleOrder(groups, new Set(["acme/web"]));
		expect(order).toEqual(["b", "d"]);
		expect(stepSelection(order, null, 1)).toBe("b");
		expect(stepSelection(order, "d", 1)).toBe("d");
		expect(stepSelection(order, "c", -1)).toBe("d");
	});

	it("moves to the next row when the selected one is done, or back at the end", () => {
		const order = visibleOrder(groups, new Set());
		expect(selectionAfterRemoval(order, "a", "a")).toBe("b");
		expect(selectionAfterRemoval(order, "d", "d")).toBe("b");
		expect(selectionAfterRemoval(order, "c", "d")).toBe("c");
	});
});
