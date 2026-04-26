export function countUniqueById(items: Iterable<{ id: number }>) {
	return new Set(Array.from(items, (item) => item.id)).size;
}
