import { dedupeGitHubRead } from "./request-dedup";

/**
 * Who the viewer is and which installations they have is asked by every
 * server function before it can pick a token, so one page load repeated the
 * same two GitHub calls a dozen times. This keeps the answers in the isolate
 * for a few seconds.
 *
 * It holds values, never promises: the worker runs with
 * `no_handle_cross_request_promise_resolution`, so a promise created by one
 * request must not be awaited by another. It is memory only, so there is no
 * storage to fill or sweep, and a cold isolate is just a miss.
 */
export const IDENTITY_MEMORY_TTL_MS = 30 * 1000;
const IDENTITY_MEMORY_MAX_ENTRIES = 2_000;

type RememberedRead = { value: unknown; expiresAt: number };

const rememberedReads = new Map<string, RememberedRead>();

function memoryKey(userId: string, resource: string) {
	return `${userId}::${resource}`;
}

function dropExpiredAndOverflow(now: number) {
	for (const [key, entry] of rememberedReads) {
		if (entry.expiresAt <= now) rememberedReads.delete(key);
	}
	for (const key of rememberedReads.keys()) {
		if (rememberedReads.size <= IDENTITY_MEMORY_MAX_ENTRIES) break;
		rememberedReads.delete(key);
	}
}

export function rememberIdentityRead(
	userId: string,
	resource: string,
	value: unknown,
	now = Date.now(),
) {
	const key = memoryKey(userId, resource);
	rememberedReads.delete(key);
	rememberedReads.set(key, {
		value,
		expiresAt: now + IDENTITY_MEMORY_TTL_MS,
	});
	if (rememberedReads.size > IDENTITY_MEMORY_MAX_ENTRIES) {
		dropExpiredAndOverflow(now);
	}
}

export function forgetIdentityRead(userId: string, resource: string) {
	rememberedReads.delete(memoryKey(userId, resource));
}

export function clearIdentityMemory() {
	rememberedReads.clear();
}

export async function readIdentityThroughMemory<TValue>({
	userId,
	resource,
	load,
	shouldRemember = () => true,
	now = Date.now,
}: {
	userId: string;
	resource: string;
	load: () => Promise<TValue>;
	shouldRemember?: (value: TValue) => boolean;
	now?: () => number;
}): Promise<TValue> {
	const remembered = rememberedReads.get(memoryKey(userId, resource));
	if (remembered && remembered.expiresAt > now()) {
		return remembered.value as TValue;
	}

	return dedupeGitHubRead<TValue>({
		userId,
		resource: `identity.${resource}`,
		fetcher: async () => {
			const value = await load();
			if (shouldRemember(value)) {
				rememberIdentityRead(userId, resource, value, now());
			} else {
				forgetIdentityRead(userId, resource);
			}
			return value;
		},
	});
}
