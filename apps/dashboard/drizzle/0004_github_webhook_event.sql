CREATE TABLE `github_webhook_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`delivery_id` text NOT NULL,
	`event` text NOT NULL,
	`signal_keys_json` text NOT NULL,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`error_message` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_webhook_event_delivery_id_unique` ON `github_webhook_event` (`delivery_id`);
--> statement-breakpoint
CREATE INDEX `github_webhook_event_received_at_idx` ON `github_webhook_event` (`received_at`);
