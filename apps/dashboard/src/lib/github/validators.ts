/** No server-only imports here: TanStack Start keeps `.validator(...)` in the SSR caller module, so this file loads wherever a server function is imported. */

export function identityValidator<TInput>(data: TInput) {
	return data;
}
