import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , outArg] = process.argv;

if (!outArg) {
  console.error(
    "Usage: node scripts/generate-wrangler-dashboard-config.mjs <outFile>"
  );
  process.exit(1);
}

const outFile = resolve(outArg);
const compatibilityDate =
  process.env.WRANGLER_COMPATIBILITY_DATE || "2025-09-02";

const name = process.env.DASHBOARD_PROD_WORKER_NAME;
const d1Name = process.env.DASHBOARD_PROD_D1_DATABASE_NAME;
const d1Id = process.env.DASHBOARD_PROD_D1_DATABASE_ID;
const kvId = process.env.DASHBOARD_PROD_KV_ID;
const kvPreviewId =
  process.env.DASHBOARD_PROD_KV_PREVIEW_ID || process.env.DASHBOARD_PROD_KV_ID;
const r2Bucket = process.env.DASHBOARD_PROD_R2_BUCKET;
const r2Preview = process.env.DASHBOARD_PROD_R2_PREVIEW_BUCKET;

for (const [key, val] of Object.entries({
  DASHBOARD_PROD_WORKER_NAME: name,
  DASHBOARD_PROD_D1_DATABASE_NAME: d1Name,
  DASHBOARD_PROD_D1_DATABASE_ID: d1Id,
  DASHBOARD_PROD_KV_ID: kvId,
  DASHBOARD_PROD_R2_BUCKET: r2Bucket,
  DASHBOARD_PROD_R2_PREVIEW_BUCKET: r2Preview,
})) {
  if (!val) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const config = {
  $schema: "node_modules/wrangler/config-schema.json",
  compatibility_date: compatibilityDate,
  compatibility_flags: [
    "nodejs_compat",
    "no_handle_cross_request_promise_resolution",
  ],
  main: "src/entry-worker.ts",
  // Change-feed sweeper and D1 size check (scheduled-maintenance.server.ts).
  triggers: { crons: ["*/5 * * * *"] },
  observability: {
    logs: { enabled: true, invocation_logs: true },
    traces: { enabled: false },
  },
  // SignalRelay Durable Object was removed; v2 deletes the class on Workers
  // that already applied v1. Keep both tags.
  migrations: [
    { tag: "v1", new_classes: ["SignalRelay"] },
    { tag: "v2", deleted_classes: ["SignalRelay"] },
  ],
  name,
  d1_databases: [
    {
      binding: "DB",
      database_name: d1Name,
      database_id: d1Id,
      migrations_dir: "drizzle",
    },
  ],
  kv_namespaces: [
    {
      binding: "GITHUB_CACHE_KV",
      id: kvId,
      preview_id: kvPreviewId,
    },
  ],
  r2_buckets: [
    {
      binding: "COMMENT_MEDIA",
      bucket_name: r2Bucket,
      preview_bucket_name: r2Preview,
      remote: true,
    },
  ],
};

writeFileSync(outFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
