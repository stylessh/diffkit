import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { resolveLaunchTarget } from "./launch-target";

type LaunchParams = {
	readonly targetURL: string;
};

type LaunchConsumer = (params: LaunchParams) => unknown;

type LaunchQueue = {
	setConsumer: (consumer: LaunchConsumer) => void;
};

type LaunchConsumerDependencies = {
	navigate: (to: string) => void;
};

function getLaunchQueue(): LaunchQueue | null {
	if (typeof window === "undefined") {
		return null;
	}

	return (window as Window & { launchQueue?: LaunchQueue }).launchQueue ?? null;
}

export function consumeLaunch(
	params: LaunchParams,
	deps: LaunchConsumerDependencies,
) {
	const target = resolveLaunchTarget(params.targetURL);
	if (!target) {
		return;
	}

	deps.navigate(target.to);
}

export function registerLaunchQueueConsumer(
	launchQueue: LaunchQueue,
	deps: LaunchConsumerDependencies,
) {
	launchQueue.setConsumer((params) => {
		consumeLaunch(params, deps);
	});

	return () => {
		launchQueue.setConsumer(() => undefined);
	};
}

export function useLaunchQueueConsumer() {
	const router = useRouter();
	const routerRef = useRef(router);

	routerRef.current = router;

	useEffect(() => {
		const launchQueue = getLaunchQueue();
		if (!launchQueue) {
			return;
		}

		return registerLaunchQueueConsumer(launchQueue, {
			navigate: (to) => {
				void routerRef.current.navigate({ to });
			},
		});
	}, []);
}
