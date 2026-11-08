import { describe, expect, it, vi } from "vitest";
import { bindHorizontalWheelScroll } from "./use-horizontal-scroll-fades";

function createScrollElement(scrollLeft: number) {
	let listener: ((event: WheelEvent) => void) | undefined;
	let currentScrollLeft = scrollLeft;
	const element = {
		clientWidth: 100,
		scrollWidth: 300,
		get scrollLeft() {
			return currentScrollLeft;
		},
		set scrollLeft(value: number) {
			currentScrollLeft = Math.max(0, Math.min(200, value));
		},
		addEventListener: vi.fn((_name, next) => {
			listener = next as (event: WheelEvent) => void;
		}),
		removeEventListener: vi.fn(),
	} as unknown as HTMLDivElement;
	return { element, dispatch: (event: WheelEvent) => listener?.(event) };
}

function wheelEvent(overrides: Partial<WheelEvent> = {}) {
	return {
		ctrlKey: false,
		metaKey: false,
		deltaMode: 0,
		deltaY: 20,
		preventDefault: vi.fn(),
		...overrides,
	} as unknown as WheelEvent;
}

describe("bindHorizontalWheelScroll", () => {
	it("prevents the page scroll only when horizontal movement is consumed", () => {
		const update = vi.fn();
		const { element, dispatch } = createScrollElement(20);
		const event = wheelEvent();
		bindHorizontalWheelScroll(element, update);

		dispatch(event);

		expect(element.scrollLeft).toBe(40);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(update).toHaveBeenCalledOnce();
	});

	it("allows boundary and browser zoom wheel events through", () => {
		const boundary = createScrollElement(0);
		const outward = wheelEvent({ deltaY: -20 });
		bindHorizontalWheelScroll(boundary.element, vi.fn());
		boundary.dispatch(outward);
		expect(outward.preventDefault).not.toHaveBeenCalled();

		const zoom = wheelEvent({ ctrlKey: true });
		boundary.dispatch(zoom);
		expect(zoom.preventDefault).not.toHaveBeenCalled();
	});
});
