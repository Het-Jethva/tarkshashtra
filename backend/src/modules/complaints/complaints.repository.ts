import { and, asc, desc, eq, gte, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  complaintActions,
  complaints,
  slaEvents,
  statusHistory,
  triageRuns,
} from "../../db/schema.js";
import type { ComplaintStatus, SlaEventType, SlaMetric } from "../../db/types.js";
import { createId } from "../../lib/id.js";
import { AppError } from "../../lib/errors.js";
import type {
  CreateComplaintInput,
  ListComplaintsQueryInput,
  UpdateComplaintStatusInput,
} from "./complaints.schemas.js";
import type { TriageInvocationResult, TriageResponse } from "../triage/triage.types.js";

export type ComplaintRecord = InferSelectModel<typeof complaints>;
export type ComplaintActionRecord = InferSelectModel<typeof complaintActions>;
export type StatusHistoryRecord = InferSelectModel<typeof statusHistory>;
export type TriageRunRecord = InferSelectModel<typeof triageRuns>;
export type SlaEventRecord = InferSelectModel<typeof slaEvents>;

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
  async createComplaint(input: CreateComplaintInput, createdBy: string): Promise<ComplaintRecord> {
    const now = new Date();
    const [created] = await db
      .insert(complaints)
      .values({
        id: createId("cmp"),
        source: input.source,
        customerName: input.customerName ?? null,
        customerContact: input.customerContact ?? null,
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

    const [actions, history, triageRunsList, slaEventsList] = await Promise.all([
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
    ]);

    return {
      complaint,
      actions,
      history,
      triageRuns: triageRunsList,
      slaEvents: slaEventsList,
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
          summary: params.triage.summary,
          reasoning: params.triage.reasoning,
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
}

export const complaintsRepository = new ComplaintsRepository();
