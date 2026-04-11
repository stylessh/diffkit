import { beforeEach, describe, expect, it, vi } from "vitest";

const octokitInstances: Array<{
	hookBefore: ReturnType<typeof vi.fn>;
	log: { warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
	options: Record<string, unknown>;
}> = [];
const octokitConstructor = vi.fn((options: Record<string, unknown>) => {
	const instance = {
		hookBefore: vi.fn(),
		log: {
			warn: vi.fn(),
			info: vi.fn(),
		},
		options,
	};

	octokitInstances.push(instance);

	return {
		hook: {
			before: instance.hookBefore,
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
	octokitInstances.length = 0;
	octokitConstructor.mockClear();
	appConstructor.mockClear();
	getGitHubAccessTokenByUserId.mockClear();
	getGitHubAppId.mockClear();
	getGitHubAppPrivateKey.mockClear();
});

describe("getGitHubClient", () => {
	it("configures Octokit throttling and safe-method retries", async () => {
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
		expect(options.userAgent).toBe("quickhub-dashboard");
		expect(options.retry).toEqual({ enabled: true });
		expect(options.throttle.enabled).toBe(true);
		expect(options.throttle.id).toBe("github-user:user-123");
		expect(options.throttle.fallbackSecondaryRateRetryAfter).toBe(60);

		expect(instance.hookBefore).toHaveBeenCalledTimes(1);
		const [hookEvent, hookHandler] = instance.hookBefore.mock.calls[0] as [
			string,
			(options: { method?: string; request?: { retries?: number } }) => void,
		];
		expect(hookEvent).toBe("request");

		const getOptions = { method: "GET" } as {
			method?: string;
			request?: { retries?: number };
		};
		hookHandler(getOptions);
		expect(getOptions.request?.retries).toBe(2);

		const postOptions = { method: "POST" } as {
			method?: string;
			request?: { retries?: number };
		};
		hookHandler(postOptions);
		expect(postOptions.request?.retries).toBe(0);

		expect(
			options.throttle.onRateLimit(
				30,
				{ method: "GET", url: "/repos" },
				{
					log: instance.log,
				},
				0,
			),
		).toBe(true);
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
		expect(instance.log.info).toHaveBeenCalledTimes(1);
	});

	it("creates GitHub App installation clients from app credentials", async () => {
		const installationOctokit = {
			hook: {
				before: vi.fn(),
			},
		};
		appConstructor.mockImplementationOnce(() => ({
			getInstallationOctokit: vi.fn(async () => installationOctokit),
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
		expect(installationOctokit.hook.before).toHaveBeenCalledTimes(1);
	});
});
