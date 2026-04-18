import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '../api';
import type { Complaint, Status } from '../types';
import { Badge, Button, Card, Select, Textarea } from '../components';
import { toast } from 'sonner';

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
  canUpdateStatus,
  canRetryTriage,
}: {
  canUpdateStatus: boolean;
  canRetryTriage: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<Status | ''>('');
  const [note, setNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchComplaint = async () => {
    try {
      if (!id) return;
      const res = await api.getComplaint(id);
      setComplaint(res);
      setUpdateStatus(res.status);
    } catch (err: any) {
      toast.error('Failed to load complaint');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaint();
  }, [id]);

  const handleUpdate = async () => {
    if (!id || !updateStatus) return;
    try {
      setIsUpdating(true);
      await api.updateStatus(id, { status: updateStatus as Status, note });
      toast.success('Status updated');
      setNote('');
      await fetchComplaint();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetryTriage = async () => {
    if (!id) return;
    try {
      setIsUpdating(true);
      await api.retryTriage(id);
      toast.success('Triage queued');
      await fetchComplaint();
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry triage');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="p-8">Loading details...</div>;
  if (!complaint) return <div className="p-8">Complaint not found.</div>;

  const availableStatuses = ALLOWED_TRANSITIONS[complaint.status];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <Link to="/admin/complaints" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center mb-4">
            &larr; Back to Queue
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-3">
            <span>Complaint</span>
            <span className="font-mono text-xl text-zinc-500">#{complaint.id.split('-')[0]}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Created on {format(new Date(complaint.createdAt), 'PPpp')} via <span className="font-semibold">{complaint.source}</span>
          </p>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <Badge variant={complaint.status === 'Resolved' || complaint.status === 'Closed' ? 'success' : complaint.status === 'TriageFailed' ? 'error' : 'default'} className="text-lg px-3 py-1">
            {complaint.status}
          </Badge>
          <Badge variant={complaint.triageStatus === 'success' ? 'success' : complaint.triageStatus === 'failed' ? 'error' : 'warning'}>
            Triage: {complaint.triageStatus}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">Original Content</h2>
              <div className="bg-zinc-50 p-4 rounded-sm font-mono text-sm border border-zinc-200 text-zinc-800 whitespace-pre-wrap">
                {complaint.content}
              </div>
            </div>
            
            {complaint.triageResult && (
              <div className="border-t border-zinc-200 pt-6">
                <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                  AI Triage Analysis
                  <span className="text-xs font-mono bg-zinc-100 px-2 py-1 rounded-full border border-zinc-200">
                    Confidence: {(complaint.triageResult.confidence * 100).toFixed(0)}%
                  </span>
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-zinc-50 p-3 rounded-sm border border-zinc-200">
                    <span className="block text-xs font-medium text-zinc-500 mb-1">Category</span>
                    <span className="font-semibold">{complaint.triageResult.category}</span>
                  </div>
                  <div className="bg-zinc-50 p-3 rounded-sm border border-zinc-200">
                    <span className="block text-xs font-medium text-zinc-500 mb-1">Priority</span>
                    <span className={`font-semibold ${complaint.triageResult.priority === 'High' ? 'text-red-600' : complaint.triageResult.priority === 'Medium' ? 'text-amber-600' : 'text-blue-600'}`}>
                      {complaint.triageResult.priority}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="block text-xs font-medium text-zinc-500 mb-2">Reasoning</span>
                  <p className="text-sm text-zinc-800 leading-relaxed bg-zinc-50 p-3 rounded-sm border border-zinc-200">
                    {complaint.triageResult.reasoning}
                  </p>
                </div>

                {complaint.triageResult.recommendedActions && complaint.triageResult.recommendedActions.length > 0 && (
                  <div>
                    <span className="block text-xs font-medium text-zinc-500 mb-2">Recommended Actions</span>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-800 bg-zinc-50 p-3 rounded-sm border border-zinc-200">
                      {complaint.triageResult.recommendedActions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {complaint.triageStatus === 'failed' && (
              <div className="border-t border-zinc-200 pt-6">
                <div className="bg-red-50 text-red-800 p-4 border border-red-200 rounded-sm flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Triage Failed</h3>
                    <p className="text-sm">The AI system was unable to automatically categorize this complaint.</p>
                  </div>
                  {canRetryTriage ? (
                    <Button onClick={handleRetryTriage} variant="danger" disabled={isUpdating}>
                      Retry Triage
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Customer Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="block text-zinc-500">Name</span>
                <span className="font-semibold text-zinc-900">{complaint.customerName || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-zinc-500">Contact</span>
                <span className="font-semibold text-zinc-900">{complaint.customerContact || 'N/A'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Update Status</h2>
            {!canUpdateStatus ? (
              <div className="text-sm text-zinc-500 bg-zinc-50 p-3 rounded-sm border border-zinc-200 text-center">
                Your role has read-only access for complaint details.
              </div>
            ) : availableStatuses.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">New Status</label>
                  <Select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value as Status)}>
                    <option value={complaint.status} disabled>{complaint.status} (Current)</option>
                    {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Internal Note (Optional)</label>
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Action taken..."
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleUpdate}
                  disabled={isUpdating || updateStatus === complaint.status}
                >
                  {isUpdating ? 'Updating...' : 'Save Update'}
                </Button>
              </div>
            ) : (
              <div className="text-sm text-zinc-500 bg-zinc-50 p-3 rounded-sm border border-zinc-200 text-center">
                No further status transitions available.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
