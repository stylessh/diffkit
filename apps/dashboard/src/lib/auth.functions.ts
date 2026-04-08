import { createServerFn } from "@tanstack/react-start";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const { getRequestSession } = await import("./auth-runtime");
		return getRequestSession();
	},
);
