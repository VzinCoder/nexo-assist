CREATE TABLE `articles` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`tags` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`department` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ticket_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`ticket_id` text NOT NULL,
	`author_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_ticket_comments_ticket_id_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_ticket_comments_author_id_employees_id_fk` FOREIGN KEY (`author_id`) REFERENCES `employees`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`affected` text NOT NULL,
	`employee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`resolved_at` integer,
	`due_at` integer NOT NULL,
	CONSTRAINT `fk_tickets_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
);
--> statement-breakpoint
CREATE INDEX `ticket_comments_ticket_id_idx` ON `ticket_comments` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `tickets_employee_id_idx` ON `tickets` (`employee_id`);