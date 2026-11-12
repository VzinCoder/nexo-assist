CREATE TABLE `conversations` (
	`id` text PRIMARY KEY,
	`employeeId` text NOT NULL,
	`status` text NOT NULL,
	`handoffReason` text,
	`handoffSummary` text,
	`userMessageCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY,
	`conversationId` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`ticketId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_drafts_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY,
	`conversationId` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`parts` text NOT NULL,
	`trace` text NOT NULL,
	`decision` text,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`)
);
--> statement-breakpoint
CREATE INDEX `conversations_employee_created_idx` ON `conversations` (`employeeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `drafts_conversation_idx` ON `drafts` (`conversationId`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversationId`,`createdAt`);