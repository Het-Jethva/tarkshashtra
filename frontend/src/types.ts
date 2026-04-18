export type Source = 'email' | 'call' | 'direct';
export type Category = 'Product' | 'Packaging' | 'Trade';
export type Priority = 'High' | 'Medium' | 'Low';
export type Sentiment = 'Angry' | 'Frustrated' | 'Neutral' | 'Satisfied';
export type Status = 'New' | 'Triaged' | 'InProgress' | 'WaitingCustomer' | 'Resolved' | 'Closed' | 'TriageFailed';
export type TriageStatus = 'pending' | 'success' | 'failed';
export type UserRole = 'support_executive' | 'quality_assurance' | 'operations_manager';
export type Permission =
  | 'complaints:create'
  | 'complaints:read'
  | 'complaints:update_status'
  | 'complaints:retry_triage'
  | 'complaints:override'
  | 'dashboard:read'
  | 'dashboard:stream'
  | 'reports:export';

export interface CurrentUser {
  role: UserRole;
  roleLabel: string;
  name: string;
  permissions: Permission[];
  availableRoles: Array<{
    role: UserRole;
    label: string;
  }>;
}

export interface TriageResult {
  confidence: number;
  reasoning: string;
  category: Category;
  priority: Priority;
  sentiment?: Sentiment;
  sentimentScore?: number;
  priorityReason?: string;
  keywords?: string[];
  recommendedActions: string[];
}

export interface ComplaintAction {
  id: string;
  action: string;
  owner: string;
  deadlineHours: number;
  dueAt: string;
  actionStatus: 'Pending' | 'Done' | 'Skipped';
}

export interface ComplaintOverride {
  id: string;
  field: 'category' | 'priority';
  fromValue?: string;
  toValue: string;
  reason: string;
  changedBy: string;
  createdAt: string;
}

export interface StatusHistoryEvent {
  id: string;
  fromStatus?: Status;
  toStatus: Status;
  note?: string;
  changedBy: string;
  createdAt: string;
}

export interface TriageRunEvent {
  id: string;
  model: string;
  latencyMs: number;
  promptVersion: string;
  parseOk: boolean;
  error?: string;
  createdAt: string;
}

export interface SlaEvent {
  id: string;
  eventType: 'warning' | 'breach' | 'met';
  metric: 'first_response' | 'resolution';
  createdAt: string;
}

export interface Complaint {
  id: string;
  source: Source;
  assignedTo?: string;
  customerName?: string;
  customerContact?: string;
  category?: Category;
  priority?: Priority;
  confidence?: number;
  sentiment?: Sentiment;
  sentimentScore?: number;
  priorityReason?: string;
  keywords?: string[];
  reasoning?: string;
  duplicateOfComplaintId?: string;
  duplicateScore?: number;
  isRepeatComplainant: boolean;
  repeatCount7d: number;
  aiHelpful?: boolean;
  aiHelpfulAt?: string;
  qaVerifiedCategory?: Category;
  qaReviewedBy?: string;
  qaReviewedAt?: string;
  needsRetraining: boolean;
  managerOverridden: boolean;
  managerOverrideReason?: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  content: string;
  summary?: string;
  status: Status;
  triageStatus: TriageStatus;
  actions: ComplaintAction[];
  overrides: ComplaintOverride[];
  history: StatusHistoryEvent[];
  triageRuns: TriageRunEvent[];
  slaEvents: SlaEvent[];
  triageResult?: TriageResult;
  createdAt: string;
  updatedAt: string;
}

export interface AgentAlertStats {
  breachedHigh: number;
  atRiskHigh: number;
}

export interface QueueStats {
  open: number;
  triageFailed: number;
  highPriorityOpen: number;
}

export interface DashboardSummary {
  kpis: {
    totalComplaints: number;
    openComplaints: number;
    triageFailed: number;
    highPriorityOpen: number;
    slaBreaches: number;
    avgResolutionHours: number;
    aiHelpfulnessPercent: number;
    avgAiConfidencePercent: number;
    repeatComplainantCount: number;
    duplicateComplaintsCount: number;
  };
  byCategory: Array<{ key: Category | 'Untriaged'; count: number }>;
  byPriority: Array<{ key: Priority | 'Untriaged'; count: number }>;
  byStatus: Array<{ key: Status | string; count: number }>;
  recentComplaints: Array<{
    id: string;
    source: Source;
    category: Category | null;
    priority: Priority | null;
    status: Status;
    createdAt: string;
  }>;
}

export interface SlaOverview {
  breachesByMetric: Array<{ key: 'first_response' | 'resolution' | string; count: number }>;
  warningsByMetric: Array<{ key: 'first_response' | 'resolution' | string; count: number }>;
}

export interface WorkloadDistribution {
  queueByPriority: Array<{ key: Priority | 'Untriaged' | string; count: number }>;
  queueByCategory: Array<{ key: Category | 'Untriaged' | string; count: number }>;
}

export interface QaTrends {
  thisWeekComplaints: number;
  avgConfidencePercent: number;
  slaMetPercent: number;
  aiHelpfulnessPercent: number;
  keywordFrequency: Array<{ key: string; count: number }>;
  complaintsOverTime: Array<{ date: string; Product: number; Packaging: number; Trade: number }>;
  sentimentDistribution: Array<{ key: Sentiment | 'Unknown' | string; count: number }>;
  confidenceBands: Array<{ key: '0-40' | '41-70' | '71-100'; count: number }>;
  lowConfidenceComplaints: Array<{
    id: string;
    createdAt: string;
    customerName?: string;
    category?: Category;
    confidence?: number;
    summary?: string;
    needsRetraining: boolean;
  }>;
}

export interface ManagerOverview {
  agentWorkload: Array<{
    agentName: string;
    openComplaints: number;
    highPriorityCount: number;
    slaBreachedCount: number;
    performanceScore: number;
    avgResolutionHours: number;
    slaMetPercent: number;
    resolvedCount: number;
    assignedCount: number;
  }>;
  categoryOpenResolved: Array<{ category: string; Open: number; Resolved: number }>;
  priorityDistribution: Array<{ key: string; count: number }>;
  resolutionTimeTrend: Array<{ date: string; avgResolutionHours: number }>;
  kpis: {
    totalComplaintsToday: number;
    slaCompliancePercent: number;
    avgResolutionTimeHours: number;
    openHighPriorityNow: number;
  };
}

export interface ReportPreviewRow {
  id: string;
  createdAt: string;
  assignedTo?: string;
  customerName?: string;
  category?: string;
  priority?: string;
  sentiment?: string;
  status: string;
  confidencePercent?: number;
}

export interface EventTimeline {
  id: string;
  complaintId: string;
  type: 'status_change' | 'triage_run' | 'sla_event';
  details: any;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
