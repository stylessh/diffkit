type InFlightReads = Map<string, Promise<unknown>>;

const inFlightReadsByRequest = new WeakMap<Request, InFlightReads>();

async function getRequestInFlightReads(): Promise<InFlightReads | null> {
	try {
		const { getRequest } = await import("@tanstack/react-start/server");
		const request = getRequest();
		let reads = inFlightReadsByRequest.get(request);
		if (!reads) {
			reads = new Map();
			inFlightReadsByRequest.set(request, reads);
		}
		return reads;
	} catch {
		return null;
	}
}

function stableJson(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(stableJson);
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) {
			const normalized = stableJson(record[key]);
			if (normalized !== undefined) {
				sorted[key] = normalized;
			}
		}
		return sorted;
	}
	return value;
}

/**
 * Identical reads (same user, resource and params) made while serving one
 * request share a single GitHub call. Nothing outlives the request: the
 * persistent server cache filled D1 and was removed (docs/platform-plan.md,
 * "Incidents").
 */
export async function dedupeGitHubRead<TData>({
	userId,
	resource,
	params,
	fetcher,
	inFlightReads,
}: {
	userId: string;
	resource: string;
	params?: unknown;
	fetcher: () => Promise<TData>;
	inFlightReads?: InFlightReads;
}): Promise<TData> {
	const key = `${userId}::${resource}::${JSON.stringify(stableJson(params ?? null))}`;
	const reads = inFlightReads ?? (await getRequestInFlightReads());

	const existing = reads?.get(key);
	if (existing) {
		return existing as Promise<TData>;
	}

	const task = fetcher();
	reads?.set(key, task);
	try {
		return await task;
	} finally {
		reads?.delete(key);
	}
}
