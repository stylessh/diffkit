export function formatRelativeTime(
	dateStr: string,
	now?: number,
	options?: { compact?: boolean },
): string {
	const dateMs = new Date(dateStr).getTime();
	if (Number.isNaN(dateMs)) return "—";
	const compact = options?.compact === true;
	const suffix = compact ? "" : " ago";
	const seconds = Math.floor(((now ?? Date.now()) - dateMs) / 1000);
	if (seconds < 60) return compact ? "now" : "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m${suffix}`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h${suffix}`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d${suffix}`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo${suffix}`;
	const years = Math.floor(months / 12);
	return `${years}y${suffix}`;
}
