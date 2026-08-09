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
ALTER TABLE `members` ADD `email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);