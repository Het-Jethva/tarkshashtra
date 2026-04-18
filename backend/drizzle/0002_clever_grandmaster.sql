ALTER TABLE "complaints" ADD COLUMN "qa_verified_category" "complaint_category";--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "qa_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "qa_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "needs_retraining" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "complaints_needs_retraining_idx" ON "complaints" USING btree ("needs_retraining");