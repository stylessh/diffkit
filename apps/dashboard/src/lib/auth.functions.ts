import { createServerFn } from "@tanstack/react-start";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const [{ getRequest }, { getAuth }] = await Promise.all([
			import("@tanstack/react-start/server"),
			import("./auth.server"),
		]);
		const request = getRequest();
		const auth = getAuth();
		const session = await auth.api.getSession({
			headers: request.headers,
		});
		return session;
	},
);
