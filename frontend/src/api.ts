import type {
  ApiResponse,
  Category,
  Complaint,
  CurrentUser,
  DashboardSummary,
  Priority,
  QueueStats,
  SlaOverview,
  Source,
  Status,
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
  customerName: string | null;
  customerContact: string | null;
  content: string;
  category: Category | null;
  priority: Priority | null;
  confidence: number | null;
  summary: string | null;
  reasoning: string | null;
  status: Status;
  triageStatus: TriageStatus;
  createdAt: string;
  updatedAt: string;
};

type BackendComplaintAction = {
  action: string;
};

type BackendComplaintDetails = {
  complaint: BackendComplaint;
  actions: BackendComplaintAction[];
};

type BackendPaginatedComplaints = {
  items: BackendComplaint[];
  total: number;
  page: number;
  pageSize: number;
};

function toComplaint(complaint: BackendComplaint, actions: BackendComplaintAction[] = []): Complaint {
  const hasTriage = Boolean(complaint.category && complaint.priority && complaint.reasoning);

  return {
    id: complaint.id,
    source: complaint.source,
    customerName: complaint.customerName ?? undefined,
    customerContact: complaint.customerContact ?? undefined,
    content: complaint.content,
    summary: complaint.summary ?? undefined,
    status: complaint.status,
    triageStatus: complaint.triageStatus,
    triageResult: hasTriage
      ? {
          confidence: complaint.confidence ?? 0,
          reasoning: complaint.reasoning ?? '',
          category: complaint.category!,
          priority: complaint.priority!,
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
    }).then((details) => toComplaint(details.complaint, details.actions)),
     
  createExecutiveComplaint: (data: { source: Source; content: string; customerName?: string; customerContact?: string }) => 
    fetchApi<BackendComplaintDetails>('/complaints', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((details) => toComplaint(details.complaint, details.actions)),
     
  getComplaints: (params: Record<string, any> = {}) => {
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
      toComplaint(details.complaint, details.actions),
    ),
  
  updateStatus: (id: string, data: { status: Status; note?: string }) => 
    fetchApi<BackendComplaintDetails>(`/complaints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((details) => toComplaint(details.complaint, details.actions)),
     
  retryTriage: (id: string) =>
    fetchApi<BackendComplaintDetails>(`/complaints/${id}/retry-triage`, { method: 'POST' }).then((details) =>
      toComplaint(details.complaint, details.actions),
    ),
  
  getQueueStats: () => fetchApi<QueueStats>('/complaints/queue/stats'),
  
  getDashboardSummary: () => fetchApi<DashboardSummary>('/dashboard/summary'),
  getSlaOverview: () => fetchApi<SlaOverview>('/dashboard/sla-overview'),
  getWorkload: () => fetchApi<WorkloadDistribution>('/dashboard/workload'),

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
