import { RequestError } from "octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearIdentityMemory } from "./identity-memory";
import { getGitHubContextForRepository } from "./installations";

type RepositoryPayload = { full_name: string };

const github = vi.hoisted(() => ({
	request: new Request("https://diffkit.test/"),
	userId: "u1",
	repositorySelection: "all" as string,
	/** What the viewer's app-user token is answered when it reads a repository. */
	readRepository:
		vi.fn<
			(params: { owner: string; repo: string }) => Promise<RepositoryPayload>
		>(),
	/** What the viewer's app-user token is listed for the installation. */
	listedRepositories: vi.fn<() => Promise<RepositoryPayload[]>>(),
}));

vi.mock("cloudflare:workers", () => ({ env: {} }));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => github.request,
}));

vi.mock("../auth-runtime", () => ({
	getRequestSession: async () => ({ user: { id: github.userId } }),
	getGitHubClientByUserId: async (userId: string) => ({
		token: `oauth:${userId}`,
	}),
	getGitHubAppUserClientByUserId: async () => ({
		request: async () => ({
			data: {
				installations: [
					{
						id: 7,
						account: { id: 70, login: "acme", type: "Organization" },
						target_type: "Organization",
						repository_selection: github.repositorySelection,
					},
				],
			},
		}),
		rest: {
			repos: {
				get: async (params: { owner: string; repo: string }) => ({
					data: await github.readRepository(params),
				}),
			},
			apps: {
				listInstallationReposForAuthenticatedUser: async () => ({
					data: { repositories: await github.listedRepositories() },
				}),
			},
		},
	}),
}));

vi.mock("../github.server", () => ({
	getGitHubInstallationClient: async (installationId: number) => ({
		token: `installation:${installationId}`,
		auth: async () => ({}),
	}),
}));

function notFound() {
	return new RequestError("Not Found", 404, {
		request: { method: "GET", url: "https://api.github.com", headers: {} },
	});
}

/** The token a read of this repository would go out with. */
async function tokenFor(repo: string, userId = "u1") {
	github.userId = userId;
	github.request = new Request("https://diffkit.test/");
	const context = await getGitHubContextForRepository({ owner: "acme", repo });
	return (context?.octokit as unknown as { token: string }).token;
}

describe("getGitHubContextForRepository", () => {
	beforeEach(() => {
		clearIdentityMemory();
		github.repositorySelection = "all";
		github.readRepository.mockReset();
		github.listedRepositories.mockReset();
	});

	it("reads with the installation token once GitHub confirms the viewer can read the repository", async () => {
		github.readRepository.mockResolvedValue({ full_name: "acme/api" });

		expect(await tokenFor("api")).toBe("installation:7");
		expect(github.readRepository).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ owner: "acme", repo: "api" }),
		);
	});

	it("keeps the viewer's token when the viewer cannot read a repository of an all-repositories installation", async () => {
		github.readRepository.mockRejectedValue(notFound());

		expect(await tokenFor("secret")).toBe("oauth:u1");
	});

	it("keeps the viewer's token when the check fails, and asks again on the next read", async () => {
		github.readRepository.mockRejectedValueOnce(new Error("bad gateway"));
		github.readRepository.mockResolvedValue({ full_name: "acme/api" });

		expect(await tokenFor("api")).toBe("oauth:u1");
		expect(await tokenFor("api")).toBe("installation:7");
	});

	it("keeps the viewer's token when the name now belongs to another repository", async () => {
		github.readRepository.mockResolvedValue({ full_name: "elsewhere/api" });

		expect(await tokenFor("api")).toBe("oauth:u1");
	});

	it("needs the repository listed for the viewer when the selection is not all repositories", async () => {
		github.listedRepositories.mockResolvedValue([{ full_name: "acme/api" }]);

		github.repositorySelection = "selected";
		expect(await tokenFor("api")).toBe("installation:7");
		expect(await tokenFor("secret")).toBe("oauth:u1");

		clearIdentityMemory();
		github.repositorySelection = "a selection added later";
		expect(await tokenFor("api")).toBe("installation:7");
		expect(await tokenFor("secret")).toBe("oauth:u1");
		expect(github.readRepository).not.toHaveBeenCalled();
	});

	it("asks once per viewer and never answers one viewer with another's access", async () => {
		github.readRepository.mockResolvedValueOnce({ full_name: "acme/api" });
		github.readRepository.mockRejectedValue(notFound());

		expect(await tokenFor("api", "u1")).toBe("installation:7");
		expect(await tokenFor("api", "u1")).toBe("installation:7");
		expect(github.readRepository).toHaveBeenCalledTimes(1);

		expect(await tokenFor("api", "u2")).toBe("oauth:u2");
		expect(github.readRepository).toHaveBeenCalledTimes(2);
	});
});
