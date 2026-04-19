import { and, eq, sql } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { complaints } from "../../db/schema.js";
import type { ComplaintPriority, ComplaintStatus } from "../../db/types.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { sseHub } from "../../lib/sse-hub.js";
import type {
  ComplaintAiFeedbackInput,
  ComplaintQaReviewInput,
  ComplaintOverrideInput,
  CreateComplaintInput,
  CreateDirectCustomerComplaintInput,
  ListComplaintsQueryInput,
  UpdateComplaintStatusInput,
} from "./complaints.schemas.js";
import { complaintsRepository, type ComplaintRecord } from "./complaints.repository.js";
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

const SENTIMENT_PRIORITY_WEIGHT: Record<"Angry" | "Frustrated" | "Neutral" | "Satisfied", number> = {
  Angry: 35,
  Frustrated: 20,
  Neutral: 5,
  Satisfied: 0,
};

const SEVERITY_KEYWORDS = [
  "refund",
  "damaged",
  "delay",
  "broken",
  "fraud",
  "unsafe",
  "legal",
  "urgent",
  "escalate",
];

type PriorityScoreContext = {
  sentiment: "Angry" | "Frustrated" | "Neutral" | "Satisfied";
  sentimentScore: number;
  keywords: string[];
  repeatCount7d: number;
  isRepeatComplainant: boolean;
  createdAt: Date;
  dueAt: Date;
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

function computePriorityFromScore(score: number): ComplaintPriority {
  if (score >= 68) {
    return "High";
  }

  if (score >= 34) {
    return "Medium";
  }

  return "Low";
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

function calculatePriorityScore(context: PriorityScoreContext, currentTime = new Date()): {
  score: number;
  computedPriority: ComplaintPriority;
  reason: string;
} {
  const sentimentWeight = SENTIMENT_PRIORITY_WEIGHT[context.sentiment];
  const sentimentComponent = Math.round(sentimentWeight * (context.sentimentScore / 100));

  const normalizedKeywords = context.keywords.map(normalizeKeyword);
  const severityMatches = normalizedKeywords.filter((keyword) =>
    SEVERITY_KEYWORDS.some((severityKeyword) => keyword.includes(severityKeyword)),
  );
  const keywordComponent = Math.min(30, severityMatches.length * 10);

  const repeatComponent = context.isRepeatComplainant ? Math.min(20, 8 + context.repeatCount7d * 4) : 0;

  const totalSlaMs = context.dueAt.getTime() - context.createdAt.getTime();
  const elapsedMs = currentTime.getTime() - context.createdAt.getTime();
  const ratio = totalSlaMs <= 0 ? 1 : Math.min(1.5, Math.max(0, elapsedMs / totalSlaMs));
  const slaComponent = Math.min(15, Math.round(15 * ratio));

  const score = Math.min(100, sentimentComponent + keywordComponent + repeatComponent + slaComponent);
  let computedPriority = computePriorityFromScore(score);

  if (context.sentiment === "Angry" && context.sentimentScore >= 80) {
    computedPriority = "High";
  }
  if (context.isRepeatComplainant && ratio >= 0.8) {
    computedPriority = "High";
  }

  const reasonParts: string[] = [];
  reasonParts.push(`${context.sentiment} sentiment (${context.sentimentScore})`);
  if (severityMatches.length > 0) {
    reasonParts.push(`keywords: ${severityMatches.slice(0, 3).join(", ")}`);
  }
  if (context.isRepeatComplainant) {
    reasonParts.push(`repeat complaint (${context.repeatCount7d} in 7d)`);
  }
  if (ratio >= 0.8) {
    reasonParts.push("SLA at risk");
  }

  return {
    score,
    computedPriority,
    reason: reasonParts.join("; "),
  };
}

function getPriorityScoreBaseDate(complaint: ComplaintRecord): Date {
  return complaint.firstResponseAt ?? complaint.createdAt;
}

class ComplaintsService {
  private escapeCsvValue(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private normalizeDirectComplaintContent(input: CreateDirectCustomerComplaintInput): string {
    return (input.content ?? input.summary ?? input.complaint ?? "").trim();
  }

  private async pickAssignee(createdBy: string): Promise<string> {
    const leastLoadedAgent = await complaintsRepository.getLeastLoadedActiveAgent();
    return leastLoadedAgent ?? createdBy;
  }

  private async getRepeatContext(complaint: ComplaintRecord): Promise<{
    isRepeatComplainant: boolean;
    repeatCount7d: number;
  }> {
    const lookbackStart = new Date(complaint.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const matches = await complaintsRepository.getRecentComplaintsByCustomer({
      customerNameNormalized: complaint.customerNameNormalized,
      customerContactNormalized: complaint.customerContactNormalized,
      lookbackStart,
    });

    const repeatCount7d = Math.max(0, matches.filter((item) => item.id !== complaint.id).length);
    return {
      repeatCount7d,
      isRepeatComplainant: repeatCount7d > 0,
    };
  }

  private async getDuplicateContext(complaint: ComplaintRecord): Promise<{
    duplicateOfComplaintId: string | null;
    duplicateScore: number | null;
  }> {
    const lookbackStart = new Date(complaint.createdAt.getTime() - 14 * 24 * 60 * 60 * 1000);
    const candidates = await complaintsRepository.findDuplicateCandidates({
      complaintId: complaint.id,
      customerContactNormalized: complaint.customerContactNormalized,
      customerNameNormalized: complaint.customerNameNormalized,
      content: complaint.content,
      lookbackStart,
      limit: 3,
    });

    const top = candidates[0];
    if (!top) {
      return {
        duplicateOfComplaintId: null,
        duplicateScore: null,
      };
    }

    const sameContact =
      complaint.customerContactNormalized &&
      top.customerContactNormalized &&
      complaint.customerContactNormalized === top.customerContactNormalized;
    const sameName =
      complaint.customerNameNormalized &&
      top.customerNameNormalized &&
      complaint.customerNameNormalized === top.customerNameNormalized;

    const currentTokens = new Set(
      complaint.content
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 3),
    );
    const previousTokens = new Set(
      top.content
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 3),
    );

    const overlap = [...currentTokens].filter((token) => previousTokens.has(token)).length;
    const denominator = Math.max(1, Math.min(currentTokens.size, previousTokens.size));
    const lexicalScore = overlap / denominator;

    const duplicateScore = Math.min(
      1,
      (sameContact ? 0.6 : 0) + (sameName ? 0.25 : 0) + Math.min(0.35, lexicalScore * 0.35),
    );

    if (duplicateScore < 0.65) {
      return {
        duplicateOfComplaintId: null,
        duplicateScore: null,
      };
    }

    return {
      duplicateOfComplaintId: top.id,
      duplicateScore,
    };
  }

  async createComplaint(input: CreateComplaintInput, createdBy: string) {
    const assignedTo = await this.pickAssignee(createdBy);
    const complaint = await complaintsRepository.createComplaint(input, assignedTo, createdBy);

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

    const repeatContext = await this.getRepeatContext(complaint);
    const initialDueDates = computeSlaDeadlines(triageResult.data.priority, complaint.createdAt);
    const scoring = calculatePriorityScore({
      sentiment: triageResult.data.sentiment,
      sentimentScore: triageResult.data.sentiment_score,
      keywords: triageResult.data.keywords,
      repeatCount7d: repeatContext.repeatCount7d,
      isRepeatComplainant: repeatContext.isRepeatComplainant,
      createdAt: getPriorityScoreBaseDate(complaint),
      dueAt: initialDueDates.firstResponseDueAt,
    });

    const triageData = {
      ...triageResult.data,
      priority: scoring.computedPriority,
      priority_reason: `${triageResult.data.priority_reason}; ${scoring.reason}`,
    };

    const dueDates = computeSlaDeadlines(triageData.priority, complaint.createdAt);
    const duplicateContext = await this.getDuplicateContext(complaint);

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
      triage: triageData,
      triageResult,
      promptVersion: env.PROMPT_VERSION,
      isRepeatComplainant: repeatContext.isRepeatComplainant,
      repeatCount7d: repeatContext.repeatCount7d,
      duplicateOfComplaintId: duplicateContext.duplicateOfComplaintId,
      duplicateScore: duplicateContext.duplicateScore,
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
        category: triageData.category,
        priority: triageData.priority,
        sentiment: triageData.sentiment,
        assignedTo,
        isRepeatComplainant: repeatContext.isRepeatComplainant,
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
    }, "End Customer");

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

    const repeatContext = await this.getRepeatContext(complaint);
    const initialDueDates = computeSlaDeadlines(triageResult.data.priority, complaint.createdAt);
    const scoring = calculatePriorityScore({
      sentiment: triageResult.data.sentiment,
      sentimentScore: triageResult.data.sentiment_score,
      keywords: triageResult.data.keywords,
      repeatCount7d: repeatContext.repeatCount7d,
      isRepeatComplainant: repeatContext.isRepeatComplainant,
      createdAt: getPriorityScoreBaseDate(complaint),
      dueAt: initialDueDates.firstResponseDueAt,
    });

    const triageData = {
      ...triageResult.data,
      priority: scoring.computedPriority,
      priority_reason: `${triageResult.data.priority_reason}; ${scoring.reason}`,
    };

    const dueDates = computeSlaDeadlines(triageData.priority, complaint.createdAt);
    const duplicateContext = await this.getDuplicateContext(complaint);

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
      triage: triageData,
      triageResult,
      promptVersion: env.PROMPT_VERSION,
      isRepeatComplainant: repeatContext.isRepeatComplainant,
      repeatCount7d: repeatContext.repeatCount7d,
      duplicateOfComplaintId: duplicateContext.duplicateOfComplaintId,
      duplicateScore: duplicateContext.duplicateScore,
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
        category: triageData.category,
        priority: triageData.priority,
        sentiment: triageData.sentiment,
        isRepeatComplainant: repeatContext.isRepeatComplainant,
      },
    });

    return this.getComplaintDetailsOrThrow(complaintId);
  }

  async listComplaints(filters: ListComplaintsQueryInput) {
    return complaintsRepository.listComplaints(filters);
  }

  async getAgentSlaAlerts(agentName: string) {
    const rows = await this.listComplaints({
      page: 1,
      pageSize: 200,
      assignedTo: agentName,
      assignedToExact: true,
      triageStatus: "success",
      duplicateOnly: undefined,
      repeatOnly: undefined,
    });

    const activeItems = rows.items.filter((item) =>
      ["Triaged", "InProgress", "WaitingCustomer"].includes(item.status),
    );

    const now = Date.now();
    let breachedHigh = 0;
    let atRiskHigh = 0;
    const alerts: Array<{ complaintId: string; remainingMinutes: number; state: "breached" | "at_risk" }> = [];

    for (const item of activeItems) {
      if (item.priority !== "High") {
        continue;
      }

      const due = item.firstResponseDueAt ?? item.resolutionDueAt;
      if (!due) {
        continue;
      }

      const remainingMinutes = (due.getTime() - now) / (1000 * 60);
      if (remainingMinutes <= 0) {
        breachedHigh += 1;
        alerts.push({
          complaintId: item.id,
          remainingMinutes,
          state: "breached",
        });
      } else if (remainingMinutes <= 30) {
        atRiskHigh += 1;
        alerts.push({
          complaintId: item.id,
          remainingMinutes,
          state: "at_risk",
        });
      }
    }

    alerts.sort((a, b) => a.remainingMinutes - b.remainingMinutes);

    return {
      breachedHigh,
      atRiskHigh,
      alerts,
    };
  }

  async getComplaintDetailsOrThrow(complaintId: string) {
    const details = await complaintsRepository.getComplaintDetails(complaintId);
    if (!details) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }
    return details;
  }

  async updateStatus(complaintId: string, input: UpdateComplaintStatusInput, changedBy: string) {
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
      changedBy,
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

  async recordAiFeedback(complaintId: string, input: ComplaintAiFeedbackInput) {
    const updated = await complaintsRepository.saveAiFeedback(complaintId, input);
    if (!updated) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }

    sseHub.broadcast({
      event: "complaint.ai_feedback",
      payload: {
        complaintId,
        helpful: input.helpful,
      },
    });

    return this.getComplaintDetailsOrThrow(complaintId);
  }

  async reviewLowConfidenceComplaint(
    complaintId: string,
    input: ComplaintQaReviewInput,
    reviewedBy: string,
  ) {
    const complaint = await complaintsRepository.getComplaintById(complaintId);
    if (!complaint) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }

    const needsRetraining =
      input.needsRetraining || (complaint.category !== null && complaint.category !== input.verifiedCategory);

    const updated = await complaintsRepository.saveQaReview({
      complaintId,
      verifiedCategory: input.verifiedCategory,
      reviewedBy,
      needsRetraining,
    });

    if (!updated) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }

    await complaintsRepository.insertStatusHistory({
      complaintId,
      fromStatus: updated.status,
      toStatus: updated.status,
      changedBy: reviewedBy,
      note: `QA verified category ${input.verifiedCategory}${needsRetraining ? " (flagged for retraining)" : ""}`,
    });

    sseHub.broadcast({
      event: "complaint.qa_reviewed",
      payload: {
        complaintId,
        verifiedCategory: input.verifiedCategory,
        needsRetraining,
      },
    });

    return this.getComplaintDetailsOrThrow(complaintId);
  }

  async overrideComplaint(complaintId: string, input: ComplaintOverrideInput, changedBy: string) {
    const updated = await complaintsRepository.applyManagerOverride({
      complaintId,
      input,
      changedBy,
    });

    if (!updated) {
      throw new NotFoundError("Complaint not found", { complaintId });
    }

    const fieldsChanged: string[] = [];
    if (input.category) {
      fieldsChanged.push(`category=${input.category}`);
    }
    if (input.priority) {
      fieldsChanged.push(`priority=${input.priority}`);
    }

    await complaintsRepository.insertStatusHistory({
      complaintId,
      fromStatus: updated.status,
      toStatus: updated.status,
      changedBy,
      note: `Manager override (${fieldsChanged.join(", ")}): ${input.reason}`,
    });

    sseHub.broadcast({
      event: "complaint.overridden",
      payload: {
        complaintId,
        changedBy,
        reason: input.reason,
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

  async getQueueStats(assignedTo?: string) {
    const baseFilter = assignedTo ? eq(complaints.assignedTo, assignedTo) : undefined;

    const [openCount, triageFailedCount, highPriorityCount] = await Promise.all([
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(complaints)
        .where(
          and(
            eq(complaints.triageStatus, "success"),
            sql`${complaints.status} <> 'Closed'`,
            baseFilter,
          ),
        ),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(complaints)
        .where(and(eq(complaints.status, "TriageFailed"), baseFilter)),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(complaints)
        .where(and(eq(complaints.priority, "High"), sql`${complaints.status} <> 'Closed'`, baseFilter)),
    ]);

    return {
      open: openCount[0]?.value ?? 0,
      triageFailed: triageFailedCount[0]?.value ?? 0,
      highPriorityOpen: highPriorityCount[0]?.value ?? 0,
    };
  }

  async exportComplaintsCsv(filters: ListComplaintsQueryInput): Promise<string> {
    const pageSize = Math.max(filters.pageSize, 2000);
    const result = await this.listComplaints({
      ...filters,
      page: 1,
      pageSize,
    });

    const headers = [
      'complaint_id',
      'date_submitted',
      'agent_name',
      'customer_name',
      'source_channel',
      'complaint_text',
      'ai_category',
      'confidence_percent',
      'sentiment',
      'priority',
      'sla_status',
      'status',
    ];

    const rows = [headers.join(',')];

    for (const row of result.items) {
      const slaStatus =
        row.resolvedAt && row.resolutionDueAt
          ? row.resolvedAt <= row.resolutionDueAt
            ? 'Met'
            : 'Breached'
          : row.resolutionDueAt && row.resolutionDueAt < new Date()
            ? 'Breached'
            : 'Open';

      rows.push(
        [
          row.id,
          row.createdAt.toISOString(),
          row.assignedTo ?? '',
          row.customerName ?? '',
          row.source,
          row.content,
          row.category ?? '',
          row.confidence !== null && row.confidence !== undefined ? String(Math.round(row.confidence * 100)) : '',
          row.sentiment ?? '',
          row.priority ?? '',
          slaStatus,
          row.status,
        ]
          .map((value) => this.escapeCsvValue(value))
          .join(','),
      );
    }

    return rows.join('\n');
  }
}

export const complaintsService = new ComplaintsService();
