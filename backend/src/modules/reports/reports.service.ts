import PDFDocument from "pdfkit";

import type { ComplaintCategory, ComplaintSentiment, ComplaintStatus, ComplaintPriority } from "../../db/types.js";
import { complaintsRepository } from "../complaints/complaints.repository.js";

type ReportFilters = {
  from?: Date;
  to?: Date;
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  priority?: ComplaintPriority;
  sentiment?: ComplaintSentiment;
  slaStatus?: "safe" | "at_risk" | "breached" | "met";
  agent?: string;
};

function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

class ReportsService {
  async getPreviewRows(filters: ReportFilters): Promise<
    Array<{
      id: string;
      createdAt: string;
      assignedTo: string | null;
      customerName: string | null;
      source: string;
      content: string;
      category: string | null;
      priority: string | null;
      sentiment: string | null;
      slaStatus: string;
      resolutionTimeHours: number | null;
      status: string;
      confidencePercent: number | null;
    }>
  > {
    const rows = await complaintsRepository.fetchComplaintsForExport({
      from: filters.from,
      to: filters.to,
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      sentiment: filters.sentiment,
      slaStatus: filters.slaStatus,
      assignedTo: filters.agent,
    });

    return rows.slice(0, 200).map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      assignedTo: row.assignedTo,
      customerName: row.customerName,
      source: row.source,
      content: row.content,
      category: row.category,
      priority: row.priority,
      sentiment: row.sentiment,
      slaStatus:
        row.resolvedAt && row.resolutionDueAt
          ? row.resolvedAt <= row.resolutionDueAt
            ? "Met"
            : "Breached"
          : row.resolutionDueAt && row.resolutionDueAt < new Date()
            ? "Breached"
            : "Open",
      resolutionTimeHours:
        row.resolvedAt !== null
          ? Number(((row.resolvedAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(2))
          : null,
      status: row.status,
      confidencePercent:
        row.confidence === null || row.confidence === undefined ? null : Math.round(row.confidence * 100),
    }));
  }

  async generateCsv(filters: ReportFilters): Promise<string> {
    const rows = await complaintsRepository.fetchComplaintsForExport({
      from: filters.from,
      to: filters.to,
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      sentiment: filters.sentiment,
      slaStatus: filters.slaStatus,
      assignedTo: filters.agent,
    });
    const headers = [
      "complaint_id",
      "date_submitted",
      "agent_name",
      "customer_name",
      "customer_contact",
      "source_channel",
      "raw_complaint_text",
      "ai_category",
      "confidence_percent",
      "sentiment",
      "sentiment_score",
      "priority",
      "priority_reason",
      "duplicate_of_complaint_id",
      "repeat_complainant",
      "sla_status",
      "resolution_time_hours",
      "status",
      "ai_recommendation_helpful",
    ];

    const csvRows = [headers.join(",")];

    for (const row of rows) {
      csvRows.push(
        [
          row.id,
          row.createdAt.toISOString(),
          row.assignedTo ?? "",
          row.customerName ?? "",
          row.customerContact ?? "",
          row.source,
          row.content,
          row.category ?? "",
          row.confidence !== null && row.confidence !== undefined
            ? String(Math.round(row.confidence * 100))
            : "",
          row.sentiment ?? "",
          row.sentimentScore !== null && row.sentimentScore !== undefined
            ? String(row.sentimentScore)
            : "",
          row.priority ?? "",
          row.priorityReason ?? "",
          row.duplicateOfComplaintId ?? "",
          row.isRepeatComplainant ? "yes" : "no",
          row.resolvedAt && row.resolutionDueAt
            ? row.resolvedAt <= row.resolutionDueAt
              ? "Met"
              : "Breached"
            : row.resolutionDueAt && row.resolutionDueAt < new Date()
              ? "Breached"
              : "At Risk",
          row.resolvedAt
            ? String(
                ((row.resolvedAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(2),
              )
            : "",
          row.status,
          row.aiHelpful === null || row.aiHelpful === undefined
            ? ""
            : row.aiHelpful
              ? "yes"
              : "no",
        ]
          .map((value) => escapeCsvValue(value))
          .join(","),
      );
    }

    return csvRows.join("\n");
  }

  async generatePdf(filters: ReportFilters): Promise<Buffer> {
    const rows = await complaintsRepository.fetchComplaintsForExport({
      from: filters.from,
      to: filters.to,
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      sentiment: filters.sentiment,
      slaStatus: filters.slaStatus,
      assignedTo: filters.agent,
    });
    const summary = await complaintsRepository.getExportSummary({
      from: filters.from,
      to: filters.to,
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      sentiment: filters.sentiment,
      slaStatus: filters.slaStatus,
      assignedTo: filters.agent,
    });
    const agentPerformance = await complaintsRepository.getAgentPerformanceSummary({
      from: filters.from,
      to: filters.to,
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      sentiment: filters.sentiment,
      slaStatus: filters.slaStatus,
      assignedTo: filters.agent,
    });

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (error: Error) => reject(error));

      doc.fontSize(18).text("Complaint Report", { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
      doc.text(`Total records: ${rows.length}`);
      doc.moveDown(0.8);

      doc.fontSize(13).text("Summary", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).text(`SLA compliance: ${summary.slaCompliancePercent}%`);
      doc.text(`Average resolution time: ${summary.avgResolutionHours}h`);
      doc.text(`Low-confidence complaints (<60%): ${summary.lowConfidence}`);
      doc.text(
        `Category distribution: ${summary.byCategory
          .map((item) => `${item.key} (${item.count})`)
          .join(", ")}`,
      );
      doc.text(
        `Priority distribution: ${summary.byPriority
          .map((item) => `${item.key} (${item.count})`)
          .join(", ")}`,
      );
      doc.moveDown(0.8);

      doc.fontSize(13).text("Agent Performance", { underline: true });
      doc.moveDown(0.3);
      for (const agent of agentPerformance) {
        doc
          .fontSize(10)
          .text(
            `${agent.agentName}: assigned ${agent.assignedCount}, resolved ${agent.resolvedCount}, SLA ${agent.slaMetPercent}%, avg ${agent.avgResolutionHours}h, AI helpful ${agent.helpfulnessPercent}%`,
          );
      }
      doc.moveDown(0.8);

      doc.fontSize(13).text("Complaints", { underline: true });
      doc.moveDown(0.3);

      for (const row of rows) {
        doc
          .fontSize(11)
          .text(`ID: ${row.id}`)
          .fontSize(10)
          .text(
            `Source: ${row.source} | Category: ${row.category ?? "-"} | Priority: ${row.priority ?? "-"} | Sentiment: ${row.sentiment ?? "-"}`,
          )
          .text(`Status: ${row.status} | Triage: ${row.triageStatus} | Assigned: ${row.assignedTo ?? "Unassigned"}`)
          .text(`Created: ${row.createdAt.toISOString()}`)
          .text(`Summary: ${row.summary ?? "No summary"}`)
          .text(`Duplicate: ${row.duplicateOfComplaintId ?? "No"} | Repeat: ${row.isRepeatComplainant ? "Yes" : "No"}`)
          .moveDown(0.5);

        if (doc.y > 730) {
          doc.addPage();
        }
      }

      doc.end();
    });
  }
}

export const reportsService = new ReportsService();
