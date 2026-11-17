CREATE TABLE `password_links` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_links_token_hash_unique` ON `password_links` (`token_hash`);