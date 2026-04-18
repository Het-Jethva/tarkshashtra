import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { api } from '../api';
import { Badge, Button, Card, Select, Textarea } from '../components';
import { ConfidenceBar, PriorityBadge, SentimentBadge, SlaProgress, SlaRing } from '../complaint-ui';
import { getErrorMessage } from '../lib/errors';
import { sentimentEmoji } from '../lib/complaint-ui';
import type { Category, Complaint, Priority, Status, UserRole } from '../types';

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  New: ['Triaged', 'TriageFailed'],
  Triaged: ['InProgress', 'WaitingCustomer', 'Resolved', 'Closed', 'TriageFailed'],
  InProgress: ['WaitingCustomer', 'Resolved', 'Closed'],
  WaitingCustomer: ['InProgress', 'Resolved', 'Closed'],
  Resolved: ['Closed', 'InProgress'],
  Closed: [],
  TriageFailed: ['Triaged', 'InProgress', 'WaitingCustomer', 'Resolved', 'Closed'],
};

export function ComplaintDetails({
  viewerRole,
  canUpdateStatus,
  canRetryTriage,
}: {
  viewerRole: UserRole;
  canUpdateStatus: boolean;
  canRetryTriage: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [nextStatus, setNextStatus] = useState<Status | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [overrideCategory, setOverrideCategory] = useState<Category | ''>('');
  const [overridePriority, setOverridePriority] = useState<Priority | ''>('');
  const [overrideReason, setOverrideReason] = useState('');

  const isSupport = viewerRole === 'support_executive';
  const isManager = viewerRole === 'operations_manager';

  useEffect(() => {
    let cancelled = false;

    const loadComplaint = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await api.getComplaint(id);
        if (cancelled) {
          return;
        }

        setComplaint(result);
        setNextStatus(result.status);
        setOverrideCategory(result.category ?? '');
        setOverridePriority(result.priority ?? '');
      } catch (error: unknown) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, 'Failed to load complaint'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadComplaint();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const availableStatuses = useMemo(() => {
    if (!complaint) {
      return [];
    }
    return ALLOWED_TRANSITIONS[complaint.status];
  }, [complaint]);

  const hasOverrideChanges = Boolean(
    complaint && (
      (overrideCategory && overrideCategory !== complaint.category) ||
      (overridePriority && overridePriority !== complaint.priority)
    ),
  );
  const canSubmitOverride = hasOverrideChanges && overrideReason.trim().length > 0;

  const handleStatusUpdate = async () => {
    if (!id || !nextStatus || !complaint) {
      return;
    }
    try {
      setIsUpdating(true);
      const updated = await api.updateStatus(id, {
        status: nextStatus,
        note: statusNote.trim() || undefined,
      });
      setComplaint(updated);
      setNextStatus(updated.status);
      setOverrideCategory(updated.category ?? '');
      setOverridePriority(updated.priority ?? '');
      toast.success('Status updated');
      setStatusNote('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetry = async () => {
    if (!id) {
      return;
    }
    try {
      setIsUpdating(true);
      const updated = await api.retryTriage(id);
      setComplaint(updated);
      setNextStatus(updated.status);
      setOverrideCategory(updated.category ?? '');
      setOverridePriority(updated.priority ?? '');
      toast.success('Triage retried');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to retry triage'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    if (!id) {
      return;
    }
    try {
      setIsUpdating(true);
      const updated = await api.submitAiFeedback(id, helpful);
      setComplaint(updated);
      setNextStatus(updated.status);
      setOverrideCategory(updated.category ?? '');
      setOverridePriority(updated.priority ?? '');
      toast.success('Feedback saved');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save feedback'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOverride = async () => {
    if (!id) {
      return;
    }
    if (!overrideReason.trim()) {
      toast.error('Override reason is required');
      return;
    }

    const categoryChanged = overrideCategory && overrideCategory !== complaint?.category;
    const priorityChanged = overridePriority && overridePriority !== complaint?.priority;
    if (!categoryChanged && !priorityChanged) {
      toast.error('No override changes selected');
      return;
    }

    try {
      setIsUpdating(true);
      const updated = await api.overrideComplaint(id, {
        category: categoryChanged ? (overrideCategory as Category) : undefined,
        priority: priorityChanged ? (overridePriority as Priority) : undefined,
        reason: overrideReason,
      });
      setComplaint(updated);
      setNextStatus(updated.status);
      setOverrideCategory(updated.category ?? '');
      setOverridePriority(updated.priority ?? '');
      toast.success('Override applied');
      setOverrideReason('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to override complaint'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading details…</div>;
  }

  if (!complaint) {
    return <div className="p-8">Complaint not found.</div>;
  }

  const showHelpfulPrompt =
    isSupport && (complaint.status === 'Resolved' || complaint.status === 'Closed');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <Link to="/admin/complaints" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center mb-4">
            &larr; Back to Complaints
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Complaint {complaint.id.slice(0, 10)}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Submitted on {format(new Date(complaint.createdAt), 'PPpp')} via {complaint.source}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
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
          <SlaRing complaint={complaint} />
          <SlaProgress complaint={complaint} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">Complaint Text</h2>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm whitespace-pre-wrap text-zinc-800">
                {complaint.content}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500 mb-1">Category</div>
                <div className="font-semibold text-zinc-900 mb-2">{complaint.category ?? 'Untriaged'}</div>
                <ConfidenceBar confidence={complaint.confidence} />
              </div>
              <div className="rounded-lg border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500 mb-1">Priority</div>
                <PriorityBadge priority={complaint.priority} />
                {complaint.priorityReason ? (
                  <div className="text-xs text-zinc-600 mt-2">{complaint.priorityReason}</div>
                ) : null}
              </div>
              <div className="rounded-lg border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500 mb-1">Sentiment</div>
                <div className="flex items-center gap-2">
                  <SentimentBadge sentiment={complaint.sentiment} score={complaint.sentimentScore} />
                  <span className="text-xs text-zinc-500">Tone {sentimentEmoji(complaint.sentiment)}</span>
                </div>
              </div>
            </div>

            {complaint.duplicateOfComplaintId ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Duplicate detected: linked to {complaint.duplicateOfComplaintId} (score{' '}
                {typeof complaint.duplicateScore === 'number' ? complaint.duplicateScore.toFixed(2) : 'n/a'}).
              </div>
            ) : null}

            {complaint.isRepeatComplainant ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Repeat complainant flag active ({complaint.repeatCount7d} complaints in 7 days).
              </div>
            ) : null}

            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-2">Resolution Recommendations</div>
              {complaint.summary ? <div className="text-sm text-zinc-700 mb-3">{complaint.summary}</div> : null}
              {complaint.actions.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {complaint.actions.map((action) => (
                    <li key={action.id} className="text-sm text-zinc-800">
                      <div>{action.action}</div>
                      <div className="text-xs text-zinc-500">
                        Owner: {action.owner} | Due: {format(new Date(action.dueAt), 'PPp')}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-zinc-500">No recommendations available.</div>
              )}
            </div>

            {complaint.triageStatus === 'failed' && canRetryTriage ? (
              <Button onClick={handleRetry} variant="danger" disabled={isUpdating}>
                Retry Triage
              </Button>
            ) : null}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Timeline</h2>
            <div className="space-y-3">
              {complaint.history.length > 0 ? (
                complaint.history.map((item) => (
                  <div key={item.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                    <div className="font-medium text-zinc-900">{item.toStatus}</div>
                    <div className="text-zinc-600 text-xs">
                      {format(new Date(item.createdAt), 'PPp')} by {item.changedBy}
                    </div>
                    {item.note ? <div className="text-zinc-700 mt-1">{item.note}</div> : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-500">No timeline events.</div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {isSupport && canUpdateStatus ? (
            <Card className="p-6 space-y-4">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Update Status</h2>
              <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as Status)}>
                <option value={complaint.status} disabled>
                  {complaint.status} (current)
                </option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
              <Textarea
                aria-label="Action note"
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
                rows={3}
                placeholder="Action note"
              />
              <Button
                disabled={isUpdating || nextStatus === complaint.status}
                onClick={handleStatusUpdate}
                className="w-full"
              >
                Save Status
              </Button>
            </Card>
          ) : null}

          {showHelpfulPrompt ? (
            <Card className="p-6 space-y-4">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">AI Feedback</h2>
              <div className="text-xs text-zinc-500">Was the AI recommendation helpful?</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => handleFeedback(true)} disabled={isUpdating}>
                  Thumbs Up
                </Button>
                <Button variant="secondary" onClick={() => handleFeedback(false)} disabled={isUpdating}>
                  Thumbs Down
                </Button>
              </div>
              {typeof complaint.aiHelpful === 'boolean' ? (
                <div className="text-xs text-zinc-600">
                  Last feedback: {complaint.aiHelpful ? 'Helpful' : 'Not Helpful'}
                </div>
              ) : null}
            </Card>
          ) : null}

          {isManager ? (
            <Card className="p-6 space-y-4">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Manager Override</h2>
              <Select
                aria-label="Override category"
                value={overrideCategory}
                onChange={(event) => setOverrideCategory(event.target.value as Category)}
              >
                <option value="">Keep category</option>
                <option value="Product">Product</option>
                <option value="Packaging">Packaging</option>
                <option value="Trade">Trade</option>
              </Select>
              <Select
                aria-label="Override priority"
                value={overridePriority}
                onChange={(event) => setOverridePriority(event.target.value as Priority)}
              >
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
                placeholder="Override reason (required)"
              />
              <Button onClick={handleOverride} disabled={isUpdating || !canSubmitOverride} className="w-full">
                Apply Override
              </Button>
              {complaint.managerOverridden ? (
                <div className="text-xs text-zinc-600">Latest override reason: {complaint.managerOverrideReason}</div>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
