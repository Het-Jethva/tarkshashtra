import { and, eq, sql } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { complaints } from "../../db/schema.js";
import type { ComplaintPriority, ComplaintStatus } from "../../db/types.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { sseHub } from "../../lib/sse-hub.js";
import type {
  CreateComplaintInput,
  CreateDirectCustomerComplaintInput,
  ListComplaintsQueryInput,
  UpdateComplaintStatusInput,
} from "./complaints.schemas.js";
import { complaintsRepository } from "./complaints.repository.js";
import { triageService } from "../triage/triage.service.js";

type SlaPolicy = {
  firstResponseMinutes: number;
  resolutionHours: number;
};

const SLA_POLICY: Record<ComplaintPriority, SlaPolicy> = {
  High: { firstResponseMinutes: 15, resolutionHours: 4 },
  Medium: { firstResponseMinutes: 60, resolutionHours: 24 },
  Low: { firstResponseMinutes: 240, resolutionHours: 72 },
};

const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  New: ["Triaged", "TriageFailed"],
  Triaged: ["InProgress", "WaitingCustomer", "Resolved", "Closed", "TriageFailed"],
  InProgress: ["WaitingCustomer", "Resolved", "Closed"],
  WaitingCustomer: ["InProgress", "Resolved", "Closed"],
  Resolved: ["Closed", "InProgress"],
  Closed: [],
  TriageFailed: ["Triaged", "InProgress", "WaitingCustomer", "Resolved", "Closed"],
};

function computeSlaDeadlines(priority: ComplaintPriority, baseDate = new Date()): {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
} {
  const policy = SLA_POLICY[priority];

  return {
    firstResponseDueAt: new Date(baseDate.getTime() + policy.firstResponseMinutes * 60_000),
    resolutionDueAt: new Date(baseDate.getTime() + policy.resolutionHours * 60 * 60_000),
  };
}

function canTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

class ComplaintsService {
  private normalizeDirectComplaintContent(input: CreateDirectCustomerComplaintInput): string {
    return (input.content ?? input.summary ?? input.complaint ?? "").trim();
  }

  async createComplaint(input: CreateComplaintInput) {
    const complaint = await complaintsRepository.createComplaint(input);

    const triageResult = await triageService.triageComplaint(complaint.content);
    if (!triageResult.ok) {
      await complaintsRepository.saveTriageFailure({
        complaintId: complaint.id,
        triageResult,
        promptVersion: env.PROMPT_VERSION,
      });

      await complaintsRepository.insertStatusHistory({
        complaintId: complaint.id,
        fromStatus: complaint.status,
        toStatus: "TriageFailed",
        changedBy: "system",
        note: triageResult.errorMessage,
      });

      sseHub.broadcast({
        event: "complaint.triage_failed",
        payload: {
          complaintId: complaint.id,
          triageStatus: "failed",
        },
      });

      return this.getComplaintDetailsOrThrow(complaint.id);
    }

    const dueDates = computeSlaDeadlines(triageResult.data.priority, complaint.createdAt);

    await complaintsRepository.updateSlaFields(complaint.id, {
      firstResponseAt: null,
      resolvedAt: null,
      firstResponseDueAt: dueDates.firstResponseDueAt,
      resolutionDueAt: dueDates.resolutionDueAt,
    });

    await complaintsRepository.saveTriageSuccess({
      complaint: {
        ...complaint,
        firstResponseDueAt: dueDates.firstResponseDueAt,
        resolutionDueAt: dueDates.resolutionDueAt,
      },
      triage: triageResult.data,
      triageResult,
      promptVersion: env.PROMPT_VERSION,
    });

    await complaintsRepository.insertStatusHistory({
      complaintId: complaint.id,
      fromStatus: complaint.status,
      toStatus: "Triaged",
      changedBy: "system",
      note: "LLM triage completed",
    });

    sseHub.broadcast({
      event: "complaint.triaged",
      payload: {
        complaintId: complaint.id,
        category: triageResult.data.category,
        priority: triageResult.data.priority,
      },
    });

    return this.getComplaintDetailsOrThrow(complaint.id);
  }

  async createDirectCustomerComplaint(input: CreateDirectCustomerComplaintInput) {
    const details = await this.createComplaint({
      source: "direct",
      customerName: input.customerName,
      customerContact: input.customerContact,
      content: this.normalizeDirectComplaintContent(input),
      createdBy: "End Customer",
    });

    return details;
  }

  async retryTriage(complaintId: string) {
    const complaint = await complaintsRepository.getComplaintById(complaintId);
    if (!complaint) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }

    if (complaint.status !== "TriageFailed") {
      throw new ValidationError("Triage retry is only allowed for failed triage complaints", {
        complaintId,
        status: complaint.status,
      });
    }

    const triageResult = await triageService.triageComplaint(complaint.content);
    if (!triageResult.ok) {
      await complaintsRepository.saveTriageFailure({
        complaintId,
        triageResult,
        promptVersion: env.PROMPT_VERSION,
      });

      sseHub.broadcast({
        event: "complaint.triage_failed",
        payload: {
          complaintId,
          triageStatus: "failed",
        },
      });

      return this.getComplaintDetailsOrThrow(complaintId);
    }

