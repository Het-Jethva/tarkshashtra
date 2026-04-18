import type {
  actionStatusEnum,
  complaintCategoryEnum,
  complaintSourceEnum,
  complaintStatusEnum,
  priorityEnum,
  slaEventTypeEnum,
  slaMetricEnum,
  triageStatusEnum,
} from "./schema.js";

export type ComplaintSource = (typeof complaintSourceEnum.enumValues)[number];
export type ComplaintCategory = (typeof complaintCategoryEnum.enumValues)[number];
export type ComplaintPriority = (typeof priorityEnum.enumValues)[number];
export type ComplaintStatus = (typeof complaintStatusEnum.enumValues)[number];
export type TriageStatus = (typeof triageStatusEnum.enumValues)[number];
export type ActionStatus = (typeof actionStatusEnum.enumValues)[number];
export type SlaEventType = (typeof slaEventTypeEnum.enumValues)[number];
export type SlaMetric = (typeof slaMetricEnum.enumValues)[number];
