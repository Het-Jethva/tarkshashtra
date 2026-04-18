import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { api } from '../api';
import { Card } from '../components';
import type { QaTrends } from '../types';

const SENTIMENT_COLORS: Record<string, string> = {
  Angry: '#ef4444',
  Frustrated: '#f59e0b',
  Neutral: '#64748b',
  Satisfied: '#10b981',
  Unknown: '#a1a1aa',
};

export function QaDashboard() {
  const [trends, setTrends] = useState<QaTrends | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.getQaTrends();
        setTrends(result);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load QA trends');
      }
    };

    void load();
  }, []);

  const sentimentData = useMemo(() => trends?.sentimentDistribution ?? [], [trends]);

  if (error) {
    return (
      <Card className="p-6 border-red-200/60 bg-red-50/50 text-red-900">
        <div className="font-semibold">Unable to load QA dashboard</div>
        <div className="text-sm mt-1">{error}</div>
      </Card>
    );
  }

  if (!trends) {
    return <div className="p-8 text-sm text-zinc-500">Loading QA trends...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Trends & QA Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Model confidence, sentiment, and retraining candidates.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Complaints This Week" value={trends.thisWeekComplaints} />
        <StatCard title="Average AI Confidence" value={`${trends.avgConfidencePercent}%`} />
        <StatCard title="SLA Met" value={`${trends.slaMetPercent}%`} />
        <StatCard title="AI Helpful" value={`${trends.aiHelpfulnessPercent}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Keyword Frequency</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends.keywordFrequency}>
                <XAxis dataKey="key" angle={-20} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Complaints Over Time</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.complaintsOverTime}>
                <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} />
                <YAxis />
                <Tooltip />
                <Line dataKey="Product" stroke="#2563eb" strokeWidth={2} />
                <Line dataKey="Packaging" stroke="#f59e0b" strokeWidth={2} />
                <Line dataKey="Trade" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Sentiment Distribution</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sentimentData} dataKey="count" nameKey="key" outerRadius={90} innerRadius={40}>
                  {sentimentData.map((entry) => (
                    <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key] ?? '#a1a1aa'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Confidence Distribution</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends.confidenceBands}>
                <XAxis dataKey="key" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {trends.confidenceBands.map((band) => (
                    <Cell
                      key={band.key}
                      fill={band.key === '71-100' ? '#10b981' : band.key === '41-70' ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Low Confidence Complaints (&lt;60%)</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200/70">
          <table className="w-full text-sm text-left bg-white">
            <thead className="bg-zinc-50 border-b border-zinc-200/70">
              <tr>
                <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Complaint ID</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Customer</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Category</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Confidence</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Retraining</th>
              </tr>
            </thead>
            <tbody>
              {trends.lowConfidenceComplaints.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-600">{row.id.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.customerName ?? 'Unknown'}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.category ?? 'Untriaged'}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {typeof row.confidence === 'number' ? `${Math.round(row.confidence * 100)}%` : 'N/A'}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{row.needsRetraining ? 'Flagged' : 'Pending Review'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="p-5">
      <div className="text-[13px] text-zinc-500 mb-2">{title}</div>
      <div className="text-3xl font-bold tracking-tight text-zinc-900">{value}</div>
    </Card>
  );
}
