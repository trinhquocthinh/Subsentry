CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`alert_type` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`triggered_at` text,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`response` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zalo_user_id` text,
	`telegram_chat_id` text,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_zalo_user_id_unique` ON `members` (`zalo_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_telegram_chat_id_unique` ON `members` (`telegram_chat_id`);--> statement-breakpoint
CREATE TABLE `parsing_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`sender_id` text NOT NULL,
	`raw_content` text NOT NULL,
	`parsed_json` text,
	`confidence_score` real DEFAULT 0,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_label` text NOT NULL,
	`card_owner_id` integer NOT NULL,
	`last_four` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`card_owner_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
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
	FOREIGN KEY (`payment_card_id`) REFERENCES `payment_cards`(`id`) ON UPDATE no action ON DELETE set null
);
