CREATE TYPE "public"."attachment_scan_status" AS ENUM('pending', 'clean', 'infected');--> statement-breakpoint
CREATE TYPE "public"."attachment_storage_driver" AS ENUM('local', 's3');--> statement-breakpoint
ALTER TABLE "ticket_attachments" ALTER COLUMN "storage_key" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD COLUMN "storage_driver" "attachment_storage_driver" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD COLUMN "scan_status" "attachment_scan_status" DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD COLUMN "scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD COLUMN "checksum_sha256" varchar(64);--> statement-breakpoint