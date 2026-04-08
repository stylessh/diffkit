CREATE TABLE `github_response_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource` text NOT NULL,
	`params_json` text NOT NULL,
	`etag` text,
	`last_modified` text,
	`payload_json` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`fresh_until` integer NOT NULL,
	`rate_limit_remaining` integer,
	`rate_limit_reset` integer,
	`status_code` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `github_response_cache_user_resource_idx` ON `github_response_cache` (`user_id`,`resource`);