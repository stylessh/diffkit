import { beforeEach, describe, expect, it, vi } from "vitest";

const octokitInstances: Array<{
	hookBefore: ReturnType<typeof vi.fn>;
	hookAfter: ReturnType<typeof vi.fn>;
	hookError: ReturnType<typeof vi.fn>;
	log: { warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
	options: Record<string, unknown>;
}> = [];
const octokitConstructor = vi.fn((options: Record<string, unknown>) => {
	const instance = {
		hookBefore: vi.fn(),
		hookAfter: vi.fn(),
		hookError: vi.fn(),
		log: {
			warn: vi.fn(),
			info: vi.fn(),
		},
		options,
	};

	octokitInstances.push(instance);

	return {
		hook: {
			after: instance.hookAfter,
			before: instance.hookBefore,
			error: instance.hookError,
		},
		log: instance.log,
	};
});
const octokitDefaults = vi.fn(() => octokitConstructor);
Object.assign(octokitConstructor, { defaults: octokitDefaults });
const appConstructor = vi.fn();
const getGitHubAccessTokenByUserId = vi.fn(async () => "github-token");
const getGitHubAppId = vi.fn(() => "12345");
const getGitHubAppPrivateKey = vi.fn(() => "private-key");
const configureGitHubRequestPolicies = vi.fn();

vi.mock("octokit", () => ({
	App: appConstructor,
	Octokit: octokitConstructor,
}));

vi.mock("./github-app.server", () => ({
	getGitHubAccessTokenByUserId,
	getGitHubAppId,
	getGitHubAppPrivateKey,
}));

vi.mock("./github-request-policy", () => ({
	configureGitHubRequestPolicies,
}));

beforeEach(() => {
	vi.resetModules();
	octokitInstances.length = 0;
	octokitConstructor.mockClear();
	appConstructor.mockClear();
	getGitHubAccessTokenByUserId.mockClear();
	getGitHubAppId.mockClear();
	getGitHubAppPrivateKey.mockClear();
	octokitDefaults.mockClear();
	configureGitHubRequestPolicies.mockClear();
});

describe("getGitHubClient", () => {
	it("creates an Octokit client with user token and request policies", async () => {
		const { getGitHubClient } = await import("./github.server");

		await getGitHubClient("user-123");

		expect(getGitHubAccessTokenByUserId).toHaveBeenCalledWith("user-123");
		expect(octokitConstructor).toHaveBeenCalledTimes(1);

		const [instance] = octokitInstances;
		const options = instance.options as {
			auth: string;
			userAgent: string;
			retry: { enabled: boolean };
			throttle: { enabled: boolean };
		};

		expect(options.auth).toBe("github-token");
		expect(options.userAgent).toBe("diffkit-dashboard");
		expect(options.retry).toEqual({ enabled: false });
		expect(options.throttle).toEqual({ enabled: false });

		expect(configureGitHubRequestPolicies).toHaveBeenCalledTimes(1);
		expect(configureGitHubRequestPolicies.mock.calls[0][1]).toEqual({
			tokenLabel: "oauth:user:user-123",
		});
	});

	it("creates GitHub App installation clients from app credentials", async () => {
		const appAuth = vi.fn(async () => ({
			token: "installation-token",
			expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			permissions: { contents: "read" },
			repositoryIds: [123],
			repositorySelection: "selected",
		}));
		const appOctokit = {
			auth: appAuth,
			hook: {
				after: vi.fn(),
				before: vi.fn(),
				error: vi.fn(),
			},
		};
		appConstructor.mockImplementationOnce(() => ({
			octokit: appOctokit,
		}));
		const { getGitHubInstallationClient } = await import("./github.server");

		await getGitHubInstallationClient(987);

		expect(getGitHubAppId).toHaveBeenCalled();
		expect(getGitHubAppPrivateKey).toHaveBeenCalled();
		expect(appConstructor).toHaveBeenCalledWith({
			appId: "12345",
			privateKey: "private-key",
			Octokit: octokitConstructor,
		});
		expect(appAuth).toHaveBeenCalledWith({
			type: "installation",
			installationId: 987,
		});
		expect(octokitConstructor).toHaveBeenCalledTimes(1);
		const [installationInstance] = octokitInstances;
		const options = installationInstance.options as {
			auth: string;
			userAgent: string;
			retry: { enabled: boolean };
			throttle: { enabled: boolean };
		};
		expect(options.auth).toBe("installation-token");
		expect(options.userAgent).toBe("diffkit-dashboard");
		expect(options.retry).toEqual({ enabled: false });
		expect(options.throttle).toEqual({ enabled: false });
		expect(octokitDefaults).toHaveBeenCalledWith({
			retry: { enabled: false },
			throttle: { enabled: false },
		});
		expect(configureGitHubRequestPolicies).toHaveBeenCalledTimes(2);
		expect(configureGitHubRequestPolicies.mock.calls[0][1]).toEqual({
			tokenLabel: "app-auth:installation:987",
		});
		expect(configureGitHubRequestPolicies.mock.calls[1][1]).toEqual({
			tokenLabel: "installation:987",
		});
	});

	it("reuses fresh installation tokens and remints after invalidation", async () => {
		const appAuth = vi.fn(async () => ({
			token: `installation-token-${appAuth.mock.calls.length}`,
			expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
		}));
		appConstructor.mockImplementation(() => ({
			octokit: {
				auth: appAuth,
				hook: {
					after: vi.fn(),
					before: vi.fn(),
					error: vi.fn(),
				},
			},
		}));
		const { getGitHubInstallationClient, invalidateGitHubInstallationToken } =
			await import("./github.server");

		await getGitHubInstallationClient(987);
		await getGitHubInstallationClient(987);

		expect(appConstructor).toHaveBeenCalledTimes(1);
		expect(appAuth).toHaveBeenCalledTimes(1);
		expect(octokitConstructor).toHaveBeenCalledTimes(2);
		expect(octokitInstances[0].options.auth).toBe("installation-token-1");
		expect(octokitInstances[1].options.auth).toBe("installation-token-1");

		await invalidateGitHubInstallationToken(987);
		await getGitHubInstallationClient(987);

		expect(appConstructor).toHaveBeenCalledTimes(2);
		expect(appAuth).toHaveBeenCalledTimes(2);
		expect(octokitInstances[2].options.auth).toBe("installation-token-2");
	});
});
