CREATE TABLE `search_repo_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`default_branch` text NOT NULL,
	`is_enabled` integer NOT NULL,
	`tier` text NOT NULL,
	`last_seen_head_sha` text,
	`last_indexed_head_sha` text,
	`last_synced_at` integer,
	`last_indexed_at` integer,
	`status` text NOT NULL,
	`is_private` integer NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_repo_registry_provider_owner_name_uidx` ON `search_repo_registry` (`provider`,`owner`,`name`);
--> statement-breakpoint
CREATE INDEX `search_repo_registry_status_idx` ON `search_repo_registry` (`status`);
--> statement-breakpoint
CREATE INDEX `search_repo_registry_tier_status_idx` ON `search_repo_registry` (`tier`,`status`);
--> statement-breakpoint
CREATE INDEX `search_repo_registry_enabled_tier_idx` ON `search_repo_registry` (`is_enabled`,`tier`);
--> statement-breakpoint
CREATE TABLE `search_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_id` text NOT NULL,
	`job_type` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`attempt` integer NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `search_repo_registry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_jobs_repo_type_status_idx` ON `search_jobs` (`repo_id`,`job_type`,`status`);
--> statement-breakpoint
CREATE INDEX `search_jobs_status_created_idx` ON `search_jobs` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `search_index_builds` (
	`id` text PRIMARY KEY NOT NULL,
	`build_version` text NOT NULL,
	`repo_count` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`manifest_r2_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_index_builds_build_version_uidx` ON `search_index_builds` (`build_version`);
--> statement-breakpoint
CREATE INDEX `search_index_builds_status_started_idx` ON `search_index_builds` (`status`,`started_at`);
