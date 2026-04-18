import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '../api';
import type { Complaint, Paginated, QueueStats } from '../types';
import { Badge, Button, Card, Input, Select } from '../components';

export function ComplaintQueue({ canCreateComplaint }: { canCreateComplaint: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<Paginated<Complaint> | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);

  const fetchComplaints = async () => {
    const params = Object.fromEntries(searchParams.entries());
    const res = await api.getComplaints(params);
    setData(res);
  };

  const fetchStats = async () => {
    const res = await api.getQueueStats();
    setStats(res);
  };

  useEffect(() => {
    fetchComplaints();
    fetchStats();
  }, [searchParams]);

  const updateFilter = (key: string, value: string) => {
    setSearchParams(prev => {
      if (!value) prev.delete(key);
      else prev.set(key, value);
      prev.set('page', '1');
      return prev;
    });
  };

  if (!data || !stats) {
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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Complaints Queue</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage and track active customer issues.</p>
        </div>
        {canCreateComplaint ? (
          <Link to="/admin/complaints/new">
            <Button variant="primary">New Complaint</Button>
          </Link>
        ) : null}
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <Input
            placeholder="Search by ID or content..."
            value={searchParams.get('search') || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="bg-zinc-50/50"
          />
          <Select value={searchParams.get('status') || ''} onChange={(e) => updateFilter('status', e.target.value)} className="bg-zinc-50/50">
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Triaged">Triaged</option>
            <option value="InProgress">In Progress</option>
            <option value="WaitingCustomer">Waiting Customer</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
            <option value="TriageFailed">Triage Failed</option>
          </Select>
          <Select value={searchParams.get('priority') || ''} onChange={(e) => updateFilter('priority', e.target.value)} className="bg-zinc-50/50">
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </Select>
          <Select value={searchParams.get('category') || ''} onChange={(e) => updateFilter('category', e.target.value)} className="bg-zinc-50/50">
            <option value="">All Categories</option>
            <option value="Product">Product</option>
            <option value="Packaging">Packaging</option>
            <option value="Trade">Trade</option>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200/60">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50/80 border-b border-zinc-200/60">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {data.data.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors group">
                  <td className="px-4 py-3 font-mono text-zinc-500 text-xs">{c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-zinc-700 font-medium">{c.source}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === 'Resolved' || c.status === 'Closed' ? 'success' : c.status === 'TriageFailed' ? 'error' : 'default'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.triageResult?.priority === 'High' ? 'error' : c.triageResult?.priority === 'Medium' ? 'warning' : 'default'}>
                      {c.triageResult?.priority || 'Unknown'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{c.triageResult?.category || 'Uncategorized'}</td>
                  <td className="px-4 py-3 text-zinc-500">{format(new Date(c.createdAt), 'MMM dd, HH:mm')}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/complaints/${c.id}`} className="inline-flex items-center text-sm font-medium text-zinc-900 hover:underline">
                      View
                      <svg className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-100">
          <span className="text-sm text-zinc-500">
            Page <span className="font-medium text-zinc-900">{data.page}</span> of <span className="font-medium text-zinc-900">{data.totalPages}</span>
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
