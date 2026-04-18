import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  complaintActions,
  complaintOverrides,
  complaints,
  slaEvents,
  statusHistory,
  triageRuns,
} from "../../db/schema.js";
import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  SlaEventType,
  SlaMetric,
} from "../../db/types.js";
import { createId } from "../../lib/id.js";
import { AppError } from "../../lib/errors.js";
import type {
  ComplaintOverrideInput,
  CreateComplaintInput,
  ListComplaintsQueryInput,
  ComplaintAiFeedbackInput,
  UpdateComplaintStatusInput,
} from "./complaints.schemas.js";
import type { TriageInvocationResult, TriageResponse } from "../triage/triage.types.js";

export type ComplaintRecord = InferSelectModel<typeof complaints>;
export type ComplaintActionRecord = InferSelectModel<typeof complaintActions>;
export type StatusHistoryRecord = InferSelectModel<typeof statusHistory>;
export type TriageRunRecord = InferSelectModel<typeof triageRuns>;
export type SlaEventRecord = InferSelectModel<typeof slaEvents>;
export type ComplaintOverrideRecord = InferSelectModel<typeof complaintOverrides>;

type ListResult = {
  items: ComplaintRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type ComplaintDetails = {
  complaint: ComplaintRecord;
  actions: ComplaintActionRecord[];
  history: StatusHistoryRecord[];
  triageRuns: TriageRunRecord[];
  slaEvents: SlaEventRecord[];
  overrides: ComplaintOverrideRecord[];
};

function buildListWhereClause(filters: ListComplaintsQueryInput): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];

  if (filters.source) {
    conditions.push(eq(complaints.source, filters.source));
  }
  if (filters.category) {
    conditions.push(eq(complaints.category, filters.category));
  }
  if (filters.priority) {
    conditions.push(eq(complaints.priority, filters.priority));
  }
  if (filters.sentiment) {
    conditions.push(eq(complaints.sentiment, filters.sentiment));
  }
  if (filters.assignedTo) {
    conditions.push(ilike(complaints.assignedTo, `%${filters.assignedTo}%`));
  }
  if (typeof filters.confidenceLte === "number") {
    conditions.push(lte(complaints.confidence, filters.confidenceLte));
  }
  if (typeof filters.confidenceGte === "number") {
    conditions.push(gte(complaints.confidence, filters.confidenceGte));
  }
  if (filters.duplicateOnly === true) {
    conditions.push(isNotNull(complaints.duplicateOfComplaintId));
  }
  if (filters.repeatOnly === true) {
    conditions.push(eq(complaints.isRepeatComplainant, true));
  }
  if (filters.status) {
    conditions.push(eq(complaints.status, filters.status));
  }
  if (filters.triageStatus) {
    conditions.push(eq(complaints.triageStatus, filters.triageStatus));
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(
      sql`(${complaints.content} ILIKE ${searchPattern} OR ${complaints.summary} ILIKE ${searchPattern})`,
    );
  }
  if (filters.from) {
    conditions.push(gte(complaints.createdAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(complaints.createdAt, filters.to));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return and(...conditions);
}

class ComplaintsRepository {
  normalizePersonName(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
    return normalized.length > 0 ? normalized : null;
  }

  normalizeCustomerContact(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const compact = value.trim().toLowerCase();
    if (!compact) {
      return null;
    }

    const digits = compact.replace(/[^0-9]/g, "");
    if (digits.length >= 7) {
      return digits;
    }

    return compact.replace(/\s+/g, "");
  }

  async getRecentComplaintsByCustomer(params: {
    customerNameNormalized?: string | null;
    customerContactNormalized?: string | null;
    lookbackStart: Date;
  }): Promise<ComplaintRecord[]> {
    const identityClauses: SQL<unknown>[] = [];

    if (params.customerContactNormalized) {
      identityClauses.push(
        eq(complaints.customerContactNormalized, params.customerContactNormalized),
      );
    }

    if (params.customerNameNormalized) {
      identityClauses.push(eq(complaints.customerNameNormalized, params.customerNameNormalized));
    }

    if (identityClauses.length === 0) {
      return [];
    }

    return db
      .select()
      .from(complaints)
      .where(and(gte(complaints.createdAt, params.lookbackStart), or(...identityClauses)))
      .orderBy(desc(complaints.createdAt));
  }

  async findDuplicateCandidates(params: {
    complaintId: string;
    customerContactNormalized?: string | null;
    customerNameNormalized?: string | null;
    content: string;
    lookbackStart: Date;
    limit: number;
  }): Promise<ComplaintRecord[]> {
    const identityClauses: SQL<unknown>[] = [];
    if (params.customerContactNormalized) {
      identityClauses.push(
        eq(complaints.customerContactNormalized, params.customerContactNormalized),
      );
    }
    if (params.customerNameNormalized) {
      identityClauses.push(eq(complaints.customerNameNormalized, params.customerNameNormalized));
    }

    const contentSnippet = params.content.trim().slice(0, 120);
    const contentClause = contentSnippet
      ? ilike(complaints.content, `%${contentSnippet.replace(/\s+/g, "%")}%`)
      : undefined;

    const duplicateClauses = [...identityClauses, ...(contentClause ? [contentClause] : [])];
    if (duplicateClauses.length === 0) {
      return [];
    }

    const candidateWhere = and(
      gte(complaints.createdAt, params.lookbackStart),
      ne(complaints.id, params.complaintId),
      or(...duplicateClauses),
    );

    return db
      .select()
      .from(complaints)
      .where(candidateWhere)
      .orderBy(desc(complaints.createdAt))
      .limit(params.limit);
  }

  async createComplaint(input: CreateComplaintInput, createdBy: string): Promise<ComplaintRecord> {
    const now = new Date();
    const customerNameNormalized = this.normalizePersonName(input.customerName ?? null);
    const customerContactNormalized = this.normalizeCustomerContact(input.customerContact ?? null);
    const [created] = await db
      .insert(complaints)
      .values({
        id: createId("cmp"),
        source: input.source,
        assignedTo: createdBy,
        customerName: input.customerName ?? null,
        customerNameNormalized,
        customerContact: input.customerContact ?? null,
        customerContactNormalized,
        content: input.content,
        status: "New",
        triageStatus: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw new AppError("Failed to create complaint", 500, "CREATE_COMPLAINT_FAILED");
    }

    await this.insertStatusHistory({
      complaintId: created.id,
      fromStatus: null,
      toStatus: "New",
      changedBy: createdBy,
      note: "Complaint submitted",
    });

    return created;
  }

  async getComplaintById(complaintId: string): Promise<ComplaintRecord | undefined> {
    return db.query.complaints.findFirst({
      where: eq(complaints.id, complaintId),
    });
  }

  async getComplaintDetails(complaintId: string): Promise<ComplaintDetails | undefined> {
    const complaint = await this.getComplaintById(complaintId);
    if (!complaint) {
      return undefined;
    }

    const [actions, history, triageRunsList, slaEventsList, overrideList] = await Promise.all([
      db
        .select()
        .from(complaintActions)
        .where(eq(complaintActions.complaintId, complaintId))
        .orderBy(asc(complaintActions.createdAt)),
      db
        .select()
        .from(statusHistory)
        .where(eq(statusHistory.complaintId, complaintId))
        .orderBy(desc(statusHistory.createdAt)),
      db
        .select()
        .from(triageRuns)
        .where(eq(triageRuns.complaintId, complaintId))
        .orderBy(desc(triageRuns.createdAt)),
      db
        .select()
        .from(slaEvents)
        .where(eq(slaEvents.complaintId, complaintId))
        .orderBy(desc(slaEvents.createdAt)),
      db
        .select()
        .from(complaintOverrides)
        .where(eq(complaintOverrides.complaintId, complaintId))
        .orderBy(desc(complaintOverrides.createdAt)),
    ]);

    return {
      complaint,
      actions,
      history,
      triageRuns: triageRunsList,
      slaEvents: slaEventsList,
      overrides: overrideList,
    };
  }

  async listComplaints(filters: ListComplaintsQueryInput): Promise<ListResult> {
    const whereClause = buildListWhereClause(filters);
    const offset = (filters.page - 1) * filters.pageSize;

    const itemsQuery = db
      .select()
      .from(complaints)
      .orderBy(desc(complaints.createdAt))
      .limit(filters.pageSize)
      .offset(offset);

    const countQuery = db.select({ total: sql<number>`count(*)::int` }).from(complaints);

    const [items, totalResult] = await Promise.all([
      whereClause ? itemsQuery.where(whereClause) : itemsQuery,
      whereClause ? countQuery.where(whereClause) : countQuery,
    ]);

    return {
      items,
      total: totalResult[0]?.total ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async saveTriageSuccess(params: {
    complaint: ComplaintRecord;
    triage: TriageResponse;
    triageResult: TriageInvocationResult;
    promptVersion: string;
    isRepeatComplainant: boolean;
    repeatCount7d: number;
    duplicateOfComplaintId?: string | null;
    duplicateScore?: number | null;
  }): Promise<void> {
    const now = new Date();
    const firstResponseDueAt = params.complaint.firstResponseDueAt;
    const resolutionDueAt = params.complaint.resolutionDueAt;

    await db.transaction(async (tx) => {
      await tx
        .update(complaints)
        .set({
          category: params.triage.category,
          priority: params.triage.priority,
          confidence: params.triage.confidence,
          sentiment: params.triage.sentiment,
          sentimentScore: params.triage.sentiment_score,
          keywords: params.triage.keywords,
          priorityReason: params.triage.priority_reason,
          summary: params.triage.summary,
          reasoning: params.triage.reasoning,
          isRepeatComplainant: params.isRepeatComplainant,
          repeatCount7d: params.repeatCount7d,
          duplicateOfComplaintId: params.duplicateOfComplaintId ?? null,
          duplicateScore: params.duplicateScore ?? null,
          status: "Triaged",
          triageStatus: "success",
          firstResponseDueAt,
          resolutionDueAt,
          updatedAt: now,
        })
        .where(eq(complaints.id, params.complaint.id));

      await tx.insert(triageRuns).values({
        id: createId("tri"),
        complaintId: params.complaint.id,
        model: params.triageResult.model,
        latencyMs: params.triageResult.latencyMs,
        promptVersion: params.promptVersion,
        rawOutput: params.triageResult.rawOutput,
        parseOk: true,
        error: null,
        createdAt: now,
      });

      await tx.delete(complaintActions).where(eq(complaintActions.complaintId, params.complaint.id));

      if (params.triage.recommended_actions.length > 0) {
        const rows: InferInsertModel<typeof complaintActions>[] =
          params.triage.recommended_actions.map((item) => ({
            id: createId("act"),
            complaintId: params.complaint.id,
            action: item.action,
            owner: item.owner,
            deadlineHours: item.deadline_hours,
            dueAt: new Date(now.getTime() + item.deadline_hours * 60 * 60 * 1000),
            actionStatus: "Pending",
            createdAt: now,
            updatedAt: now,
          }));

        await tx.insert(complaintActions).values(rows);
      }
    });
  }

  async saveTriageFailure(params: {
    complaintId: string;
    triageResult: TriageInvocationResult;
    promptVersion: string;
  }): Promise<void> {
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(complaints)
        .set({
          status: "TriageFailed",
          triageStatus: "failed",
          updatedAt: now,
        })
        .where(eq(complaints.id, params.complaintId));

      await tx.insert(triageRuns).values({
        id: createId("tri"),
        complaintId: params.complaintId,
        model: params.triageResult.model,
        latencyMs: params.triageResult.latencyMs,
        promptVersion: params.promptVersion,
        rawOutput: params.triageResult.rawOutput,
        parseOk: false,
        error: params.triageResult.ok ? null : params.triageResult.errorMessage,
        createdAt: now,
      });
    });
  }

  async updateComplaintStatus(
    complaintId: string,
    input: UpdateComplaintStatusInput,
  ): Promise<ComplaintRecord | undefined> {
    const now = new Date();

    const [updated] = await db
      .update(complaints)
      .set({
        status: input.status,
        updatedAt: now,
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    return updated;
  }

  async updateSlaFields(
    complaintId: string,
    values: Pick<
      ComplaintRecord,
      "firstResponseAt" | "resolvedAt" | "firstResponseDueAt" | "resolutionDueAt"
    >,
  ): Promise<void> {
    await db
      .update(complaints)
      .set({
        firstResponseAt: values.firstResponseAt,
        resolvedAt: values.resolvedAt,
        firstResponseDueAt: values.firstResponseDueAt,
        resolutionDueAt: values.resolutionDueAt,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, complaintId));
  }

  async saveAiFeedback(complaintId: string, input: ComplaintAiFeedbackInput): Promise<ComplaintRecord | undefined> {
    const [updated] = await db
      .update(complaints)
      .set({
        aiHelpful: input.helpful,
        aiHelpfulAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    return updated;
  }

  async saveQaReview(params: {
    complaintId: string;
    verifiedCategory: ComplaintCategory;
    reviewedBy: string;
    needsRetraining: boolean;
  }): Promise<ComplaintRecord | undefined> {
    const [updated] = await db
      .update(complaints)
      .set({
        qaVerifiedCategory: params.verifiedCategory,
        qaReviewedBy: params.reviewedBy,
        qaReviewedAt: new Date(),
        needsRetraining: params.needsRetraining,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, params.complaintId))
      .returning();

    return updated;
  }

  async applyManagerOverride(params: {
    complaintId: string;
    input: ComplaintOverrideInput;
    changedBy: string;
  }): Promise<ComplaintRecord | undefined> {
    const existing = await this.getComplaintById(params.complaintId);
    if (!existing) {
      return undefined;
    }

    const now = new Date();
    const updates: Partial<InferInsertModel<typeof complaints>> = {
      managerOverridden: true,
      managerOverrideReason: params.input.reason,
      updatedAt: now,
    };

    const overrideRows: InferInsertModel<typeof complaintOverrides>[] = [];

    if (params.input.category && params.input.category !== existing.category) {
      updates.category = params.input.category;
      overrideRows.push({
        id: createId("ovr"),
        complaintId: params.complaintId,
        field: "category",
        fromValue: existing.category,
        toValue: params.input.category,
        reason: params.input.reason,
        changedBy: params.changedBy,
        createdAt: now,
      });
    }

    if (params.input.priority && params.input.priority !== existing.priority) {
      updates.priority = params.input.priority;
      overrideRows.push({
        id: createId("ovr"),
        complaintId: params.complaintId,
        field: "priority",
        fromValue: existing.priority,
        toValue: params.input.priority,
        reason: params.input.reason,
        changedBy: params.changedBy,
        createdAt: now,
      });
    }

    if (overrideRows.length === 0) {
      const [same] = await db
        .update(complaints)
        .set({
          managerOverridden: true,
          managerOverrideReason: params.input.reason,
          updatedAt: now,
        })
        .where(eq(complaints.id, params.complaintId))
        .returning();

      return same;
    }

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(complaints)
        .set(updates)
        .where(eq(complaints.id, params.complaintId))
        .returning();

      if (updated) {
        await tx.insert(complaintOverrides).values(overrideRows);
      }

      return updated;
    });
  }

  async insertStatusHistory(params: {
    complaintId: string;
    fromStatus: ComplaintStatus | null;
    toStatus: ComplaintStatus;
    note?: string | null;
    changedBy?: string;
  }): Promise<void> {
    await db.insert(statusHistory).values({
      id: createId("hst"),
      complaintId: params.complaintId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      note: params.note ?? null,
      changedBy: params.changedBy ?? "Support Executive",
      createdAt: new Date(),
    });
  }

  async insertSlaEvent(params: {
    complaintId: string;
    eventType: SlaEventType;
    metric: SlaMetric;
  }): Promise<boolean> {
    const inserted = await db
      .insert(slaEvents)
      .values({
        id: createId("sla"),
        complaintId: params.complaintId,
        eventType: params.eventType,
        metric: params.metric,
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [slaEvents.complaintId, slaEvents.metric, slaEvents.eventType],
      })
      .returning({ id: slaEvents.id });

    return inserted.length > 0;
  }

  async getOpenComplaintsForSlaScan(): Promise<ComplaintRecord[]> {
    return db
      .select()
      .from(complaints)
      .where(
        and(
          eq(complaints.triageStatus, "success"),
          inArray(complaints.status, ["Triaged", "InProgress", "WaitingCustomer"]),
        ),
      );
  }

  async fetchComplaintsForExport(params: {
    from?: Date;
    to?: Date;
    status?: ComplaintStatus;
    category?: ComplaintCategory;
    assignedTo?: string;
  }): Promise<ComplaintRecord[]> {
    const conditions: SQL<unknown>[] = [];

    if (params.from) {
      conditions.push(gte(complaints.createdAt, params.from));
    }
    if (params.to) {
      conditions.push(lte(complaints.createdAt, params.to));
    }
    if (params.status) {
      conditions.push(eq(complaints.status, params.status));
    }
    if (params.category) {
      conditions.push(eq(complaints.category, params.category));
    }
    if (params.assignedTo) {
      conditions.push(ilike(complaints.assignedTo, `%${params.assignedTo}%`));
    }

    return db
      .select()
      .from(complaints)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(complaints.createdAt));
  }

  async getOverdueComplaintCount(now = new Date()): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(complaints)
      .where(
        and(
          ne(complaints.status, "Closed"),
          sql`(
              (${complaints.firstResponseAt} is null and ${complaints.firstResponseDueAt} is not null and ${complaints.firstResponseDueAt} < ${now})
              or
              (${complaints.resolvedAt} is null and ${complaints.resolutionDueAt} is not null and ${complaints.resolutionDueAt} < ${now})
            )`,
        ),
      );

    return result[0]?.count ?? 0;
  }

  async getExportSummary(params: {
    from?: Date;
    to?: Date;
    status?: ComplaintStatus;
    category?: ComplaintCategory;
    assignedTo?: string;
  }): Promise<{
    total: number;
    slaCompliancePercent: number;
    byCategory: Array<{ key: string; count: number }>;
    byPriority: Array<{ key: string; count: number }>;
    lowConfidence: number;
    avgResolutionHours: number;
  }> {
    const conditions: SQL<unknown>[] = [];

    if (params.from) {
      conditions.push(gte(complaints.createdAt, params.from));
    }
    if (params.to) {
      conditions.push(lte(complaints.createdAt, params.to));
    }
    if (params.status) {
      conditions.push(eq(complaints.status, params.status));
    }
    if (params.category) {
      conditions.push(eq(complaints.category, params.category));
    }
    if (params.assignedTo) {
      conditions.push(ilike(complaints.assignedTo, `%${params.assignedTo}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totals, byCategory, byPriority] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          slaMet: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null and ${complaints.resolutionDueAt} is not null and ${complaints.resolvedAt} <= ${complaints.resolutionDueAt})::int`,
          resolved: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null)::int`,
          lowConfidence: sql<number>`count(*) filter (where ${complaints.confidence} < 0.6)::int`,
          avgResolutionHours: sql<number>`coalesce(avg(extract(epoch from (${complaints.resolvedAt} - ${complaints.createdAt})) / 3600) filter (where ${complaints.resolvedAt} is not null), 0)::float`,
        })
        .from(complaints)
        .where(whereClause),
      db
        .select({
          key: sql<string>`coalesce(cast(${complaints.category} as text), 'Untriaged')`,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .where(whereClause)
        .groupBy(sql`coalesce(cast(${complaints.category} as text), 'Untriaged')`),
      db
        .select({
          key: sql<string>`coalesce(cast(${complaints.priority} as text), 'Untriaged')`,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .where(whereClause)
        .groupBy(sql`coalesce(cast(${complaints.priority} as text), 'Untriaged')`),
    ]);

    const row = totals[0];
    const slaCompliancePercent =
      row && row.resolved > 0 ? Math.round((row.slaMet / row.resolved) * 100) : 0;

    return {
      total: row?.total ?? 0,
      slaCompliancePercent,
      byCategory,
      byPriority,
      lowConfidence: row?.lowConfidence ?? 0,
      avgResolutionHours: Number((row?.avgResolutionHours ?? 0).toFixed(2)),
    };
  }

  async getAgentPerformanceSummary(params: {
    from?: Date;
    to?: Date;
    status?: ComplaintStatus;
    category?: ComplaintCategory;
    assignedTo?: string;
  }): Promise<
    Array<{
      agentName: string;
      assignedCount: number;
      resolvedCount: number;
      slaMetPercent: number;
      avgResolutionHours: number;
      helpfulnessPercent: number;
    }>
  > {
    const conditions: SQL<unknown>[] = [];

    if (params.from) {
      conditions.push(gte(complaints.createdAt, params.from));
    }
    if (params.to) {
      conditions.push(lte(complaints.createdAt, params.to));
    }
    if (params.status) {
      conditions.push(eq(complaints.status, params.status));
    }
    if (params.category) {
      conditions.push(eq(complaints.category, params.category));
    }
    if (params.assignedTo) {
      conditions.push(ilike(complaints.assignedTo, `%${params.assignedTo}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        agentName: sql<string>`coalesce(${complaints.assignedTo}, 'Unassigned')`,
        assignedCount: sql<number>`count(*)::int`,
        resolvedCount: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null)::int`,
        slaMetCount: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null and ${complaints.resolutionDueAt} is not null and ${complaints.resolvedAt} <= ${complaints.resolutionDueAt})::int`,
        avgResolutionHours: sql<number>`coalesce(avg(extract(epoch from (${complaints.resolvedAt} - ${complaints.createdAt})) / 3600) filter (where ${complaints.resolvedAt} is not null), 0)::float`,
        helpfulVotes: sql<number>`count(*) filter (where ${complaints.aiHelpful} = true)::int`,
        feedbackCount: sql<number>`count(*) filter (where ${complaints.aiHelpful} is not null)::int`,
      })
      .from(complaints)
      .where(whereClause)
      .groupBy(sql`coalesce(${complaints.assignedTo}, 'Unassigned')`)
      .orderBy(sql`coalesce(${complaints.assignedTo}, 'Unassigned')`);

    return rows.map((row) => ({
      agentName: row.agentName,
      assignedCount: row.assignedCount,
      resolvedCount: row.resolvedCount,
      slaMetPercent: row.resolvedCount > 0 ? Math.round((row.slaMetCount / row.resolvedCount) * 100) : 0,
      avgResolutionHours: Number(row.avgResolutionHours.toFixed(2)),
      helpfulnessPercent: row.feedbackCount > 0 ? Math.round((row.helpfulVotes / row.feedbackCount) * 100) : 0,
    }));
  }
}

export const complaintsRepository = new ComplaintsRepository();
