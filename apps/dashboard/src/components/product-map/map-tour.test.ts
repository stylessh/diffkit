import { describe, expect, it } from "vitest";
import { TOUR_IDLE, type TourState, tourReducer } from "./map-tour";

describe("tourReducer", () => {
	it("ends the tour when the last stop advances", () => {
		const last: TourState = { status: "playing", stop: 2 };
		expect(tourReducer(last, { type: "next", stops: 3 })).toEqual(TOUR_IDLE);
	});

	it("keeps a paused tour paused while stepping", () => {
		const paused: TourState = { status: "paused", stop: 1 };
		expect(tourReducer(paused, { type: "next", stops: 3 })).toEqual({
			status: "paused",
			stop: 2,
		});
		expect(
			tourReducer({ status: "paused", stop: 0 }, { type: "previous" }),
		).toEqual({ status: "paused", stop: 0 });
	});

	it("ignores stepping while idle and pauses on a direct jump", () => {
		expect(tourReducer(TOUR_IDLE, { type: "next", stops: 3 })).toEqual(
			TOUR_IDLE,
		);
		expect(
			tourReducer({ status: "playing", stop: 0 }, { type: "go", stop: 2 }),
		).toEqual({ status: "paused", stop: 2 });
	});
});
