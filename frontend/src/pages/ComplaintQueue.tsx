import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { format } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { api } from '../api';
import { Badge, Button, Card, Input, Select, Textarea } from '../components';
import { ConfidenceBar, PriorityBadge, SentimentBadge, SlaProgress, SlaRing } from '../complaint-ui';
import { getErrorMessage } from '../lib/errors';
import { getSlaTraffic, sentimentEmoji } from '../lib/complaint-ui';
import type { Category, Complaint, Paginated, Priority, QueueStats, Sentiment, UserRole } from '../types';

function getQaSlaResult(complaint: Complaint): 'Met' | 'Breached' | 'Open' {
  if (complaint.resolvedAt && complaint.resolutionDueAt) {
    return new Date(complaint.resolvedAt).getTime() <= new Date(complaint.resolutionDueAt).getTime()
      ? 'Met'
      : 'Breached';
  }

  const traffic = getSlaTraffic(complaint);
  return traffic.slaStatus === 'Breached' ? 'Breached' : 'Open';
}

export function ComplaintQueue({
  canCreateComplaint,
  viewerRole,
}: {
  canCreateComplaint: boolean;
  viewerRole: UserRole;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<Paginated<Complaint> | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [agentAlerts, setAgentAlerts] = useState<
    | {
        breachedHigh: number;
        atRiskHigh: number;
        alerts: Array<{ complaintId: string; remainingMinutes: number; state: 'breached' | 'at_risk' }>;
      }
    | null
  >(null);
  const [drawerComplaint, setDrawerComplaint] = useState<Complaint | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<Category | ''>('');
  const [overridePriority, setOverridePriority] = useState<Priority | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const paramsObject = useMemo(() => {
    const result = Object.fromEntries(searchParams.entries());
    delete result.drawer;
    return result;
  }, [searchParams]);
  const drawerId = searchParams.get('drawer');

  const isManager = viewerRole === 'operations_manager';
  const isQa = viewerRole === 'quality_assurance';
  const isSupport = viewerRole === 'support_executive';

  const title = isSupport ? 'My Complaints' : isQa ? 'All Complaints' : 'All Complaints + SLA Table';
  const tableColumnCount = 5 + Number(isManager || isQa) + Number(!isSupport) + Number(isQa) + Number(isManager) + Number(!isQa);
  const hasOverrideChanges = Boolean(
    drawerComplaint && (
      (overrideCategory && overrideCategory !== drawerComplaint.category) ||
      (overridePriority && overridePriority !== drawerComplaint.priority)
    ),
  );
  const canApplyOverride = hasOverrideChanges && overrideReason.trim().length > 0;

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [complaintsRes, statsRes, alertsRes] = await Promise.all([
          api.getComplaints(paramsObject),
          api.getQueueStats(),
          api.getAgentAlerts(),
        ]);
        if (cancelled) {
          return;
        }

        setData(complaintsRes);
        setStats(statsRes);
        setAgentAlerts(alertsRes);
        setError(null);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(error, 'Failed to load complaints'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAll();

    return () => {
      cancelled = true;
    };
  }, [paramsObject]);

  useEffect(() => {
    if (!drawerId || isSupport) {
      return;
    }

    let cancelled = false;

    const loadDrawer = async () => {
      setDrawerLoading(true);
      setDrawerComplaint(null);
      setDrawerError(null);
      try {
        const complaint = await api.getComplaint(drawerId);
        if (cancelled) {
          return;
        }

        setDrawerComplaint(complaint);
        setOverrideCategory(complaint.category ?? '');
        setOverridePriority(complaint.priority ?? '');
        setOverrideReason('');
      } catch (error: unknown) {
        if (!cancelled) {
          setDrawerError(getErrorMessage(error, 'Failed to load complaint drawer'));
        }
      } finally {
        if (!cancelled) {
          setDrawerLoading(false);
        }
      }
    };

    void loadDrawer();

    return () => {
      cancelled = true;
    };
  }, [drawerId, isSupport]);

  useEffect(() => {
    if (!(isManager || isQa) || !drawerId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerComplaint(null);
        setDrawerLoading(false);
        setDrawerError(null);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('drawer');
          return next;
        });
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [drawerId, isManager, isQa, setSearchParams]);

  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      if (key !== 'page') {
        next.set('page', '1');
      }
      return next;
    });
  };

  const openDrawer = (id: string) => {
    if (isSupport) {
      navigate(`/admin/complaints/${id}`);
      return;
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('drawer', id);
      return next;
    });
  };

  const closeDrawer = () => {
    setDrawerComplaint(null);
    setDrawerLoading(false);
    setDrawerError(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('drawer');
      return next;
    });
  };

  const applyOverride = async () => {
    if (!drawerComplaint || !isManager) {
      return;
    }

    if (!overrideReason.trim()) {
      toast.error('Override reason is required');
      return;
    }

    const categoryChanged = overrideCategory && overrideCategory !== drawerComplaint.category;
    const priorityChanged = overridePriority && overridePriority !== drawerComplaint.priority;
    if (!categoryChanged && !priorityChanged) {
      toast.error('No override changes selected');
      return;
    }

    try {
      setOverrideSaving(true);
      const updated = await api.overrideComplaint(drawerComplaint.id, {
        category: categoryChanged ? (overrideCategory as Category) : undefined,
        priority: priorityChanged ? (overridePriority as Priority) : undefined,
        reason: overrideReason,
      });
      setDrawerComplaint(updated);
      setOverrideReason('');
      toast.success('Override applied');
      const refreshed = await api.getComplaints(paramsObject);
      setData(refreshed);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to apply override'));
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleRowKeyDown = (event: ReactKeyboardEvent<HTMLTableRowElement>, complaintId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDrawer(complaintId);
    }
  };

  if (error && !data && !stats) {
    return (
      <Card className="p-6 border-red-200/60 bg-red-50/50 text-red-900">
        <div className="font-semibold">Unable to load complaints</div>
        <div className="text-sm mt-1">{error}</div>
      </Card>
    );
  }

  if (loading || !data || !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px] text-sm text-zinc-500">
        Loading complaints…
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200/60 pb-5 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {isSupport
                ? 'Track and resolve your assigned complaints with SLA visibility.'
                : isQa
                  ? 'Read-only complaint quality review across all agents.'
                  : 'Operational view with filters, SLA status, and export scope.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isManager ? (
              <a href={api.exportBulkComplaintsUrl(paramsObject)} target="_blank" rel="noreferrer">
                <Button variant="secondary">Bulk Export</Button>
              </a>
            ) : null}
            {canCreateComplaint ? (
              <Button variant="primary" onClick={() => navigate('/admin/complaints/new')}>
                Submit New Complaint
              </Button>
            ) : null}
          </div>
        </div>

        {isSupport && agentAlerts && agentAlerts.alerts.length > 0 ? (
          <Card className="p-4 border-amber-200 bg-amber-50/70">
            <div className="text-sm text-amber-900">
              <span className="font-semibold">SLA alert:</span>{' '}
              {agentAlerts.alerts.slice(0, 2).map((alert, index) => {
                const left = alert.remainingMinutes <= 0 ? 'breached' : `${Math.ceil(alert.remainingMinutes)} mins left`;
                return (
                  <span key={alert.complaintId}>
                    {index > 0 ? ', ' : ''}
                    {alert.complaintId.slice(0, 10)} ({left})
                  </span>
                );
              })}
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-white border border-zinc-200/60">
            <h3 className="text-sm font-medium text-zinc-500 mb-1">Open Cases</h3>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{stats.open}</p>
          </Card>
          <Card className="p-5 bg-red-50/50 border border-red-200/60">
            <h3 className="text-sm font-medium text-red-800/80 mb-1">Triage Failed</h3>
            <p className="text-3xl font-bold tracking-tight text-red-700">{stats.triageFailed}</p>
          </Card>
          <Card className="p-5 bg-amber-50/50 border border-amber-200/60">
            <h3 className="text-sm font-medium text-amber-800/80 mb-1">High Priority Open</h3>
            <p className="text-3xl font-bold tracking-tight text-amber-700">{stats.highPriorityOpen}</p>
          </Card>
        </div>

        <Card className="p-4 overflow-hidden border-zinc-200/60">
          {isSupport ? (
            <div className="grid grid-cols-1 mb-4">
              <Input
                aria-label="Search complaints"
                autoComplete="off"
                placeholder="Search complaints"
                value={searchParams.get('search') || ''}
                onChange={(event) => updateFilter('search', event.target.value)}
                className="bg-zinc-50/50"
              />
            </div>
          ) : isQa ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-4">
              <Input
                aria-label="Search complaints"
                autoComplete="off"
                placeholder="Search complaints"
                value={searchParams.get('search') || ''}
                onChange={(event) => updateFilter('search', event.target.value)}
                className="bg-zinc-50/50"
              />
              <Select
                aria-label="Filter complaints by category"
                value={searchParams.get('category') || ''}
                onChange={(event) => updateFilter('category', event.target.value)}
                className="bg-zinc-50/50"
              >
                <option value="">All Categories</option>
                <option value="Product">Product</option>
                <option value="Packaging">Packaging</option>
                <option value="Trade">Trade</option>
              </Select>
              <Select
                aria-label="Filter complaints by priority"
                value={searchParams.get('priority') || ''}
                onChange={(event) => updateFilter('priority', event.target.value)}
                className="bg-zinc-50/50"
              >
                <option value="">All Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
              <Select
                aria-label="Filter complaints by status"
                value={searchParams.get('status') || ''}
                onChange={(event) => updateFilter('status', event.target.value)}
                className="bg-zinc-50/50"
              >
                <option value="">All Status</option>
                <option value="New">New</option>
                <option value="Triaged">Triaged</option>
                <option value="InProgress">In Progress</option>
                <option value="WaitingCustomer">Waiting Customer</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="TriageFailed">Triage Failed</option>
              </Select>
              <Select
                aria-label="Filter complaints by sentiment"
                value={searchParams.get('sentiment') || ''}
                onChange={(event) => updateFilter('sentiment', event.target.value)}
                className="bg-zinc-50/50"
              >
                <option value="">All Sentiment</option>
                {(['Angry', 'Frustrated', 'Neutral', 'Satisfied'] as Sentiment[]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Filter complaints from date"
                type="date"
                value={searchParams.get('from') || ''}
                onChange={(event) => updateFilter('from', event.target.value)}
                className="bg-zinc-50/50"
              />
              <Input
                aria-label="Filter complaints to date"
                type="date"
                value={searchParams.get('to') || ''}
                onChange={(event) => updateFilter('to', event.target.value)}
                className="bg-zinc-50/50"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-4">
              <Input
                aria-label="Search complaints"
                autoComplete="off"
                placeholder="Search complaints"
                value={searchParams.get('search') || ''}
                onChange={(event) => updateFilter('search', event.target.value)}
                className="bg-zinc-50/50"
              />
              <Input
                aria-label="Filter complaints by assigned agent"
                autoComplete="off"
                placeholder="Filter by agent"
                value={searchParams.get('assignedTo') || ''}
                onChange={(event) => updateFilter('assignedTo', event.target.value)}
                className="bg-zinc-50/50"
              />
              <Select
                aria-label="Filter complaints by category"
                value={searchParams.get('category') || ''}
                onChange={(event) => updateFilter('category', event.target.value)}
                className="bg-zinc-50/50"
              >
                <option value="">All Categories</option>
                <option value="Product">Product</option>
                <option value="Packaging">Packaging</option>
                <option value="Trade">Trade</option>
              </Select>
              <Select
                aria-label="Filter complaints by priority"
                value={searchParams.get('priority') || ''}
                onChange={(event) => updateFilter('priority', event.target.value)}
                className="bg-zinc-50/50"
              >
                <option value="">All Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
              <Select
                aria-label="Filter complaints by SLA status"
                value={searchParams.get('slaStatus') || ''}
                onChange={(event) => updateFilter('slaStatus', event.target.value)}
                className="bg-zinc-50/50"
              >
                <option value="">All SLA Status</option>
                <option value="safe">Safe</option>
                <option value="at_risk">At Risk</option>
                <option value="breached">Breached</option>
                <option value="met">Met</option>
              </Select>
              <Input
                aria-label="Filter complaints from date"
                type="date"
                value={searchParams.get('from') || ''}
                onChange={(event) => updateFilter('from', event.target.value)}
                className="bg-zinc-50/50"
              />
              <Input
                aria-label="Filter complaints to date"
                type="date"
                value={searchParams.get('to') || ''}
                onChange={(event) => updateFilter('to', event.target.value)}
                className="bg-zinc-50/50"
              />
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-zinc-200/60">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50/80 border-b border-zinc-200/60">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Complaint ID</th>
                  {(isManager || isQa) ? (
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agent</th>
                  ) : null}
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    {isSupport ? 'Priority + Sentiment' : 'Priority'}
                  </th>
                  {!isSupport ? (
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sentiment</th>
                  ) : null}
                  {isQa ? (
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Duplicate</th>
                  ) : null}
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">SLA</th>
                  {isManager ? (
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Repeat</th>
                  ) : null}
                  {!isQa ? (
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {data.data.length > 0 ? data.data.map((complaint) => {
                  const traffic = getSlaTraffic(complaint);
                  const rowTone =
                    traffic.state === 'red'
                      ? 'bg-red-50/40'
                      : traffic.state === 'amber'
                        ? 'bg-amber-50/40'
                        : 'hover:bg-zinc-50/80';

                  return (
                    <tr
                      key={complaint.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open complaint ${complaint.id.slice(0, 10)}`}
                      className={`transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 ${rowTone}`}
                      onClick={() => openDrawer(complaint.id)}
                      onKeyDown={(event) => handleRowKeyDown(event, complaint.id)}
                    >
                      <td className="px-4 py-3 font-mono text-zinc-600 text-xs">{complaint.id.slice(0, 10)}</td>
                      {(isManager || isQa) ? (
                        <td className="px-4 py-3 text-zinc-700">{complaint.assignedTo ?? 'Unassigned'}</td>
                      ) : null}
                      <td className="px-4 py-3 text-zinc-700">
                        <div>{complaint.customerName ?? 'Unknown'}</div>
                        {isSupport && complaint.isRepeatComplainant ? (
                          <Badge variant="warning" className="mt-1">Repeat Complainant</Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <div className="font-medium">
                          <Badge>{complaint.category ?? 'Untriaged'}</Badge>
                        </div>
                        <div className="text-xs text-zinc-500">{Math.round((complaint.confidence ?? 0) * 100)}% confidence</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <PriorityBadge priority={complaint.priority} />
                        {isSupport ? (
                          <div className="mt-1 text-xs text-zinc-600">
                            Sentiment {sentimentEmoji(complaint.sentiment)}
                          </div>
                        ) : null}
                      </td>
                      {!isSupport ? (
                        <td className="px-4 py-3 text-zinc-700">
                          <SentimentBadge sentiment={complaint.sentiment} score={complaint.sentimentScore} />
                        </td>
                      ) : null}
                      {isQa ? (
                        <td className="px-4 py-3 text-zinc-700">
                          {complaint.duplicateOfComplaintId ? <Badge variant="warning">Duplicate</Badge> : <Badge>None</Badge>}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-zinc-700">
                        {isQa ? (
                          <Badge variant={getQaSlaResult(complaint) === 'Breached' ? 'error' : getQaSlaResult(complaint) === 'Met' ? 'success' : 'default'}>
                            {getQaSlaResult(complaint)}
                          </Badge>
                        ) : (
                          <div className="space-y-1">
                            <SlaRing complaint={complaint} />
                            <SlaProgress complaint={complaint} />
                          </div>
                        )}
                      </td>
                      {isManager ? (
                        <td className="px-4 py-3 text-zinc-700">
                          {complaint.isRepeatComplainant ? <Badge variant="warning">Repeat</Badge> : <Badge>Single</Badge>}
                        </td>
                      ) : null}
                      {!isQa ? (
                        <td className="px-4 py-3 text-zinc-700">
                          <Badge
                            variant={
                              complaint.status === 'Resolved' || complaint.status === 'Closed'
                                ? 'success'
                                : complaint.status === 'TriageFailed'
                                  ? 'error'
                                  : 'default'
                            }
                          >
                            {complaint.status}
                          </Badge>
                        </td>
                      ) : null}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={tableColumnCount} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No complaints match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-100">
            <span className="text-sm text-zinc-500">
              Page <span className="font-medium text-zinc-900">{data.page}</span> of{' '}
              <span className="font-medium text-zinc-900">{data.totalPages}</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={data.page === 1}
                onClick={() => updateFilter('page', String(data.page - 1))}
                className="h-8 px-3 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={data.page === data.totalPages}
                onClick={() => updateFilter('page', String(data.page + 1))}
                className="h-8 px-3 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {(isManager || isQa) && drawerId ? (
        <div className="fixed inset-0 z-40 bg-black/25 flex justify-end" onClick={closeDrawer}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complaint-drawer-title"
            className="h-full w-full max-w-[560px] bg-white shadow-2xl border-l border-zinc-200 overflow-y-auto overscroll-contain"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-zinc-200 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">Complaint Drawer</div>
                <div id="complaint-drawer-title" className="font-semibold text-zinc-900">{drawerComplaint ? drawerComplaint.id.slice(0, 10) : drawerId.slice(0, 10)}</div>
              </div>
              <Button variant="secondary" onClick={closeDrawer}>Close</Button>
            </div>

            <div className="p-5 space-y-4">
              {drawerLoading ? (
                <div className="text-sm text-zinc-500">Loading complaint details…</div>
              ) : drawerError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{drawerError}</div>
              ) : !drawerComplaint ? (
                <div className="text-sm text-zinc-500">Complaint details are unavailable.</div>
              ) : (
                <>
                  <div className="rounded-lg border border-zinc-200 p-4 text-sm whitespace-pre-wrap text-zinc-800">{drawerComplaint.content}</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-zinc-200 p-3">
                      <div className="text-xs text-zinc-500 mb-1">Sentiment</div>
                      <SentimentBadge sentiment={drawerComplaint.sentiment} score={drawerComplaint.sentimentScore} />
                    </div>
                    <div className="rounded-lg border border-zinc-200 p-3">
                      <div className="text-xs text-zinc-500 mb-1">Category</div>
                      <div className="font-semibold text-zinc-900 mb-2">{drawerComplaint.category ?? 'Untriaged'}</div>
                      <ConfidenceBar confidence={drawerComplaint.confidence} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs text-zinc-500 mb-1">Priority</div>
                    <PriorityBadge priority={drawerComplaint.priority} />
                    <div className="text-xs text-zinc-600 mt-2">
                      {drawerComplaint.priorityReason ?? 'Priority is derived from sentiment and urgency keywords.'}
                    </div>
                  </div>

                  {drawerComplaint.duplicateOfComplaintId ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Duplicate complaint linked to {drawerComplaint.duplicateOfComplaintId}.
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs text-zinc-500 mb-2">Resolution Recommendations</div>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-800">
                      {drawerComplaint.actions.length > 0 ? (
                        drawerComplaint.actions.map((action) => <li key={action.id}>{action.action}</li>)
                      ) : (
                        <li>No recommendations available.</li>
                      )}
                    </ul>
                  </div>

                  {isManager ? (
                    <div className="rounded-lg border border-zinc-200 p-4 space-y-3">
                      <div className="text-xs text-zinc-500">Manager Override</div>
                      <Select aria-label="Override category" value={overrideCategory} onChange={(event) => setOverrideCategory(event.target.value as Category)}>
                        <option value="">Keep category</option>
                        <option value="Product">Product</option>
                        <option value="Packaging">Packaging</option>
                        <option value="Trade">Trade</option>
                      </Select>
                      <Select aria-label="Override priority" value={overridePriority} onChange={(event) => setOverridePriority(event.target.value as Priority)}>
                        <option value="">Keep priority</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </Select>
                      <Textarea
                        aria-label="Override reason"
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        rows={3}
                        placeholder="Override reason"
                      />
                      <Button onClick={applyOverride} disabled={overrideSaving || !canApplyOverride} className="w-full">
                        {overrideSaving ? 'Applying…' : 'Apply Override'}
                      </Button>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs text-zinc-500 mb-2">Timeline</div>
                    <div className="space-y-2">
                      {drawerComplaint.history.length > 0 ? (
                        drawerComplaint.history.map((item) => (
                          <div key={item.id} className="text-sm border border-zinc-100 rounded-md p-2">
                            <div className="font-medium text-zinc-900">{item.toStatus}</div>
                            <div className="text-xs text-zinc-500">{format(new Date(item.createdAt), 'PPp')} by {item.changedBy}</div>
                            {item.note ? <div className="text-xs text-zinc-700 mt-1">{item.note}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-zinc-500">No timeline events.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
