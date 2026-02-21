ALTER TABLE `offers` ADD `partial` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `partial_threshold` real DEFAULT 0 NOT NULL;