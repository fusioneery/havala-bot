CREATE TABLE `exchange_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_offer_id` integer NOT NULL,
	`matched_offer_id` integer NOT NULL,
	`match_id` integer NOT NULL,
	`initiator_user_id` integer NOT NULL,
	`counterparty_user_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`from_currency` text NOT NULL,
	`to_currency` text NOT NULL,
	`amount` real NOT NULL,
	`converted_amount` real,
	`exchange_rate` real,
	`success` integer NOT NULL,
	`error_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_offer_id`) REFERENCES `user_offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`initiator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counterparty_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `trusted_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `exchange_history_initiator_idx` ON `exchange_history` (`initiator_user_id`);--> statement-breakpoint
CREATE INDEX `exchange_history_counterparty_idx` ON `exchange_history` (`counterparty_user_id`);--> statement-breakpoint
CREATE INDEX `exchange_history_group_idx` ON `exchange_history` (`group_id`);