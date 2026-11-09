import { defineConfig } from "void/config";

// The Worker, its bindings and its schedule. `void deploy` creates any
// resource missing from the account and records its ID in void.lock.json.
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
		// Change-feed sweeper and D1 size check (src/lib/scheduled-maintenance.server.ts).
		triggers: { crons: ["*/5 * * * *"] },
		observability: {
			logs: { enabled: true, invocation_logs: true },
			traces: { enabled: false },
		},
		// /api/health reports the serving version from this binding.
		version_metadata: { binding: "CF_VERSION_METADATA" },
	},
});
