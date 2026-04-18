import { z } from "zod";

export const complaintCategorySchema = z.enum(["Product", "Packaging", "Trade"]);
export const complaintPrioritySchema = z.enum(["High", "Medium", "Low"]);

export const triageActionSchema = z.object({
  action: z.string().min(3).max(200),
  owner: z.string().min(2).max(100),
  deadline_hours: z.number().int().min(1).max(168),
});

export const triageResponseSchema = z.object({
  category: complaintCategorySchema,
  priority: complaintPrioritySchema,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(5).max(400),
  reasoning: z.string().min(10).max(1200),
  urgency_signals: z.array(z.string().min(2).max(100)).max(8),
  impact_signals: z.array(z.string().min(2).max(100)).max(8),
  recommended_actions: z.array(triageActionSchema).min(3).max(5),
});

export type TriageAction = z.infer<typeof triageActionSchema>;
export type TriageResponse = z.infer<typeof triageResponseSchema>;

export type TriageSuccessResult = {
  ok: true;
  data: TriageResponse;
  latencyMs: number;
  model: string;
  rawOutput: Record<string, unknown>;
};

export type TriageFailureResult = {
  ok: false;
  latencyMs: number;
  model: string;
  rawOutput: Record<string, unknown>;
  errorMessage: string;
};

export type TriageInvocationResult = TriageSuccessResult | TriageFailureResult;
