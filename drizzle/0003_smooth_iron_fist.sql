ALTER TABLE `photos` ADD `client_id` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `remote_path` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `synced_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `photos_client_id_unique` ON `photos` (`client_id`);