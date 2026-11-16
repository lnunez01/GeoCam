CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`position` integer NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_idx` ON `chat_messages` (`owner_id`,`conversation_id`,`position`);--> statement-breakpoint
ALTER TABLE `photos` ADD `ai_description` text;