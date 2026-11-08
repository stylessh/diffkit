/**
 * Shared guards for request handlers.
 *
 * Storage (D1, KV, R2) can fail at any time. A handler must turn that into a
 * logged, clearly worded 503, never an unhandled exception that Workers
 * reports as a bare 1101 page. These helpers are pure so they can be tested
 * without a Worker runtime.
 */

type ErrorSummary = {
	name: string;
	message: string;
	code?: string | number;
	cause?: ErrorSummary;
};

const MAX_MESSAGE_LENGTH = 300;

/**
 * Drizzle's "Failed query: <sql>\nparams: <values>" embeds bound parameters in
 * the message, which for the `account` table are OAuth tokens. Everything from
 * the `params:` marker on is dropped, then token-shaped strings are masked.
 */
export function redactErrorMessage(message: string): string {
	const paramsIndex = message.search(/\bparams:/i);
	const withoutParams =
		paramsIndex === -1 ? message : message.slice(0, paramsIndex).trimEnd();
	return withoutParams
		.replace(
			/\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})\b/g,
			"[redacted]",
		)
		.replace(/\b(Bearer|token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]")
		.slice(0, MAX_MESSAGE_LENGTH);
}

/** A loggable summary of an error that is safe to print to Workers Logs. */
export function describeError(error: unknown, depth = 0): ErrorSummary {
	if (error instanceof Error) {
		const code = (error as { code?: unknown }).code;
		const cause =
			depth < 2 && error.cause !== undefined
				? describeError(error.cause, depth + 1)
				: undefined;
		return {
			name: error.name,
			message: redactErrorMessage(error.message),
			...(typeof code === "string" || typeof code === "number" ? { code } : {}),
			...(cause ? { cause } : {}),
		};
	}
	return {
		name: "NonError",
		message: redactErrorMessage(typeof error === "string" ? error : ""),
	};
}

/** One structured log line; Workers Logs indexes the JSON fields. */
export function logRouteError(
	scope: string,
	message: string,
	error: unknown,
	extra: Record<string, unknown> = {},
) {
	console.error(
		JSON.stringify({
			level: "error",
			scope,
			message,
			...extra,
			error: describeError(error),
		}),
	);
}

export function serviceUnavailable(
	error: string,
	retryAfterSeconds = 5,
): Response {
	return Response.json(
		{ error },
		{
			status: 503,
			headers: {
				"Cache-Control": "no-store",
				"Retry-After": String(retryAfterSeconds),
			},
		},
	);
}

/**
 * Wraps a handler so an unexpected throw (a failed D1 read, a missing secret)
 * becomes a logged 503 instead of an unhandled exception.
 */
export function guardRoute<TArgs extends unknown[]>(
	scope: string,
	handler: (...args: TArgs) => Promise<Response>,
	errorCode = "service_unavailable",
): (...args: TArgs) => Promise<Response> {
	return async (...args) => {
		try {
			return await handler(...args);
		} catch (error) {
			logRouteError(scope, "unhandled error", error);
			return serviceUnavailable(errorCode);
		}
	};
}
