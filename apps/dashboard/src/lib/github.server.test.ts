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
const appConstructor = vi.fn();
const getGitHubAccessTokenByUserId = vi.fn(async () => "github-token");
const getGitHubAppId = vi.fn(() => "12345");
const getGitHubAppPrivateKey = vi.fn(() => "private-key");

vi.mock("octokit", () => ({
	App: appConstructor,
	Octokit: octokitConstructor,
}));

vi.mock("./github-app.server", () => ({
	getGitHubAccessTokenByUserId,
	getGitHubAppId,
	getGitHubAppPrivateKey,
}));

beforeEach(() => {
	vi.resetModules();
	octokitInstances.length = 0;
	octokitConstructor.mockClear();
	appConstructor.mockClear();
	getGitHubAccessTokenByUserId.mockClear();
	getGitHubAppId.mockClear();
	getGitHubAppPrivateKey.mockClear();
});

describe("getGitHubClient", () => {
	it("configures Octokit throttling, bounded retries, and request timeouts", async () => {
		const { getGitHubClient } = await import("./github.server");

		await getGitHubClient("user-123");

		expect(getGitHubAccessTokenByUserId).toHaveBeenCalledWith("user-123");
		expect(octokitConstructor).toHaveBeenCalledTimes(1);

		const [instance] = octokitInstances;
		const options = instance.options as {
			auth: string;
			userAgent: string;
			retry: { enabled: boolean };
			throttle: {
				enabled: boolean;
				id: string;
				fallbackSecondaryRateRetryAfter: number;
				onRateLimit: (
					retryAfter: number,
					options: { method?: string; url: string },
					octokit: {
						log: {
							warn: (message: string) => void;
							info: (message: string) => void;
						};
					},
					retryCount: number,
				) => boolean;
				onSecondaryRateLimit: (
					retryAfter: number,
					options: { method?: string; url: string },
					octokit: {
						log: {
							warn: (message: string) => void;
							info: (message: string) => void;
						};
					},
					retryCount: number,
				) => boolean;
			};
		};

		expect(options.auth).toBe("github-token");
		expect(options.userAgent).toBe("diffkit-dashboard");
		expect(options.retry).toEqual({ enabled: true });
		expect(options.throttle.enabled).toBe(true);
		expect(options.throttle.id).toBe("github-user:user-123");
		expect(options.throttle.fallbackSecondaryRateRetryAfter).toBe(60);

		expect(instance.hookBefore).toHaveBeenCalledTimes(1);
		expect(instance.hookAfter).toHaveBeenCalledTimes(1);
		expect(instance.hookError).toHaveBeenCalledTimes(1);
		const [hookEvent, hookHandler] = instance.hookBefore.mock.calls[0] as [
			string,
			(options: {
				method?: string;
				request?: { retries?: number; signal?: AbortSignal };
			}) => void,
		];
		expect(hookEvent).toBe("request");

		const getOptions = { method: "GET" } as {
			method?: string;
			request?: { retries?: number; signal?: AbortSignal };
		};
		hookHandler(getOptions);
		expect(getOptions.request?.retries).toBe(1);
		expect(getOptions.request?.signal).toBeInstanceOf(AbortSignal);

		const postOptions = { method: "POST" } as {
			method?: string;
			request?: { retries?: number; signal?: AbortSignal };
		};
		hookHandler(postOptions);
		expect(postOptions.request?.retries).toBe(0);
		expect(postOptions.request?.signal).toBeInstanceOf(AbortSignal);

		expect(
			options.throttle.onRateLimit(
				30,
				{ method: "GET", url: "/repos" },
				{
					log: instance.log,
				},
				0,
			),
		).toBe(false);
		expect(
			options.throttle.onRateLimit(
				30,
				{ method: "POST", url: "/repos" },
				{
					log: instance.log,
				},
				0,
			),
		).toBe(false);
		expect(
			options.throttle.onSecondaryRateLimit(
				30,
				{ method: "GET", url: "/search/issues" },
				{ log: instance.log },
				1,
			),
		).toBe(false);
		expect(instance.log.warn).toHaveBeenCalled();
		expect(instance.log.info).not.toHaveBeenCalled();
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
			throttle: {
				enabled: boolean;
				id: string;
				fallbackSecondaryRateRetryAfter: number;
			};
		};
		expect(options.auth).toBe("installation-token");
		expect(options.userAgent).toBe("diffkit-dashboard");
		expect(options.retry).toEqual({ enabled: true });
		expect(options.throttle.enabled).toBe(true);
		expect(options.throttle.id).toBe("github-installation:987");
		expect(options.throttle.fallbackSecondaryRateRetryAfter).toBe(60);
		expect(appOctokit.hook.before).toHaveBeenCalledTimes(1);
		expect(appOctokit.hook.after).toHaveBeenCalledTimes(1);
		expect(appOctokit.hook.error).toHaveBeenCalledTimes(1);
		expect(installationInstance.hookBefore).toHaveBeenCalledTimes(1);
		expect(installationInstance.hookAfter).toHaveBeenCalledTimes(1);
		expect(installationInstance.hookError).toHaveBeenCalledTimes(1);
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
