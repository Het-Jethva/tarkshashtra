export type Source = 'email' | 'call' | 'direct';
export type Category = 'Product' | 'Packaging' | 'Trade';
export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'New' | 'Triaged' | 'InProgress' | 'WaitingCustomer' | 'Resolved' | 'Closed' | 'TriageFailed';
export type TriageStatus = 'pending' | 'success' | 'failed';
export type UserRole = 'support_executive' | 'quality_assurance' | 'operations_manager';
export type Permission =
  | 'complaints:create'
  | 'complaints:read'
  | 'complaints:update_status'
  | 'complaints:retry_triage'
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
  recommendedActions: string[];
}

export interface Complaint {
  id: string;
  source: Source;
  customerName?: string;
  customerContact?: string;
  content: string;
  summary?: string;
  status: Status;
  triageStatus: TriageStatus;
  triageResult?: TriageResult;
  createdAt: string;
  updatedAt: string;
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
