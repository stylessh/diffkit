export const RECENT_PUSH_WINDOW_MS = 2 * 60 * 60 * 1000;

export function isRecentPush(pushedAt: string, now = Date.now()) {
	const pushedMs = Date.parse(pushedAt);
	if (Number.isNaN(pushedMs)) return false;
	return now - pushedMs <= RECENT_PUSH_WINDOW_MS;
}
