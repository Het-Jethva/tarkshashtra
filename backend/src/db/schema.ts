import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const complaintSourceEnum = pgEnum("complaint_source", ["email", "call", "direct"]);
export const complaintCategoryEnum = pgEnum("complaint_category", [
  "Product",
  "Packaging",
  "Trade",
]);
export const sentimentEnum = pgEnum("complaint_sentiment", [
  "Angry",
  "Frustrated",
  "Neutral",
  "Satisfied",
]);
export const priorityEnum = pgEnum("complaint_priority", ["High", "Medium", "Low"]);
export const complaintStatusEnum = pgEnum("complaint_status", [
  "New",
  "Triaged",
  "InProgress",
  "WaitingCustomer",
  "Resolved",
  "Closed",
  "TriageFailed",
]);
export const triageStatusEnum = pgEnum("triage_status", ["pending", "success", "failed"]);
export const actionStatusEnum = pgEnum("action_status", ["Pending", "Done", "Skipped"]);
export const slaEventTypeEnum = pgEnum("sla_event_type", ["warning", "breach", "met"]);
export const slaMetricEnum = pgEnum("sla_metric", ["first_response", "resolution"]);
export const overrideFieldEnum = pgEnum("override_field", ["category", "priority"]);

export type TriageRawOutput = {
  category: "Product" | "Packaging" | "Trade";
  priority: "High" | "Medium" | "Low";
  confidence: number;
  sentiment: "Angry" | "Frustrated" | "Neutral" | "Satisfied";
  sentiment_score: number;
  keywords: string[];
  priority_reason: string;
  summary: string;
  reasoning: string;
  urgency_signals: string[];
  impact_signals: string[];
  recommended_actions: Array<{
    action: string;
    owner: string;
    deadline_hours: number;
  }>;
};

export const complaints = pgTable(
  "complaints",
  {
    id: text("id").primaryKey(),
    source: complaintSourceEnum("source").notNull(),
    assignedTo: text("assigned_to"),
    customerName: text("customer_name"),
    customerNameNormalized: text("customer_name_normalized"),
    customerContact: text("customer_contact"),
    customerContactNormalized: text("customer_contact_normalized"),
    content: text("content").notNull(),
    category: complaintCategoryEnum("category"),
    priority: priorityEnum("priority"),
    confidence: real("confidence"),
    sentiment: sentimentEnum("sentiment"),
    sentimentScore: integer("sentiment_score"),
    keywords: jsonb("keywords").$type<string[]>(),
    priorityReason: text("priority_reason"),
    summary: text("summary"),
    reasoning: text("reasoning"),
    duplicateOfComplaintId: text("duplicate_of_complaint_id"),
    duplicateScore: real("duplicate_score"),
    isRepeatComplainant: boolean("is_repeat_complainant").notNull().default(false),
    repeatCount7d: integer("repeat_count_7d").notNull().default(0),
    aiHelpful: boolean("ai_helpful"),
    aiHelpfulAt: timestamp("ai_helpful_at", { withTimezone: true, mode: "date" }),
    qaVerifiedCategory: complaintCategoryEnum("qa_verified_category"),
    qaReviewedBy: text("qa_reviewed_by"),
    qaReviewedAt: timestamp("qa_reviewed_at", { withTimezone: true, mode: "date" }),
    needsRetraining: boolean("needs_retraining").notNull().default(false),
    managerOverridden: boolean("manager_overridden").notNull().default(false),
    managerOverrideReason: text("manager_override_reason"),
    status: complaintStatusEnum("status").notNull().default("New"),
    triageStatus: triageStatusEnum("triage_status").notNull().default("pending"),
    firstResponseDueAt: timestamp("first_response_due_at", { withTimezone: true, mode: "date" }),
    resolutionDueAt: timestamp("resolution_due_at", { withTimezone: true, mode: "date" }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true, mode: "date" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("complaints_status_idx").on(table.status),
    priorityIdx: index("complaints_priority_idx").on(table.priority),
    categoryIdx: index("complaints_category_idx").on(table.category),
    sentimentIdx: index("complaints_sentiment_idx").on(table.sentiment),
    needsRetrainingIdx: index("complaints_needs_retraining_idx").on(table.needsRetraining),
    assignedToIdx: index("complaints_assigned_to_idx").on(table.assignedTo),
    customerContactNormalizedIdx: index("complaints_customer_contact_normalized_idx").on(
      table.customerContactNormalized,
    ),
    customerNameNormalizedIdx: index("complaints_customer_name_normalized_idx").on(
      table.customerNameNormalized,
    ),
    createdAtIdx: index("complaints_created_at_idx").on(table.createdAt),
    resolutionDueAtIdx: index("complaints_resolution_due_at_idx").on(table.resolutionDueAt),
  }),
);

export const complaintOverrides = pgTable(
  "complaint_overrides",
  {
    id: text("id").primaryKey(),
    complaintId: text("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "cascade" }),
    field: overrideFieldEnum("field").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value").notNull(),
    reason: text("reason").notNull(),
    changedBy: text("changed_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    complaintIdIdx: index("complaint_overrides_complaint_id_idx").on(table.complaintId),
    createdAtIdx: index("complaint_overrides_created_at_idx").on(table.createdAt),
  }),
);

export const complaintActions = pgTable(
  "complaint_actions",
  {
    id: text("id").primaryKey(),
    complaintId: text("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    owner: text("owner").notNull(),
    deadlineHours: integer("deadline_hours").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
    actionStatus: actionStatusEnum("action_status").notNull().default("Pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    complaintIdIdx: index("complaint_actions_complaint_id_idx").on(table.complaintId),
    dueAtIdx: index("complaint_actions_due_at_idx").on(table.dueAt),
  }),
);

export const statusHistory = pgTable(
  "status_history",
  {
    id: text("id").primaryKey(),
    complaintId: text("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "cascade" }),
    fromStatus: complaintStatusEnum("from_status"),
    toStatus: complaintStatusEnum("to_status").notNull(),
    note: text("note"),
    changedBy: text("changed_by").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    complaintIdIdx: index("status_history_complaint_id_idx").on(table.complaintId),
    createdAtIdx: index("status_history_created_at_idx").on(table.createdAt),
  }),
);

export const triageRuns = pgTable(
  "triage_runs",
  {
    id: text("id").primaryKey(),
    complaintId: text("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    promptVersion: text("prompt_version").notNull(),
    rawOutput: jsonb("raw_output").$type<unknown>().notNull(),
    parseOk: boolean("parse_ok").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    complaintIdIdx: index("triage_runs_complaint_id_idx").on(table.complaintId),
    createdAtIdx: index("triage_runs_created_at_idx").on(table.createdAt),
  }),
);

export const slaEvents = pgTable(
  "sla_events",
  {
    id: text("id").primaryKey(),
    complaintId: text("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "cascade" }),
    eventType: slaEventTypeEnum("event_type").notNull(),
    metric: slaMetricEnum("metric").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    complaintIdIdx: index("sla_events_complaint_id_idx").on(table.complaintId),
    metricIdx: index("sla_events_metric_idx").on(table.metric),
    eventTypeIdx: index("sla_events_event_type_idx").on(table.eventType),
    uniqueEventConstraint: uniqueIndex("sla_events_unique_idx").on(
      table.complaintId,
      table.metric,
      table.eventType,
    ),
  }),
);
