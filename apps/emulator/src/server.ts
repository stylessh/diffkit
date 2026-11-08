/**
 * Boots emulate's GitHub service in-process and layers DiffKit's shims on the
 * same Hono app and Store:
 *
 *   request ─▶ enrichResponse(app.fetch)
 *                 ├─ emulate core middleware (cors, errors, auth, rate limit)
 *                 ├─ DiffKit shim routes (registered first, so they win)
 *                 │    /graphql, /notifications, /user/installations, ...
 *                 └─ emulate's GitHub REST routes
 *
 * We replicate `createEmulator` from the `emulate` package instead of calling
 * it because it does not expose the Hono app or the Store.
 */
import type { Server } from "node:http";
import {
	type AppEnv,
	createServer,
	type Hono,
	type PersistenceAdapter,
	restoreTokenMap,
	type ServicePlugin,
	type Store,
	serializeTokenMap,
	serve,
	type TokenEntry,
	type TokenMap,
	type WebhookDispatcher,
} from "@emulators/core";
import {
	createAppKeyResolver,
	type GitHubSeedConfig,
	getGitHubStore,
	githubPlugin,
	seedFromConfig,
} from "@emulators/github";
import { registerGraphQLRoute } from "./graphql/handler";
import { org, people } from "./seed/content/people";
import {
	DEFAULT_DASHBOARD_URL,
	DEFAULT_EMULATOR_PORT,
	DEMO_GITHUB_APP,
	DEMO_INSTALLATION_IDS,
	DEMO_OAUTH_APP,
	oauthRedirectUris,
	SEED_ADMIN_TOKEN,
	seedTokenFor,
} from "./seed/identity";
import { enrichResponse } from "./shims/enrich";
import { registerNotificationRoutes } from "./shims/notifications";
import { bridgePullIssueRequest } from "./shims/pull-issue-bridge";
import { registerRestShims } from "./shims/rest";
import { getExtrasStore } from "./store-extras";

