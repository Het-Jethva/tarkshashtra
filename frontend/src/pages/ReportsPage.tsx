import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import { api } from '../api';
import { Button, Card, Input, Select } from '../components';
import type { ReportPreviewRow } from '../types';

export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [agent, setAgent] = useState('');
  const [rows, setRows] = useState<ReportPreviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (category) params.category = category;
    if (agent) params.agent = agent;
    return params;
  }, [from, to, category, agent]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getReportPreview(query);
        setRows(data);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [query]);

  const exportCsvUrl = api.exportReportsUrl('csv', query);
  const exportPdfUrl = api.exportReportsUrl('pdf', query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Reports</h1>
        <p className="text-sm text-zinc-500 mt-1">Filter data and export CSV/PDF packages.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All Categories</option>
            <option value="Product">Product</option>
            <option value="Packaging">Packaging</option>
            <option value="Trade">Trade</option>
          </Select>
          <Input placeholder="Agent name" value={agent} onChange={(event) => setAgent(event.target.value)} />
        </div>
        <div className="flex gap-3">
          <a href={exportCsvUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">Download CSV</Button>
          </a>
          <a href={exportPdfUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">Download PDF</Button>
          </a>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Preview ({rows.length})</h2>
        {loading ? (
          <div className="text-sm text-zinc-500">Loading preview...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200/70">
            <table className="w-full text-sm text-left bg-white">
              <thead className="bg-zinc-50 border-b border-zinc-200/70">
                <tr>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">ID</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Date</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Agent</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Customer</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Category</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Priority</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Sentiment</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Confidence</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600">{row.id.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-zinc-700">{format(new Date(row.createdAt), 'PPp')}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.assignedTo ?? 'Unassigned'}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.customerName ?? 'Unknown'}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.category ?? 'Untriaged'}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.priority ?? 'Untriaged'}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.sentiment ?? 'Unknown'}</td>
                    <td className="px-3 py-2 text-zinc-700">
                      {typeof row.confidencePercent === 'number' ? `${row.confidencePercent}%` : 'N/A'}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
