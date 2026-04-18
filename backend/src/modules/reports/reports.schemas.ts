import { z } from "zod";

import { complaintStatusEnum } from "../../db/schema.js";

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(complaintStatusEnum.enumValues).optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
