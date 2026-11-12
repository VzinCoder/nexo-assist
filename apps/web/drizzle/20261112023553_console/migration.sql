ALTER TABLE `conversations` ADD `employeeName` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `analystId` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `analystName` text;--> statement-breakpoint
CREATE INDEX `conversations_status_updated_idx` ON `conversations` (`status`,`updatedAt`);