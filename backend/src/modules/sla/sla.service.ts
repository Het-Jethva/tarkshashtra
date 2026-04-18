import { sseHub } from "../../lib/sse-hub.js";
import { complaintsRepository } from "../complaints/complaints.repository.js";

type SlaScanResult = {
  warningsCreated: number;
  breachesCreated: number;
};

function getElapsedRatio(start: Date, end: Date, current: Date): number {
  const fullWindowMs = end.getTime() - start.getTime();
  if (fullWindowMs <= 0) {
    return 1;
  }

  const elapsed = current.getTime() - start.getTime();
  return elapsed / fullWindowMs;
}

class SlaService {
  async runSlaScan(now = new Date()): Promise<SlaScanResult> {
    const activeComplaints = await complaintsRepository.getOpenComplaintsForSlaScan();

    let warningsCreated = 0;
    let breachesCreated = 0;

    for (const complaint of activeComplaints) {
      const createdAt = complaint.createdAt;

      if (!complaint.firstResponseAt && complaint.firstResponseDueAt) {
        const ratio = getElapsedRatio(createdAt, complaint.firstResponseDueAt, now);
        if (ratio >= 0.8 && ratio < 1) {
          const inserted = await complaintsRepository.insertSlaEvent({
            complaintId: complaint.id,
            eventType: "warning",
            metric: "first_response",
          });
          if (inserted) {
            warningsCreated += 1;
          }
        }
        if (ratio >= 1) {
          const inserted = await complaintsRepository.insertSlaEvent({
            complaintId: complaint.id,
            eventType: "breach",
            metric: "first_response",
          });
          if (inserted) {
            breachesCreated += 1;
          }
        }
      }

      if (!complaint.resolvedAt && complaint.resolutionDueAt) {
        const ratio = getElapsedRatio(createdAt, complaint.resolutionDueAt, now);
        if (ratio >= 0.8 && ratio < 1) {
          const inserted = await complaintsRepository.insertSlaEvent({
            complaintId: complaint.id,
            eventType: "warning",
            metric: "resolution",
          });
          if (inserted) {
            warningsCreated += 1;
          }
        }
        if (ratio >= 1) {
          const inserted = await complaintsRepository.insertSlaEvent({
            complaintId: complaint.id,
            eventType: "breach",
            metric: "resolution",
          });
          if (inserted) {
            breachesCreated += 1;
          }
        }
      }
    }

    if (warningsCreated > 0 || breachesCreated > 0) {
      sseHub.broadcast({
        event: "sla.updated",
        payload: {
          warningsCreated,
          breachesCreated,
          timestamp: now.toISOString(),
        },
      });
    }

    return {
      warningsCreated,
      breachesCreated,
    };
  }

  async getOverdueComplaintsCount(): Promise<number> {
    return complaintsRepository.getOverdueComplaintCount();
  }
}

export const slaService = new SlaService();
