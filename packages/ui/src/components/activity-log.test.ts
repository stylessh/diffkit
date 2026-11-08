// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ActivityLog, type ActivityLogItem } from "./activity-log";

beforeAll(() => {
	class ResizeObserverMock {
		constructor(private readonly callback: ResizeObserverCallback) {}
		disconnect() {}
		observe(target: Element) {
			const rect = target.getBoundingClientRect();
			this.callback(
				[
					{
						borderBoxSize: [{ blockSize: rect.height, inlineSize: rect.width }],
						contentRect: rect,
						target,
					} as unknown as ResizeObserverEntry,
				],
				this as unknown as ResizeObserver,
			);
		}
		unobserve() {}
	}
	Object.defineProperty(globalThis, "ResizeObserver", {
		configurable: true,
		value: ResizeObserverMock,
	});
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value(this: HTMLElement) {
			const height = this.getAttribute("role") === "list" ? 600 : 42;
			return {
				bottom: height,
				height,
				left: 0,
				right: 800,
				toJSON: () => ({}),
				top: 0,
				width: 800,
				x: 0,
				y: 0,
			};
		},
	});
});

afterEach(cleanup);

describe("ActivityLog virtualization", () => {
	it("mounts only the visible window from a long retained stream", async () => {
		const items: ActivityLogItem[] = Array.from(
			{ length: 400 },
			(_, index) => ({
				icon: createElement("span", null, "•"),
				id: `record-${index}`,
				label: `Record ${index}`,
				summary: `Sequence ${index}`,
			}),
		);

		render(
			createElement(ActivityLog, {
				ariaLabel: "Long activity",
				items,
			}),
		);

		const mountedRows = await screen.findAllByRole("listitem");
		expect(mountedRows.length).toBeGreaterThan(0);
		expect(mountedRows.length).toBeLessThan(40);
		expect(mountedRows[0]?.getAttribute("aria-setsize")).toBe("400");
	});
});
