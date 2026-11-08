-- Drop the cache-era tables removed from the schema in #193 (see
-- docs/platform-plan.md, "Incidents"). Only apply after the throttled
-- production purge has emptied them: dropping a multi-GB table in one
-- statement blocks the deploy pipeline. Check first with
--   wrangler d1 execute <db> --remote --command "SELECT
--     (SELECT COUNT(*) FROM github_webhook_event) AS webhook_events,
--     (SELECT COUNT(*) FROM github_revalidation_signal) AS signals,
--     (SELECT COUNT(*) FROM github_cache_namespace) AS namespaces,
--     (SELECT COUNT(*) FROM github_response_cache) AS responses"
DROP TABLE IF EXISTS `github_webhook_event`;
--> statement-breakpoint
DROP TABLE IF EXISTS `github_revalidation_signal`;
--> statement-breakpoint
DROP TABLE IF EXISTS `github_cache_namespace`;
--> statement-breakpoint
DROP TABLE IF EXISTS `github_response_cache`;
