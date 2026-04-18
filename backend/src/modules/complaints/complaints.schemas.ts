import { z } from "zod";

import {
  complaintCategoryEnum,
  complaintSourceEnum,
  complaintStatusEnum,
  priorityEnum,
  sentimentEnum,
  triageStatusEnum,
} from "../../db/schema.js";

export const createComplaintSchema = z.object({
  source: z.enum(complaintSourceEnum.enumValues),
  content: z.string().trim().min(10).max(10000),
  customerName: z.string().trim().min(2).max(120).optional(),
  customerContact: z.string().trim().min(3).max(150).optional(),
});

const customerComplaintTextSchema = z.string().trim().min(10).max(10000);

export const createDirectCustomerComplaintSchema = z
  .object({
    customerName: z.string().trim().min(2).max(120),
    customerContact: z.string().trim().min(3).max(150),
    content: customerComplaintTextSchema.optional(),
    summary: customerComplaintTextSchema.optional(),
    complaint: customerComplaintTextSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.content && !input.summary && !input.complaint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Complaint details are required",
        path: ["content"],
      });
    }
  });

export const listComplaintsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  source: z.enum(complaintSourceEnum.enumValues).optional(),
  category: z.enum(complaintCategoryEnum.enumValues).optional(),
  priority: z.enum(priorityEnum.enumValues).optional(),
  sentiment: z.enum(sentimentEnum.enumValues).optional(),
  assignedTo: z.string().trim().min(2).max(120).optional(),
  confidenceLte: z.coerce.number().min(0).max(1).optional(),
  confidenceGte: z.coerce.number().min(0).max(1).optional(),
  duplicateOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  repeatOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  status: z.enum(complaintStatusEnum.enumValues).optional(),
  triageStatus: z.enum(triageStatusEnum.enumValues).optional(),
  slaStatus: z.enum(["safe", "at_risk", "breached", "met"]).optional(),
  search: z.string().trim().min(2).max(150).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(complaintStatusEnum.enumValues),
  note: z.string().trim().min(2).max(1000).optional(),
});

export const complaintAiFeedbackSchema = z.object({
  helpful: z.boolean(),
});

export const complaintQaReviewSchema = z.object({
  verifiedCategory: z.enum(complaintCategoryEnum.enumValues),
  needsRetraining: z.boolean().default(false),
});

export const complaintOverrideSchema = z
  .object({
    category: z.enum(complaintCategoryEnum.enumValues).optional(),
    priority: z.enum(priorityEnum.enumValues).optional(),
    reason: z.string().trim().min(5).max(500),
  })
  .superRefine((value, ctx) => {
    if (!value.category && !value.priority) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one override field is required",
        path: ["category"],
      });
    }
  });

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type CreateDirectCustomerComplaintInput = z.infer<typeof createDirectCustomerComplaintSchema>;
export type ListComplaintsQueryInput = z.infer<typeof listComplaintsQuerySchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type ComplaintAiFeedbackInput = z.infer<typeof complaintAiFeedbackSchema>;
export type ComplaintQaReviewInput = z.infer<typeof complaintQaReviewSchema>;
export type ComplaintOverrideInput = z.infer<typeof complaintOverrideSchema>;
