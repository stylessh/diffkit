CREATE TABLE `user_forbidden_org` (
	`user_id` text NOT NULL,
	`org` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `org`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
