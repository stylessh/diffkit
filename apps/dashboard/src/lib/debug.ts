type DebugDetails = Record<string, unknown> | undefined;

function isDevEnvironment() {
	return import.meta.env.DEV;
}

export function debug(scope: string, message: string, details?: DebugDetails) {
	if (!isDevEnvironment()) {
		return;
	}

	if (typeof details === "undefined") {
		console.log(`[debug:${scope}] ${message}`);
		return;
	}

	console.log(`[debug:${scope}] ${message}`, details);
}
