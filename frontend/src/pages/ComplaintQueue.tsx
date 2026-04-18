import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../api';
import { Badge, Button, Card, Input, Select } from '../components';
import { SlaRing, SentimentBadge } from '../complaint-ui';
import type { Complaint, Paginated, QueueStats, Sentiment } from '../types';

export function ComplaintQueue({ canCreateComplaint }: { canCreateComplaint: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<Paginated<Complaint> | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [agentAlerts, setAgentAlerts] = useState<{ breachedHigh: number; atRiskHigh: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const paramsObject = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [complaintsRes, statsRes, alertsRes] = await Promise.all([
          api.getComplaints(paramsObject),
          api.getQueueStats(),
          api.getAgentAlerts(),
        ]);
        setData(complaintsRes);
        setStats(statsRes);
        setAgentAlerts(alertsRes);
      } finally {
        setLoading(false);
      }
    };

    void fetchAll();
  }, [paramsObject]);

  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      if (!value) {
        prev.delete(key);
      } else {
        prev.set(key, value);
      }
      if (key !== 'page') {
        prev.set('page', '1');
      }
      return prev;
    });
  };

  if (loading || !data || !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px] text-sm text-zinc-500">
        Loading queue data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200/60 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">All Complaints + SLA Table</h1>
          <p className="text-sm text-zinc-500 mt-1">Filter by role, urgency, confidence, and repeat behavior.</p>
        </div>
        {canCreateComplaint ? (
          <Link to="/admin/complaints/new">
            <Button variant="primary">Submit New Complaint</Button>
          </Link>
        ) : null}
      </div>

      {agentAlerts ? (
        <Card className="p-4 border-zinc-200/70">
          <div className="text-sm text-zinc-700">
            <span className="font-semibold">My alerts:</span> {agentAlerts.breachedHigh} high-priority breached and{' '}
            {agentAlerts.atRiskHigh} high-priority near breach.
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <Input
            placeholder="Search by complaint text..."
            value={searchParams.get('search') || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="bg-zinc-50/50"
          />
          <Input
            placeholder="Filter by agent"
            value={searchParams.get('assignedTo') || ''}
            onChange={(e) => updateFilter('assignedTo', e.target.value)}
            className="bg-zinc-50/50"
          />
          <Select
            value={searchParams.get('status') || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
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
            value={searchParams.get('priority') || ''}
            onChange={(e) => updateFilter('priority', e.target.value)}
            className="bg-zinc-50/50"
          >
            <option value="">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </Select>
          <Select
            value={searchParams.get('sentiment') || ''}
            onChange={(e) => updateFilter('sentiment', e.target.value)}
            className="bg-zinc-50/50"
          >
            <option value="">All Sentiment</option>
            {(['Angry', 'Frustrated', 'Neutral', 'Satisfied'] as Sentiment[]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <Select
            value={searchParams.get('duplicateOnly') || ''}
            onChange={(e) => updateFilter('duplicateOnly', e.target.value)}
            className="bg-zinc-50/50"
          >
            <option value="">All Duplicate States</option>
            <option value="true">Duplicates Only</option>
            <option value="false">Non-duplicates</option>
          </Select>
          <Select
            value={searchParams.get('repeatOnly') || ''}
            onChange={(e) => updateFilter('repeatOnly', e.target.value)}
            className="bg-zinc-50/50"
          >
            <option value="">All Repeat States</option>
            <option value="true">Repeat Only</option>
            <option value="false">First-time Only</option>
          </Select>
          <Input
            placeholder="Confidence <= (0-1)"
            value={searchParams.get('confidenceLte') || ''}
            onChange={(e) => updateFilter('confidenceLte', e.target.value)}
            className="bg-zinc-50/50"
          />
          <Input
            placeholder="Confidence >= (0-1)"
            value={searchParams.get('confidenceGte') || ''}
            onChange={(e) => updateFilter('confidenceGte', e.target.value)}
            className="bg-zinc-50/50"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200/60">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50/80 border-b border-zinc-200/60">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Complaint ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agent</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Priority + Sentiment</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">SLA</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {data.data.map((complaint) => {
                const rowBg = complaint.resolutionDueAt && !complaint.resolvedAt
                  ? new Date(complaint.resolutionDueAt).getTime() < Date.now()
                    ? 'bg-red-50/30'
                    : new Date(complaint.resolutionDueAt).getTime() - Date.now() < 30 * 60 * 1000
                      ? 'bg-amber-50/30'
                      : ''
                  : '';

                return (
                  <tr key={complaint.id} className={`hover:bg-zinc-50/80 transition-colors group ${rowBg}`}>
                    <td className="px-4 py-3 font-mono text-zinc-600 text-xs">{complaint.id.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-zinc-700">{complaint.assignedTo ?? 'Unassigned'}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div>{complaint.customerName ?? 'Unknown'}</div>
                      {complaint.isRepeatComplainant ? (
                        <Badge variant="warning" className="mt-1">
                          Repeat Complainant ({complaint.repeatCount7d})
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div className="font-medium">{complaint.category ?? 'Untriaged'}</div>
                      <div className="text-xs text-zinc-500">{Math.round((complaint.confidence ?? 0) * 100)}% confidence</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div className="mb-1">
                        <Badge
                          variant={
                            complaint.priority === 'High'
                              ? 'error'
                              : complaint.priority === 'Medium'
                                ? 'warning'
                                : complaint.priority === 'Low'
                                  ? 'info'
                                  : 'default'
                          }
                        >
                          {complaint.priority ?? 'Untriaged'}
                        </Badge>
                      </div>
                      <SentimentBadge sentiment={complaint.sentiment} score={complaint.sentimentScore} />
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <SlaRing complaint={complaint} />
                    </td>
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
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/complaints/${complaint.id}`}
                        className="inline-flex items-center text-sm font-medium text-zinc-900 hover:underline"
                      >
                        Open Drawer
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
  );
}
