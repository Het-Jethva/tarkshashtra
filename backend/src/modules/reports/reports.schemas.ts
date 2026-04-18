import { z } from "zod";

import { complaintCategoryEnum, complaintStatusEnum } from "../../db/schema.js";

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(complaintStatusEnum.enumValues).optional(),
  category: z.enum(complaintCategoryEnum.enumValues).optional(),
  agent: z.string().trim().min(2).max(120).optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
