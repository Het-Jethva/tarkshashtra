import type {
  AgentAlertStats,
  ApiResponse,
  Category,
  Complaint,
  ComplaintAction,
  ComplaintOverride,
  CurrentUser,
  DashboardSummary,
  ManagerOverview,
  Priority,
  QaTrends,
  QueueStats,
  ReportPreviewRow,
  Sentiment,
  SlaOverview,
  Source,
  Status,
  SlaEvent,
  StatusHistoryEvent,
  TriageRunEvent,
  TriageStatus,
  WorkloadDistribution,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const ROLE_STORAGE_KEY = 'triage.rbac.role';
const NAME_STORAGE_KEY = 'triage.rbac.name';

const DEFAULT_ROLE: CurrentUser['role'] = 'support_executive';

function getStoredRole(): CurrentUser['role'] {
  const value = localStorage.getItem(ROLE_STORAGE_KEY);
  if (value === 'support_executive' || value === 'quality_assurance' || value === 'operations_manager') {
    return value;
  }

  return DEFAULT_ROLE;
}

function getStoredName(): string {
  const value = localStorage.getItem(NAME_STORAGE_KEY);
  if (value && value.trim().length > 0) {
    return value.trim();
  }

  return 'Demo User';
}

function getAuthHeaders(): Record<string, string> {
  return {
    'x-user-role': getStoredRole(),
    'x-user-name': getStoredName(),
  };
}

type BackendComplaint = {
  id: string;
  source: Source;
  assignedTo: string | null;
  customerName: string | null;
  customerContact: string | null;
  content: string;
  category: Category | null;
  priority: Priority | null;
  confidence: number | null;
  sentiment: Sentiment | null;
  sentimentScore: number | null;
  priorityReason: string | null;
  keywords: string[] | null;
  duplicateOfComplaintId: string | null;
  duplicateScore: number | null;
  isRepeatComplainant: boolean;
  repeatCount7d: number;
  aiHelpful: boolean | null;
  aiHelpfulAt: string | null;
  qaVerifiedCategory: Category | null;
  qaReviewedBy: string | null;
  qaReviewedAt: string | null;
  needsRetraining: boolean;
  managerOverridden: boolean;
  managerOverrideReason: string | null;
  summary: string | null;
  reasoning: string | null;
  status: Status;
  triageStatus: TriageStatus;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackendComplaintAction = {
  id: string;
  action: string;
  owner: string;
  deadlineHours: number;
  dueAt: string;
  actionStatus: 'Pending' | 'Done' | 'Skipped';
};

type BackendComplaintOverride = {
  id: string;
  field: 'category' | 'priority';
  fromValue: string | null;
  toValue: string;
  reason: string;
  changedBy: string;
  createdAt: string;
};

type BackendComplaintDetails = {
  complaint: BackendComplaint;
  actions: BackendComplaintAction[];
  history: Array<{
    id: string;
    fromStatus: Status | null;
    toStatus: Status;
    note: string | null;
    changedBy: string;
    createdAt: string;
  }>;
  triageRuns: Array<{
    id: string;
    model: string;
    latencyMs: number;
    promptVersion: string;
    parseOk: boolean;
    error: string | null;
    createdAt: string;
  }>;
  slaEvents: Array<{
    id: string;
    eventType: 'warning' | 'breach' | 'met';
    metric: 'first_response' | 'resolution';
    createdAt: string;
  }>;
  overrides: BackendComplaintOverride[];
};

type BackendPaginatedComplaints = {
  items: BackendComplaint[];
  total: number;
  page: number;
  pageSize: number;
};

type QueryValue = string | number | boolean | null | undefined;

function toComplaint(
  complaint: BackendComplaint,
  actions: BackendComplaintAction[] = [],
  history: BackendComplaintDetails['history'] = [],
  triageRuns: BackendComplaintDetails['triageRuns'] = [],
  slaEvents: BackendComplaintDetails['slaEvents'] = [],
  overrides: BackendComplaintOverride[] = [],
): Complaint {
  const hasTriage = Boolean(complaint.category && complaint.priority && complaint.reasoning);

  const mappedActions: ComplaintAction[] = actions.map((item) => ({
    id: item.id,
    action: item.action,
    owner: item.owner,
    deadlineHours: item.deadlineHours,
    dueAt: item.dueAt,
    actionStatus: item.actionStatus,
  }));

  const mappedOverrides: ComplaintOverride[] = overrides.map((item) => ({
    id: item.id,
    field: item.field,
    fromValue: item.fromValue ?? undefined,
    toValue: item.toValue,
    reason: item.reason,
    changedBy: item.changedBy,
    createdAt: item.createdAt,
  }));

  const mappedHistory: StatusHistoryEvent[] = history.map((item) => ({
    id: item.id,
    fromStatus: item.fromStatus ?? undefined,
    toStatus: item.toStatus,
    note: item.note ?? undefined,
    changedBy: item.changedBy,
    createdAt: item.createdAt,
  }));

  const mappedTriageRuns: TriageRunEvent[] = triageRuns.map((item) => ({
    id: item.id,
    model: item.model,
    latencyMs: item.latencyMs,
    promptVersion: item.promptVersion,
    parseOk: item.parseOk,
    error: item.error ?? undefined,
    createdAt: item.createdAt,
  }));

  const mappedSlaEvents: SlaEvent[] = slaEvents.map((item) => ({
    id: item.id,
    eventType: item.eventType,
    metric: item.metric,
    createdAt: item.createdAt,
  }));

  return {
    id: complaint.id,
    source: complaint.source,
    assignedTo: complaint.assignedTo ?? undefined,
    customerName: complaint.customerName ?? undefined,
    customerContact: complaint.customerContact ?? undefined,
    category: complaint.category ?? undefined,
    priority: complaint.priority ?? undefined,
    confidence: complaint.confidence ?? undefined,
    sentiment: complaint.sentiment ?? undefined,
    sentimentScore: complaint.sentimentScore ?? undefined,
    priorityReason: complaint.priorityReason ?? undefined,
    keywords: complaint.keywords ?? undefined,
    reasoning: complaint.reasoning ?? undefined,
    duplicateOfComplaintId: complaint.duplicateOfComplaintId ?? undefined,
    duplicateScore: complaint.duplicateScore ?? undefined,
    isRepeatComplainant: complaint.isRepeatComplainant,
    repeatCount7d: complaint.repeatCount7d,
    aiHelpful: complaint.aiHelpful ?? undefined,
    aiHelpfulAt: complaint.aiHelpfulAt ?? undefined,
    qaVerifiedCategory: complaint.qaVerifiedCategory ?? undefined,
    qaReviewedBy: complaint.qaReviewedBy ?? undefined,
    qaReviewedAt: complaint.qaReviewedAt ?? undefined,
    needsRetraining: complaint.needsRetraining,
    managerOverridden: complaint.managerOverridden,
    managerOverrideReason: complaint.managerOverrideReason ?? undefined,
    firstResponseDueAt: complaint.firstResponseDueAt ?? undefined,
    resolutionDueAt: complaint.resolutionDueAt ?? undefined,
    firstResponseAt: complaint.firstResponseAt ?? undefined,
    resolvedAt: complaint.resolvedAt ?? undefined,
    content: complaint.content,
    summary: complaint.summary ?? undefined,
    status: complaint.status,
    triageStatus: complaint.triageStatus,
    actions: mappedActions,
    overrides: mappedOverrides,
    history: mappedHistory,
    triageRuns: mappedTriageRuns,
    slaEvents: mappedSlaEvents,
    triageResult: hasTriage
      ? {
          confidence: complaint.confidence ?? 0,
          reasoning: complaint.reasoning ?? '',
          category: complaint.category!,
          priority: complaint.priority!,
          sentiment: complaint.sentiment ?? undefined,
          sentimentScore: complaint.sentimentScore ?? undefined,
          priorityReason: complaint.priorityReason ?? undefined,
          keywords: complaint.keywords ?? undefined,
          recommendedActions: actions.map((item) => item.action),
        }
      : undefined,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
  };
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  let result: ApiResponse<T>;
  try {
    result = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    throw new Error('Invalid API response');
  }

  if (!result.success) {
    throw new Error(result.error?.message || 'API Error');
  }

  return result.data as T;
}

export const api = {
  getCurrentUser: () => fetchApi<CurrentUser>('/auth/me'),
  setRole: (role: CurrentUser['role']) => {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  },
  setUserName: (name: string) => {
    localStorage.setItem(NAME_STORAGE_KEY, name.trim() || 'Demo User');
  },

  health: () => fetchApi<{ status: string }>('/health'),
  
  submitCustomerDirect: (data: { customerName: string; customerContact: string; content: string }) => 
    fetchApi<BackendComplaintDetails>('/complaints/customer-direct', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),
     
  createExecutiveComplaint: (data: { source: Source; content: string; customerName?: string; customerContact?: string }) => 
    fetchApi<BackendComplaintDetails>('/complaints', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),
     
  getComplaints: (params: Record<string, QueryValue> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.append(key, String(value));
    }
    return fetchApi<BackendPaginatedComplaints>(`/complaints?${query.toString()}`).then((result) => ({
      data: result.items.map((item) => toComplaint(item)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    }));
  },
  
  getComplaint: (id: string) =>
    fetchApi<BackendComplaintDetails>(`/complaints/${id}`).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),
  
  updateStatus: (id: string, data: { status: Status; note?: string }) => 
    fetchApi<BackendComplaintDetails>(`/complaints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),

  retryTriage: (id: string) =>
    fetchApi<BackendComplaintDetails>(`/complaints/${id}/retry-triage`, { method: 'POST' }).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),

  submitAiFeedback: (id: string, helpful: boolean) =>
    fetchApi<BackendComplaintDetails>(`/complaints/${id}/ai-feedback`, {
      method: 'POST',
      body: JSON.stringify({ helpful }),
    }).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),

  submitQaReview: (
    id: string,
    payload: { verifiedCategory: Category; needsRetraining: boolean },
  ) =>
    fetchApi<BackendComplaintDetails>(`/complaints/${id}/qa-review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),

  overrideComplaint: (
    id: string,
    payload: { category?: Category; priority?: Priority; reason: string },
  ) =>
    fetchApi<BackendComplaintDetails>(`/complaints/${id}/override`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((details) =>
      toComplaint(
        details.complaint,
        details.actions,
        details.history,
        details.triageRuns,
        details.slaEvents,
        details.overrides,
      ),
    ),

  getQueueStats: () => fetchApi<QueueStats>('/complaints/queue/stats'),
  getAgentAlerts: () => fetchApi<AgentAlertStats>('/complaints/queue/agent-alerts'),

  getDashboardSummary: () => fetchApi<DashboardSummary>('/dashboard/summary'),
  getSlaOverview: () => fetchApi<SlaOverview>('/dashboard/sla-overview'),
  getWorkload: () => fetchApi<WorkloadDistribution>('/dashboard/workload'),
  getQaTrends: () => fetchApi<QaTrends>('/dashboard/qa-trends'),
  getManagerOverview: (agentName?: string) => {
    const query = new URLSearchParams();
    if (agentName && agentName.trim().length > 0) {
      query.set('agentName', agentName.trim());
    }
    return fetchApi<ManagerOverview>(`/dashboard/manager-overview${query.toString() ? `?${query.toString()}` : ''}`);
  },

  getReportPreview: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi<ReportPreviewRow[]>(`/reports/preview${query ? `?${query}` : ''}`);
  },

  exportBulkComplaintsUrl: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams({
      ...params,
      asRole: getStoredRole(),
      asName: getStoredName(),
    }).toString();

    return `${API_BASE}/complaints/export.csv${query ? `?${query}` : ''}`;
  },

  dashboardStreamUrl: () => {
    const query = new URLSearchParams({
      asRole: getStoredRole(),
      asName: getStoredName(),
    }).toString();

    return `${API_BASE}/dashboard/stream?${query}`;
  },
  
  exportReportsUrl: (type: 'csv' | 'pdf', params: Record<string, string> = {}) => {
    const query = new URLSearchParams({
      ...params,
      asRole: getStoredRole(),
      asName: getStoredName(),
    }).toString();
    return `${API_BASE}/reports/export.${type}${query ? '?' + query : ''}`;
  }
};