export type ShimContext = {
	app: Hono<AppEnv>;
	store: Store;
	webhooks: WebhookDispatcher;
	baseUrl: string;
	tokenMap: TokenMap;
	/** Calls the emulator itself (no network), keeping the caller's auth. */
	internalFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

export type DiffkitEmulatorOptions = {
	port?: number;
	hostname?: string;
	baseUrl?: string;
	dashboardUrl?: string;
	persistence?: PersistenceAdapter | null;
	/** Fingerprint of the seed; persisted state with another one is discarded. */
	seedFingerprint?: string;
};

export type DiffkitEmulator = {
	url: string;
	store: Store;
	app: Hono<AppEnv>;
	tokenMap: TokenMap;
	/** `true` when state came from persistence and content seeding can be skipped. */
	restored: boolean;
	fetch: (request: Request) => Promise<Response>;
	save: () => Promise<void>;
	close: () => Promise<void>;
};

const PERSISTENCE_VERSION = 1;

type PersistedState = {
	version: number;
	seedFingerprint: string;
	store: ReturnType<Store["snapshot"]>;
	tokens: TokenEntry[];
};

export function buildSeedConfig(dashboardUrl: string): GitHubSeedConfig {
	const redirects = oauthRedirectUris(dashboardUrl);
	return {
		users: people.map((person) => ({
			login: person.login,
			name: person.name,
			email: person.email,
			bio: person.bio,
			company: person.company,
			location: person.location,
			blog: person.blog,
			twitter_username: person.twitter,
		})),
		orgs: [
			{
				login: org.login,
				name: org.name,
				description: org.description,
				members: org.members,
			},
		],
		oauth_apps: [
			{
				client_id: DEMO_OAUTH_APP.clientId,
				client_secret: DEMO_OAUTH_APP.clientSecret,
				name: DEMO_OAUTH_APP.name,
				redirect_uris: redirects.signIn,
			},
			{
				// GitHub Apps have their own OAuth client for user-to-server tokens.
				client_id: DEMO_GITHUB_APP.clientId,
				client_secret: DEMO_GITHUB_APP.clientSecret,
				name: DEMO_GITHUB_APP.name,
				redirect_uris: redirects.app,
			},
		],
		apps: [
			{
				app_id: DEMO_GITHUB_APP.appId,
				slug: DEMO_GITHUB_APP.slug,
				name: DEMO_GITHUB_APP.name,
				private_key: DEMO_GITHUB_APP.privateKey,
				description: "Local demo GitHub App for DiffKit",
				webhook_url: `${dashboardUrl}/api/webhooks/github`,
				webhook_secret: DEMO_GITHUB_APP.webhookSecret,
				events: ["*"],
				permissions: {
					actions: "write",
					checks: "write",
					contents: "write",
					issues: "write",
					metadata: "read",
					pull_requests: "write",
					statuses: "write",
					members: "read",
				},
				installations: [
					{
						installation_id: DEMO_INSTALLATION_IDS.org,
						account: org.login,
						repository_selection: "all",
					},
					{
						installation_id: DEMO_INSTALLATION_IDS.viewer,
						account: people[0].login,
						repository_selection: "all",
					},
				],
			},
		],
	};
}

const FULL_SCOPES = [
	"repo",
	"user",
	"admin:org",
	"admin:repo_hook",
	"workflow",
];

function seedTokens() {
	const tokens: Record<
		string,
		{ login: string; id: number; scopes: string[] }
	> = {
		[SEED_ADMIN_TOKEN]: { login: "admin", id: 0, scopes: FULL_SCOPES },
	};
	for (const person of people) {
		tokens[seedTokenFor(person.login)] = {
			login: person.login,
			id: 0,
			scopes: FULL_SCOPES,
		};
	}
	return tokens;
}

/** Token map entries carry the user id; fill it in once users exist. */
function syncTokenUserIds(store: Store, tokenMap: TokenMap) {
	const gh = getGitHubStore(store);
	for (const entry of tokenMap.values()) {
		const user = gh.users.findOneBy("login", entry.login);
		if (user) {
			entry.id = user.id;
		}
	}
}

function waitForListening(server: Server) {
	if (server.listening) {
		return Promise.resolve();
	}
	return new Promise<void>((resolve, reject) => {
		server.once("listening", () => resolve());
		server.once("error", reject);
	});
}

export async function createDiffkitEmulator(
	options: DiffkitEmulatorOptions = {},
): Promise<DiffkitEmulator> {
	const requestedPort = options.port ?? DEFAULT_EMULATOR_PORT;
	const dashboardUrl = options.dashboardUrl ?? DEFAULT_DASHBOARD_URL;

	let handler: ((request: Request) => Promise<Response>) | undefined;
	const httpServer = serve({
		fetch: (request) =>
			handler ? handler(request) : new Response("Starting", { status: 503 }),
		port: requestedPort,
		hostname: options.hostname ?? "127.0.0.1",
	});
	await waitForListening(httpServer);
	const address = httpServer.address();
	const port =
		address && typeof address === "object" ? address.port : requestedPort;
	const baseUrl = options.baseUrl ?? `http://localhost:${port}`;

	let shimContext: ShimContext | undefined;
	let pipeline: ((request: Request) => Promise<Response>) | undefined;
	const plugin: ServicePlugin = {
		name: "github",
		register(app, store, webhooks, pluginBaseUrl, tokenMap) {
			shimContext = {
				app,
				store,
				webhooks,
				baseUrl: pluginBaseUrl,
				tokenMap: tokenMap ?? new Map(),
				internalFetch: (path, init) => {
					const request = new Request(`${pluginBaseUrl}${path}`, init);
					return pipeline ? pipeline(request) : app.fetch(request);
				},
			};
			getExtrasStore(store);
			// Shim routes first: the first matching route wins.
			registerGraphQLRoute(shimContext);
			registerNotificationRoutes(shimContext);
			registerRestShims(shimContext);
			githubPlugin.register(app, store, webhooks, pluginBaseUrl, tokenMap);
		},
		seed: githubPlugin.seed,
	};

	let resolveAppKey: ReturnType<typeof createAppKeyResolver> | undefined;
	const { app, store, tokenMap } = createServer(plugin, {
		port,
		baseUrl,
		tokens: seedTokens(),
		appKeyResolver: (appId) => resolveAppKey?.(appId) ?? null,
	});
	resolveAppKey = createAppKeyResolver(store);

	const persistence = options.persistence ?? null;
	const fingerprint = options.seedFingerprint ?? "unversioned";
	let restored = false;
	if (persistence) {
		const raw = await persistence.load();
		if (raw) {
			try {
				const state = JSON.parse(raw) as PersistedState;
				if (
					state.version === PERSISTENCE_VERSION &&
					state.seedFingerprint === fingerprint
				) {
					store.restore(state.store);
					restoreTokenMap(tokenMap, state.tokens);
					restored = true;
				}
			} catch (error) {
				console.warn("[emulator] ignoring unreadable persisted state", error);
			}
		}
	}

	if (!restored) {
		githubPlugin.seed?.(store, baseUrl);
		seedFromConfig(store, baseUrl, buildSeedConfig(dashboardUrl));
	}
	syncTokenUserIds(store, tokenMap);

	let saving: Promise<void> | null = null;
	let dirty = false;
	const save = async () => {
		if (!persistence) {
			return;
		}
		if (saving) {
			dirty = true;
			return saving;
		}
		const state: PersistedState = {
			version: PERSISTENCE_VERSION,
			seedFingerprint: fingerprint,
			store: store.snapshot(),
			tokens: serializeTokenMap(tokenMap),
		};
		saving = persistence.save(JSON.stringify(state)).finally(() => {
			saving = null;
			if (dirty) {
				dirty = false;
				void save();
			}
		});
		return saving;
	};

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	const scheduleSave = () => {
		if (!persistence || saveTimer) {
			return;
		}
		saveTimer = setTimeout(() => {
			saveTimer = null;
			void save();
		}, 500);
	};

	const context = shimContext;
	if (!context) {
		throw new Error("emulator plugin was not registered");
	}

	pipeline = (request: Request) =>
		enrichResponse(context, request, async (inner) => {
			const bridged = await bridgePullIssueRequest(context, inner);
			return bridged ?? app.fetch(inner);
		});
	const run = pipeline;

	const fetchHandler = async (request: Request) => {
		const response = await run(request);
		if (request.method !== "GET" && request.method !== "HEAD") {
			scheduleSave();
		}
		return response;
	};
	handler = fetchHandler;

	return {
		url: baseUrl,
		store,
		app,
		tokenMap,
		restored,
		fetch: fetchHandler,
		save,
		close: async () => {
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTimer = null;
			}
			await save();
			await new Promise<void>((resolve) => {
				httpServer.close(() => resolve());
				httpServer.closeAllConnections();
			});
		},
	};
}
