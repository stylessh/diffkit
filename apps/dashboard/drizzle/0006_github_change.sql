-- Change feed (docs/data-fetching.md, L2). Bounded by design: the cron
-- sweeper deletes rows older than 15 minutes (src/lib/github-change.server.ts).
CREATE TABLE `github_change` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo` text NOT NULL,
	`entity_key` text NOT NULL,
	`is_private` integer DEFAULT 1 NOT NULL,
	`changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `github_change_repo_id_idx` ON `github_change` (`repo`, `id`);
--> statement-breakpoint
CREATE INDEX `github_change_changed_at_idx` ON `github_change` (`changed_at`);
