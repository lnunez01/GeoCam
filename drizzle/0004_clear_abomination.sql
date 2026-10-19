ALTER TABLE `photos` ADD `owner_id` text;--> statement-breakpoint
CREATE INDEX `photos_owner_id_idx` ON `photos` (`owner_id`);