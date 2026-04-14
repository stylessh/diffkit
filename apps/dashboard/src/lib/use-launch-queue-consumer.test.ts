import { describe, expect, it, vi } from "vitest";
import {
	consumeLaunch,
	registerLaunchQueueConsumer,
} from "./use-launch-queue-consumer";

describe("consumeLaunch", () => {
	it("navigates to same-origin tab routes and preserves search/hash", () => {
		const navigate = vi.fn();

		consumeLaunch(
			{
				targetURL:
					"https://diff-kit.com/stylessh/diffkit/pull/42?tab=files#diff-1",
			},
			{
				navigate,
			},
		);

		expect(navigate).toHaveBeenCalledWith(
			"/stylessh/diffkit/pull/42?tab=files#diff-1",
		);
	});

	it("navigates to same-origin non-tab routes", () => {
		const navigate = vi.fn();

		consumeLaunch(
			{ targetURL: "https://diff-kit.com/pulls?state=open#mine" },
			{
				navigate,
			},
		);

		expect(navigate).toHaveBeenCalledWith("/pulls?state=open#mine");
	});

	it("normalizes absolute URLs even when origin differs", () => {
		const navigate = vi.fn();

		consumeLaunch(
			{ targetURL: "https://github.com/stylessh/diffkit/pull/42" },
			{
				navigate,
			},
		);

		expect(navigate).toHaveBeenCalledWith("/stylessh/diffkit/pull/42");
	});
});

describe("registerLaunchQueueConsumer", () => {
	it("registers and cleans up launch consumer callbacks", () => {
		const launchQueue = {
			setConsumer: vi.fn(),
		};

		const cleanup = registerLaunchQueueConsumer(launchQueue, {
			navigate: vi.fn(),
		});

		expect(launchQueue.setConsumer).toHaveBeenCalledWith(expect.any(Function));

		cleanup();
		expect(launchQueue.setConsumer).toHaveBeenCalledWith(expect.any(Function));
		expect(launchQueue.setConsumer).toHaveBeenCalledTimes(2);
	});
});
