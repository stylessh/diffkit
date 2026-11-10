-- void:allow-destructive
-- The change feed keeps one row per entity instead of one per webhook. In
-- production 94% of rows repeated an entity already in the 15-minute window,
-- and every row was written three times on insert and three times on delete
-- (table plus two indexes). The old rows are a 15-minute window of signals,
-- so dropping them only makes open tabs refetch their active queries once.
DROP TABLE IF EXISTS `github_change`;
--> statement-breakpoint
CREATE TABLE `github_change` (
	`repo` text NOT NULL,
	`entity_key` text NOT NULL,
	`is_private` integer DEFAULT 1 NOT NULL,
	`version` integer NOT NULL,
	`changed_at` integer NOT NULL,
	PRIMARY KEY (`repo`, `entity_key`)
);
--> statement-breakpoint
CREATE INDEX `github_change_version_idx` ON `github_change` (`version`);
