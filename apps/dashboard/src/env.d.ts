// Bindings named in void.config.ts and the values declared in env.ts, as the
// Worker sees them through `import { env } from "cloudflare:workers"`.

declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
		GITHUB_CACHE_KV: KVNamespace;
		COMMENT_MEDIA: R2Bucket;
		/** Public base URL for R2 comment media (custom domain or r2.dev). */
		R2_PUBLIC_BASE_URL?: string;
		GITHUB_OAUTH_CLIENT_ID?: string;
		GITHUB_OAUTH_CLIENT_SECRET?: string;
		GITHUB_APP_CLIENT_ID?: string;
		GITHUB_APP_CLIENT_SECRET?: string;
		GITHUB_APP_ID?: string;
		GITHUB_APP_PRIVATE_KEY?: string;
		GITHUB_APP_SLUG?: string;
		GITHUB_WEBHOOK_SECRET?: string;
		GITHUB_CLIENT_ID?: string;
		GITHUB_CLIENT_SECRET?: string;
		BETTER_AUTH_SECRET: string;
		BETTER_AUTH_URL: string;
		/** Local demo mode only: base URL of `apps/emulator` (e.g. http://localhost:4001). */
		GITHUB_EMULATOR_URL?: string;
	}
}

interface ImportMetaEnv {
	/** `off` keeps react-scan, Agentation and TanStack Devtools out of dev pages. */
	readonly VITE_DEV_OVERLAYS?: string;
}
