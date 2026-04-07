import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAuth } from "./auth";
import { getGitHubClient } from "./github";

export const getUserRepos = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const auth = getAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) return [];

		const octokit = await getGitHubClient(session.user.id);
		const { data } = await octokit.rest.repos.listForAuthenticatedUser({
			sort: "updated",
			per_page: 10,
		});

		return data.map((repo) => ({
			id: repo.id,
			name: repo.full_name,
			description: repo.description,
			stars: repo.stargazers_count,
			language: repo.language,
			updatedAt: repo.updated_at,
			isPrivate: repo.private,
			url: repo.html_url,
		}));
	},
);
