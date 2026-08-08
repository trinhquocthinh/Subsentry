PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`alert_type` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`triggered_at` text,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`response` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_type_check" CHECK("__new_alerts"."alert_type" IN ('SOFT_T3', 'RED_T24')),
	CONSTRAINT "alert_status_check" CHECK("__new_alerts"."status" IN ('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED')),
	CONSTRAINT "alert_response_check" CHECK("__new_alerts"."response" IN ('PENDING', 'KEEP', 'KILL'))
);
--> statement-breakpoint
INSERT INTO `__new_alerts`("id", "subscription_id", "alert_type", "scheduled_at", "triggered_at", "status", "response", "created_at") SELECT "id", "subscription_id", "alert_type", "scheduled_at", "triggered_at", "status", "response", "created_at" FROM `alerts`;--> statement-breakpoint
DROP TABLE `alerts`;--> statement-breakpoint
ALTER TABLE `__new_alerts` RENAME TO `alerts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zalo_user_id` text,
	`telegram_chat_id` text,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "role_check" CHECK("__new_members"."role" IN ('ADMIN', 'SUBSCRIBER', 'CARD_OWNER'))
);
--> statement-breakpoint
INSERT INTO `__new_members`("id", "zalo_user_id", "telegram_chat_id", "display_name", "role", "created_at") SELECT "id", "zalo_user_id", "telegram_chat_id", "display_name", "role", "created_at" FROM `members`;--> statement-breakpoint
DROP TABLE `members`;--> statement-breakpoint
ALTER TABLE `__new_members` RENAME TO `members`;--> statement-breakpoint
CREATE UNIQUE INDEX `members_zalo_user_id_unique` ON `members` (`zalo_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_telegram_chat_id_unique` ON `members` (`telegram_chat_id`);--> statement-breakpoint
CREATE TABLE `__new_parsing_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`sender_id` text NOT NULL,
	`raw_content` text NOT NULL,
	`parsed_json` text,
	`confidence_score` real DEFAULT 0,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "source_check" CHECK("__new_parsing_logs"."source" IN ('EMAIL', 'CHAT_ZALO', 'CHAT_TG')),
	CONSTRAINT "log_status_check" CHECK("__new_parsing_logs"."status" IN ('SUCCESS', 'LOW_CONFIDENCE', 'FAILED'))
);
--> statement-breakpoint
INSERT INTO `__new_parsing_logs`("id", "source", "sender_id", "raw_content", "parsed_json", "confidence_score", "status", "created_at") SELECT "id", "source", "sender_id", "raw_content", "parsed_json", "confidence_score", "status", "created_at" FROM `parsing_logs`;--> statement-breakpoint
DROP TABLE `parsing_logs`;--> statement-breakpoint
ALTER TABLE `__new_parsing_logs` RENAME TO `parsing_logs`;--> statement-breakpoint
CREATE TABLE `__new_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`merchant_name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'VND' NOT NULL,
	`subscriber_id` integer NOT NULL,
	`payment_card_id` integer,
	`status` text NOT NULL,
	`billing_cycle` text NOT NULL,
	`next_billing_date` text NOT NULL,
	`confidence_score` real NOT NULL,
	`direct_kill_link` text,
	`is_must_keep` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_card_id`) REFERENCES `payment_cards`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "status_check" CHECK("__new_subscriptions"."status" IN ('TRIAL', 'ACTIVE', 'PENDING_KILL', 'KILLED')),
	CONSTRAINT "billing_cycle_check" CHECK("__new_subscriptions"."billing_cycle" IN ('WEEKLY', 'MONTHLY', 'YEARLY'))
);
--> statement-breakpoint
INSERT INTO `__new_subscriptions`("id", "merchant_name", "amount", "currency", "subscriber_id", "payment_card_id", "status", "billing_cycle", "next_billing_date", "confidence_score", "direct_kill_link", "is_must_keep", "created_at", "updated_at") SELECT "id", "merchant_name", "amount", "currency", "subscriber_id", "payment_card_id", "status", "billing_cycle", "next_billing_date", "confidence_score", "direct_kill_link", "is_must_keep", "created_at", "updated_at" FROM `subscriptions`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_subscriptions` RENAME TO `subscriptions`;