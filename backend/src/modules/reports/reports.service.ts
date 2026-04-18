import PDFDocument from "pdfkit";

import type { ComplaintStatus } from "../../db/types.js";
import { complaintsRepository } from "../complaints/complaints.repository.js";

type ReportFilters = {
  from?: Date;
  to?: Date;
  status?: ComplaintStatus;
};

function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

class ReportsService {
  async generateCsv(filters: ReportFilters): Promise<string> {
    const rows = await complaintsRepository.fetchComplaintsForExport(filters);
    const headers = [
      "id",
      "source",
      "category",
      "priority",
      "status",
      "triage_status",
      "customer_name",
      "created_at",
      "resolution_due_at",
      "resolved_at",
      "summary",
    ];

    const csvRows = [headers.join(",")];

    for (const row of rows) {
      csvRows.push(
        [
          row.id,
          row.source,
          row.category ?? "",
          row.priority ?? "",
          row.status,
          row.triageStatus,
          row.customerName ?? "",
          row.createdAt.toISOString(),
          row.resolutionDueAt?.toISOString() ?? "",
          row.resolvedAt?.toISOString() ?? "",
          row.summary ?? "",
        ]
          .map((value) => escapeCsvValue(value))
          .join(","),
      );
    }

    return csvRows.join("\n");
  }

  async generatePdf(filters: ReportFilters): Promise<Buffer> {
    const rows = await complaintsRepository.fetchComplaintsForExport(filters);

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

      for (const row of rows) {
        doc
          .fontSize(11)
          .text(`ID: ${row.id}`)
          .fontSize(10)
          .text(`Source: ${row.source} | Category: ${row.category ?? "-"} | Priority: ${row.priority ?? "-"}`)
          .text(`Status: ${row.status} | Triage: ${row.triageStatus}`)
          .text(`Created: ${row.createdAt.toISOString()}`)
          .text(`Summary: ${row.summary ?? "No summary"}`)
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