    const dueDates = computeSlaDeadlines(triageResult.data.priority, complaint.createdAt);

    await complaintsRepository.updateSlaFields(complaint.id, {
      firstResponseAt: complaint.firstResponseAt,
      resolvedAt: complaint.resolvedAt,
      firstResponseDueAt: dueDates.firstResponseDueAt,
      resolutionDueAt: dueDates.resolutionDueAt,
    });

    await complaintsRepository.saveTriageSuccess({
      complaint: {
        ...complaint,
        firstResponseDueAt: dueDates.firstResponseDueAt,
        resolutionDueAt: dueDates.resolutionDueAt,
      },
      triage: triageResult.data,
      triageResult,
      promptVersion: env.PROMPT_VERSION,
    });

    await complaintsRepository.insertStatusHistory({
      complaintId,
      fromStatus: complaint.status,
      toStatus: "Triaged",
      changedBy: "system",
      note: "LLM triage retried",
    });

    sseHub.broadcast({
      event: "complaint.triaged",
      payload: {
        complaintId,
        category: triageResult.data.category,
        priority: triageResult.data.priority,
      },
    });

    return this.getComplaintDetailsOrThrow(complaintId);
  }

  async listComplaints(filters: ListComplaintsQueryInput) {
    return complaintsRepository.listComplaints(filters);
  }

  async getComplaintDetailsOrThrow(complaintId: string) {
    const details = await complaintsRepository.getComplaintDetails(complaintId);
    if (!details) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }
    return details;
  }

  async updateStatus(complaintId: string, input: UpdateComplaintStatusInput) {
    const complaint = await complaintsRepository.getComplaintById(complaintId);
    if (!complaint) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }

    if (complaint.status === input.status) {
      throw new ValidationError("Status is already set to requested value", {
        complaintId,
        status: input.status,
      });
    }

    if (!canTransition(complaint.status, input.status)) {
      throw new ValidationError("Invalid status transition", {
        fromStatus: complaint.status,
        toStatus: input.status,
      });
    }

    const now = new Date();
    const firstResponseAt =
      complaint.firstResponseAt ??
      (input.status === "InProgress" || input.status === "WaitingCustomer" ? now : null);
    const movingOutOfResolvedState =
      complaint.resolvedAt !== null && input.status !== "Resolved" && input.status !== "Closed";
    const resolvedAt =
      input.status === "Resolved" || input.status === "Closed"
        ? complaint.resolvedAt ?? now
        : movingOutOfResolvedState
          ? null
          : complaint.resolvedAt;

    await complaintsRepository.updateSlaFields(complaintId, {
      firstResponseAt,
      resolvedAt,
      firstResponseDueAt: complaint.firstResponseDueAt,
      resolutionDueAt: complaint.resolutionDueAt,
    });

    const updated = await complaintsRepository.updateComplaintStatus(complaintId, input);
    if (!updated) {
      throw new NotFoundError("Complaint not found after update", { complaintId });
    }

    await complaintsRepository.insertStatusHistory({
      complaintId,
      fromStatus: complaint.status,
      toStatus: input.status,
      changedBy: input.changedBy ?? "Support Executive",
      note: input.note,
    });

    await this.recordSlaMetEvents(updated);

    sseHub.broadcast({
      event: "complaint.status_updated",
      payload: {
        complaintId,
        fromStatus: complaint.status,
        toStatus: updated.status,
      },
    });

    return this.getComplaintDetailsOrThrow(complaintId);
  }

  async recordSlaMetEvents(complaint: {
    id: string;
    firstResponseAt: Date | null;
    firstResponseDueAt: Date | null;
    resolvedAt: Date | null;
    resolutionDueAt: Date | null;
  }): Promise<void> {
    if (
      complaint.firstResponseAt &&
      complaint.firstResponseDueAt &&
      complaint.firstResponseAt <= complaint.firstResponseDueAt
    ) {
      await complaintsRepository.insertSlaEvent({
        complaintId: complaint.id,
        eventType: "met",
        metric: "first_response",
      });
    }

    if (
      complaint.resolvedAt &&
      complaint.resolutionDueAt &&
      complaint.resolvedAt <= complaint.resolutionDueAt
    ) {
      await complaintsRepository.insertSlaEvent({
        complaintId: complaint.id,
        eventType: "met",
        metric: "resolution",
      });
    }
  }

  async getQueueStats() {
    const [openCount, triageFailedCount, highPriorityCount] = await Promise.all([
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(complaints)
        .where(and(eq(complaints.triageStatus, "success"), sql`${complaints.status} <> 'Closed'`)),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(complaints)
        .where(eq(complaints.status, "TriageFailed")),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(complaints)
        .where(and(eq(complaints.priority, "High"), sql`${complaints.status} <> 'Closed'`)),
    ]);

    return {
      open: openCount[0]?.value ?? 0,
      triageFailed: triageFailedCount[0]?.value ?? 0,
      highPriorityOpen: highPriorityCount[0]?.value ?? 0,
    };
  }
}

export const complaintsService = new ComplaintsService();
