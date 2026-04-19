import { Router } from "express";

import { asyncHandler, type ApiSuccess } from "../../lib/http.js";
import { AppError, ValidationError } from "../../lib/errors.js";
import { getActorFromRequest, requirePermission } from "../auth/rbac.js";
import {
  complaintAiFeedbackSchema,
  complaintOverrideSchema,
  complaintQaReviewSchema,
  createComplaintSchema,
  createDirectCustomerComplaintSchema,
  listComplaintsQuerySchema,
  updateComplaintStatusSchema,
} from "./complaints.schemas.js";
import { complaintsService } from "./complaints.service.js";

const complaintsRouter = Router();

function normalizeComplaintId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    throw new ValidationError("Complaint ID is required");
  }

  return id;
}

complaintsRouter.post(
  "/",
  requirePermission("complaints:create"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const payload = createComplaintSchema.parse(req.body);
    const details = await complaintsService.createComplaint(payload, actor.name);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(201).json(response);
  }),
);

complaintsRouter.post(
  "/customer-direct",
  asyncHandler(async (req, res) => {
    const payload = createDirectCustomerComplaintSchema.parse(req.body);
    const details = await complaintsService.createDirectCustomerComplaint(payload);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(201).json(response);
  }),
);

complaintsRouter.get(
  "/",
  requirePermission("complaints:read"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const query = listComplaintsQuerySchema.parse(req.query);
    const scopedQuery =
      actor.role === "support_executive"
        ? { ...query, assignedTo: actor.name, assignedToExact: true }
        : query;
    const result = await complaintsService.listComplaints(scopedQuery);

    const response: ApiSuccess<typeof result> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.get(
  "/queue/stats",
  requirePermission("complaints:read"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const stats = await complaintsService.getQueueStats(
      actor.role === "support_executive" ? actor.name : undefined,
    );

    const response: ApiSuccess<typeof stats> = {
      success: true,
      data: stats,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.get(
  "/export.csv",
  requirePermission("complaints:read"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const query = listComplaintsQuerySchema.parse(req.query);
    const scopedQuery =
      actor.role === "support_executive"
        ? { ...query, assignedTo: actor.name, assignedToExact: true }
        : query;
    const csv = await complaintsService.exportComplaintsCsv(scopedQuery);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="complaints-${Date.now()}.csv"`);
    res.status(200).send(csv);
  }),
);

complaintsRouter.get(
  "/:id",
  requirePermission("complaints:read"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const complaintId = normalizeComplaintId(req.params.id);

    const details = await complaintsService.getComplaintDetailsOrThrow(complaintId);

    if (actor.role === "support_executive") {
      const assignedTo = details.complaint.assignedTo?.trim().toLowerCase();
      const actorName = actor.name.trim().toLowerCase();
      if (!assignedTo || assignedTo !== actorName) {
        throw new AppError("You are not allowed to access this complaint", 403, "FORBIDDEN", {
          complaintId,
        });
      }
    }

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.patch(
  "/:id/status",
  requirePermission("complaints:update_status"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const complaintId = normalizeComplaintId(req.params.id);

    const payload = updateComplaintStatusSchema.parse(req.body);
    const details = await complaintsService.updateStatus(complaintId, payload, actor.name);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.post(
  "/:id/retry-triage",
  requirePermission("complaints:retry_triage"),
  asyncHandler(async (req, res) => {
    const complaintId = normalizeComplaintId(req.params.id);

    const details = await complaintsService.retryTriage(complaintId);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.get(
  "/queue/agent-alerts",
  requirePermission("complaints:read"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    if (actor.role !== "support_executive") {
      const response: ApiSuccess<{ breachedHigh: number; atRiskHigh: number; alerts: [] }> = {
        success: true,
        data: {
          breachedHigh: 0,
          atRiskHigh: 0,
          alerts: [],
        },
      };

      res.status(200).json(response);
      return;
    }
    const alerts = await complaintsService.getAgentSlaAlerts(actor.name);

    const response: ApiSuccess<typeof alerts> = {
      success: true,
      data: alerts,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.post(
  "/:id/ai-feedback",
  requirePermission("complaints:update_status"),
  asyncHandler(async (req, res) => {
    const complaintId = normalizeComplaintId(req.params.id);
    const payload = complaintAiFeedbackSchema.parse(req.body);
    const details = await complaintsService.recordAiFeedback(complaintId, payload);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.post(
  "/:id/qa-review",
  requirePermission("complaints:retry_triage"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const complaintId = normalizeComplaintId(req.params.id);
    const payload = complaintQaReviewSchema.parse(req.body);
    const details = await complaintsService.reviewLowConfidenceComplaint(complaintId, payload, actor.name);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.post(
  "/:id/override",
  requirePermission("complaints:override"),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);
    const complaintId = normalizeComplaintId(req.params.id);
    const payload = complaintOverrideSchema.parse(req.body);
    const details = await complaintsService.overrideComplaint(complaintId, payload, actor.name);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

export { complaintsRouter };
