import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const auth = getAuth();
		const session = await auth.api.getSession({
			headers: request.headers,
		});
		return session;
	},
);
