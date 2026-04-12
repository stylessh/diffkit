export async function ensureDefinedQueryData<TData>(
	load: () => Promise<TData>,
	source: string,
): Promise<Exclude<TData, undefined>> {
	const data = await load();
	if (typeof data === "undefined") {
		throw new Error(`${source} returned undefined`);
	}

	return data as Exclude<TData, undefined>;
}
