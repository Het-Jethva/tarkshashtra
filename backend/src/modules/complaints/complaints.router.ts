import { Router } from "express";

import { asyncHandler, type ApiSuccess } from "../../lib/http.js";
import { ValidationError } from "../../lib/errors.js";
import {
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
  asyncHandler(async (req, res) => {
    const payload = createComplaintSchema.parse(req.body);
    const details = await complaintsService.createComplaint(payload);

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
  asyncHandler(async (req, res) => {
    const query = listComplaintsQuerySchema.parse(req.query);
    const result = await complaintsService.listComplaints(query);

    const response: ApiSuccess<typeof result> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.get(
  "/queue/stats",
  asyncHandler(async (_req, res) => {
    const stats = await complaintsService.getQueueStats();

    const response: ApiSuccess<typeof stats> = {
      success: true,
      data: stats,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const complaintId = normalizeComplaintId(req.params.id);

    const details = await complaintsService.getComplaintDetailsOrThrow(complaintId);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const complaintId = normalizeComplaintId(req.params.id);

    const payload = updateComplaintStatusSchema.parse(req.body);
    const details = await complaintsService.updateStatus(complaintId, payload);

    const response: ApiSuccess<typeof details> = {
      success: true,
      data: details,
    };

    res.status(200).json(response);
  }),
);

complaintsRouter.post(
  "/:id/retry-triage",
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

export { complaintsRouter };
