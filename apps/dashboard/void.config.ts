import { defineConfig } from "void/config";

// The Worker and its bindings; cron schedules live in crons/.
//
// A new instance leaves the DIFFKIT_* variables unset: `void deploy` creates
// D1, KV and R2 in your account and records them in void.lock.json. An
// instance with existing resources (diff-kit.com does) pins all four on
// every deploy. Leaving R2 out of a deploy makes Void bind a new, empty
// bucket, so a partial pin is an error.
const PINNED_RESOURCE_VARS = [
	"DIFFKIT_D1_DATABASE_NAME",
	"DIFFKIT_D1_DATABASE_ID",
	"DIFFKIT_KV_ID",
	"DIFFKIT_R2_BUCKET",
] as const;

function pinnedResources() {
	const missing = PINNED_RESOURCE_VARS.filter((name) => !process.env[name]);
	if (missing.length === PINNED_RESOURCE_VARS.length) {
		return {};
	}
	if (missing.length > 0) {
		throw new Error(
			`Set all of ${PINNED_RESOURCE_VARS.join(", ")} or none of them. Missing: ${missing.join(", ")}.`,
		);
	}
	return {
		d1_databases: [
			{
				binding: "DB",
				database_name: process.env.DIFFKIT_D1_DATABASE_NAME,
				database_id: process.env.DIFFKIT_D1_DATABASE_ID,
				migrations_dir: "db/migrations",
			},
		],
		kv_namespaces: [
			{ binding: "GITHUB_CACHE_KV", id: process.env.DIFFKIT_KV_ID },
		],
		r2_buckets: [
			{ binding: "COMMENT_MEDIA", bucket_name: process.env.DIFFKIT_R2_BUCKET },
		],
	};
}

// Serve the Worker on a domain in your Cloudflare account. Void manages the
// route, so set it on every deploy once you use one.
function customDomain() {
	const domain = process.env.DIFFKIT_DOMAIN;
	return domain ? { routes: [{ pattern: domain, custom_domain: true }] } : {};
}

export default defineConfig({
	inference: {
		bindings: {
			db: "DB",
			kv: "GITHUB_CACHE_KV",
			storage: "COMMENT_MEDIA",
			ai: false,
		},
	},
	worker: {
		compatibility_date: "2025-09-02",
		compatibility_flags: [
			"nodejs_compat",
			"no_handle_cross_request_promise_resolution",
		],
	},
	cloudflare: {
		name: "diffkit",
		main: "./src/entry-worker.ts",
		workers_dev: true,
		preview_urls: true,
		...customDomain(),
		observability: {
			logs: { enabled: true, invocation_logs: true },
			traces: { enabled: false },
		},
		// /api/health reports the serving version from this binding.
		version_metadata: { binding: "CF_VERSION_METADATA" },
		...pinnedResources(),
	},
});
