CREATE TYPE "public"."action_status" AS ENUM('Pending', 'Done', 'Skipped');--> statement-breakpoint
CREATE TYPE "public"."complaint_category" AS ENUM('Product', 'Packaging', 'Trade');--> statement-breakpoint
CREATE TYPE "public"."complaint_source" AS ENUM('email', 'call', 'direct');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('New', 'Triaged', 'InProgress', 'WaitingCustomer', 'Resolved', 'Closed', 'TriageFailed');--> statement-breakpoint
CREATE TYPE "public"."complaint_priority" AS ENUM('High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "public"."sla_event_type" AS ENUM('warning', 'breach', 'met');--> statement-breakpoint
CREATE TYPE "public"."sla_metric" AS ENUM('first_response', 'resolution');--> statement-breakpoint
CREATE TYPE "public"."triage_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "complaint_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"complaint_id" text NOT NULL,
	"action" text NOT NULL,
	"owner" text NOT NULL,
	"deadline_hours" integer NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"action_status" "action_status" DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "complaint_source" NOT NULL,
	"customer_name" text,
	"customer_contact" text,
	"content" text NOT NULL,
	"category" "complaint_category",
	"priority" "complaint_priority",
	"confidence" real,
	"summary" text,
	"reasoning" text,
	"status" "complaint_status" DEFAULT 'New' NOT NULL,
	"triage_status" "triage_status" DEFAULT 'pending' NOT NULL,
	"first_response_due_at" timestamp with time zone,
	"resolution_due_at" timestamp with time zone,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_events" (
	"id" text PRIMARY KEY NOT NULL,
	"complaint_id" text NOT NULL,
	"event_type" "sla_event_type" NOT NULL,
	"metric" "sla_metric" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"complaint_id" text NOT NULL,
	"from_status" "complaint_status",
	"to_status" "complaint_status" NOT NULL,
	"note" text,
	"changed_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"complaint_id" text NOT NULL,
	"model" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"prompt_version" text NOT NULL,
	"raw_output" jsonb NOT NULL,
	"parse_ok" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "complaint_actions" ADD CONSTRAINT "complaint_actions_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_events_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_runs" ADD CONSTRAINT "triage_runs_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "complaint_actions_complaint_id_idx" ON "complaint_actions" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "complaint_actions_due_at_idx" ON "complaint_actions" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "complaints_status_idx" ON "complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "complaints_priority_idx" ON "complaints" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "complaints_category_idx" ON "complaints" USING btree ("category");--> statement-breakpoint
CREATE INDEX "complaints_created_at_idx" ON "complaints" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "complaints_resolution_due_at_idx" ON "complaints" USING btree ("resolution_due_at");--> statement-breakpoint
CREATE INDEX "sla_events_complaint_id_idx" ON "sla_events" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "sla_events_metric_idx" ON "sla_events" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "sla_events_event_type_idx" ON "sla_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_events_unique_idx" ON "sla_events" USING btree ("complaint_id","metric","event_type");--> statement-breakpoint
CREATE INDEX "status_history_complaint_id_idx" ON "status_history" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "status_history_created_at_idx" ON "status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "triage_runs_complaint_id_idx" ON "triage_runs" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "triage_runs_created_at_idx" ON "triage_runs" USING btree ("created_at");