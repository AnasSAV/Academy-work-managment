CREATE TABLE `activity_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_id` integer NOT NULL,
	`key` text,
	`label` text NOT NULL,
	`weight` real DEFAULT 0 NOT NULL,
	`tracks_counts` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "activity_type_weight_ck" CHECK("activity_type"."weight" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_type_module_label_uq` ON `activity_type` (`module_id`,`label`);--> statement-breakpoint
CREATE TABLE `assessment_tag` (
	`assessment_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`assessment_id`, `tag_id`),
	FOREIGN KEY (`assessment_id`) REFERENCES `assessment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assessment_tag_tag_idx` ON `assessment_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `assessment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_id` integer NOT NULL,
	`name` text NOT NULL,
	`lecturer` text,
	`weight` real DEFAULT 0 NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`score` real,
	`max_score` real DEFAULT 100 NOT NULL,
	`work_mode` text DEFAULT 'unspecified' NOT NULL,
	`group_size` integer,
	`group_members` text,
	`notes` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "assessment_weight_ck" CHECK("assessment"."weight" BETWEEN 0 AND 100),
	CONSTRAINT "assessment_max_score_ck" CHECK("assessment"."max_score" > 0)
);
--> statement-breakpoint
CREATE INDEX `assessment_module_idx` ON `assessment` (`module_id`,`position`);--> statement-breakpoint
CREATE TABLE `attachment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` integer NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`path` text NOT NULL,
	`original_name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachment_owner_idx` ON `attachment` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `chapter_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`activity_type_id` integer NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`count_done` integer,
	`count_total` integer,
	`revision_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_type_id`) REFERENCES `activity_type`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chapter_activity_counts_ck" CHECK("chapter_activity"."count_done" IS NULL OR "chapter_activity"."count_done" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_activity_uq` ON `chapter_activity` (`chapter_id`,`activity_type_id`);--> statement-breakpoint
CREATE TABLE `chapter` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_id` integer NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`confidence` integer,
	`last_reviewed_at` text,
	`note` text,
	`onenote_url` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chapter_confidence_ck" CHECK("chapter"."confidence" IS NULL OR "chapter"."confidence" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX `chapter_module_idx` ON `chapter` (`module_id`,`position`);--> statement-breakpoint
CREATE TABLE `module` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`semester_id` integer NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`credits` real,
	`lecturers` text,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`target_grade` real,
	`exam_date` text,
	`notes` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `module_semester_idx` ON `module` (`semester_id`,`position`);--> statement-breakpoint
CREATE TABLE `past_paper` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_id` integer NOT NULL,
	`year` integer,
	`title` text NOT NULL,
	`attempted` integer DEFAULT false NOT NULL,
	`score` real,
	`max_score` real,
	`minutes_taken` integer,
	`attempted_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `past_paper_module_idx` ON `past_paper` (`module_id`);--> statement-breakpoint
CREATE TABLE `semester` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_id` integer NOT NULL,
	`chapter_id` integer,
	`minutes` integer NOT NULL,
	`date` text NOT NULL,
	`note` text,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "study_log_minutes_ck" CHECK("study_log"."minutes" > 0)
);
--> statement-breakpoint
CREATE INDEX `study_log_module_date_idx` ON `study_log` (`module_id`,`date`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_module_name_uq` ON `tag` (`module_id`,`name`);