import { createServerFn } from "@tanstack/react-start";

/** Stars on DiffKit's own repository; `null` until the first count is cached. */
export const getRepositoryStars = createServerFn({ method: "GET" }).handler(
	async (): Promise<number | null> => {
		const [{ env, waitUntil }, stars] = await Promise.all([
			import("cloudflare:workers"),
			import("./repository-stars.server"),
		]);
		return stars.readRepositoryStars({
			kv: env.GITHUB_CACHE_KV,
			fetchCount: stars.fetchRepositoryStars,
			defer: waitUntil,
		});
	},
);
