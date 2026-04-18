import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { api } from '../api';
import { Card } from '../components';
import { SlaRing } from '../complaint-ui';
import type { DashboardSummary, ManagerOverview, SlaOverview } from '../types';

export function Dashboard({
  canExport,
  canStream,
  streamUrl,
}: {
  canExport: boolean;
  canStream: boolean;
  streamUrl: string;
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sla, setSla] = useState<SlaOverview | null>(null);
  const [managerOverview, setManagerOverview] = useState<ManagerOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [agentAlerts, setAgentAlerts] = useState<{ breachedHigh: number; atRiskHigh: number } | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sum, sl, manager, alerts] = await Promise.all([
        api.getDashboardSummary(),
        api.getSlaOverview(),
        api.getManagerOverview(),
        api.getAgentAlerts(),
      ]);
      setSummary(sum);
      setSla(sl);
      setManagerOverview(manager);
      setAgentAlerts(alerts);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load telemetry');
    }
  }, []);

  useEffect(() => {
    void loadData();

    if (!canStream) {
      return;
    }

    const eventSource = new EventSource(streamUrl);
    const refreshDashboard = () => {
      void loadData();
    };

    const refreshEvents = [
      'complaint.triaged',
      'complaint.triage_failed',
      'complaint.status_updated',
      'complaint.overridden',
      'complaint.ai_feedback',
      'sla.updated',
    ] as const;
    refreshEvents.forEach((eventName) => {
      eventSource.addEventListener(eventName, refreshDashboard);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        eventSource.removeEventListener(eventName, refreshDashboard);
      });
      eventSource.close();
    };
  }, [canStream, loadData, streamUrl]);

  if (error) {
    return (
      <div className="p-8">
        <Card className="p-6 border-red-200/60 bg-red-50/50 text-red-900 shadow-sm">
          <div className="font-semibold text-sm mb-1">Error Loading Dashboard</div>
          <div className="text-sm text-red-700/80">{error}</div>
        </Card>
      </div>
    );
  }

  if (!summary || !sla || !managerOverview) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px] text-sm text-zinc-500">
        Loading dashboard metrics...
      </div>
    );
  }

  const workloadRows =
    agentFilter.trim().length > 0
      ? managerOverview.agentWorkload.filter((row) =>
          row.agentName.toLowerCase().includes(agentFilter.trim().toLowerCase()),
        )
      : managerOverview.agentWorkload;

  const firstResponseWarnings = sla.warningsByMetric.find((row) => row.key === 'first_response')?.count ?? 0;
  const firstResponseBreaches = sla.breachesByMetric.find((row) => row.key === 'first_response')?.count ?? 0;
  const resolutionWarnings = sla.warningsByMetric.find((row) => row.key === 'resolution')?.count ?? 0;
  const resolutionBreaches = sla.breachesByMetric.find((row) => row.key === 'resolution')?.count ?? 0;

  const categoryChartData = managerOverview.categoryOpenResolved.map((row) => ({
    category: row.category,
    Open: row.Open,
    Resolved: row.Resolved,
  }));

  const priorityPieData = managerOverview.priorityDistribution.map((row) => ({
    name: row.key,
    value: row.count,
  }));

  const performanceChartData = workloadRows.map((row) => ({
    name: row.agentName,
    score: row.performanceScore,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200/60 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Operations Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Real-time workload, SLA risk, and team performance.</p>
        </div>
        <div className="flex items-center gap-3">
          {canExport ? (
            <Link
              to="/admin/reports"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors bg-white border border-zinc-200/80 rounded-lg px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-zinc-50"
            >
              Open Reports
            </Link>
          ) : null}
          <Link
            to="/admin/complaints"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors bg-white border border-zinc-200/80 rounded-lg px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-zinc-50"
          >
            Open Complaints
          </Link>
        </div>
      </div>

      {agentAlerts ? (
        <Card className="p-4 border-zinc-200/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">My High Priority Alerts</div>
              <div className="text-sm text-zinc-700 mt-1">
                {agentAlerts.breachedHigh} breached, {agentAlerts.atRiskHigh} near breach in next 30 minutes.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Urgency</span>
              <SlaRing
                complaint={{
                  id: 'preview',
                  source: 'call',
                  content: 'preview',
                  status: 'InProgress',
                  triageStatus: 'success',
                  isRepeatComplainant: false,
                  repeatCount7d: 0,
                  needsRetraining: false,
                  managerOverridden: false,
                  actions: [],
                  overrides: [],
                  history: [],
                  triageRuns: [],
                  slaEvents: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  firstResponseDueAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                }}
              />
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Complaints Today" value={managerOverview.kpis.totalComplaintsToday} />
        <MetricCard title="SLA Compliance" value={`${managerOverview.kpis.slaCompliancePercent}%`} />
        <MetricCard title="Avg Resolution Time" value={`${managerOverview.kpis.avgResolutionTimeHours}h`} />
        <MetricCard
          title="Open High Priority"
          value={managerOverview.kpis.openHighPriorityNow}
          alert={managerOverview.kpis.openHighPriorityNow > 0}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-zinc-900">Agent Workload & SLA Alert Panel</h2>
          <input
            placeholder="Filter by agent"
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="h-9 rounded-lg border border-zinc-200/70 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>
        <div ref={tableRef} className="overflow-x-auto rounded-lg border border-zinc-200/70">
          <table className="w-full text-sm text-left bg-white">
            <thead className="bg-zinc-50 border-b border-zinc-200/70">
              <tr>
                <th className="px-3 py-2 font-semibold text-zinc-600">Agent Name</th>
                <th className="px-3 py-2 font-semibold text-zinc-600">Open Complaints</th>
                <th className="px-3 py-2 font-semibold text-zinc-600">High Priority</th>
                <th className="px-3 py-2 font-semibold text-zinc-600">SLA Breached</th>
                <th className="px-3 py-2 font-semibold text-zinc-600">Performance Score</th>
              </tr>
            </thead>
            <tbody>
              {workloadRows.map((row) => (
                <tr key={row.agentName} className={row.slaBreachedCount > 0 ? 'bg-red-50/60' : ''}>
                  <td className="px-3 py-2 font-medium text-zinc-800">{row.agentName}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.openComplaints}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.highPriorityCount}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.slaBreachedCount}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                      {row.performanceScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Complaints by Category</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Open" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resolved" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Priority Distribution</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityPieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={40}>
                  {priorityPieData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={
                        item.name === 'High'
                          ? '#ef4444'
                          : item.name === 'Medium'
                            ? '#f59e0b'
                            : item.name === 'Low'
                              ? '#10b981'
                              : '#71717a'
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Resolution Time Trend</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={managerOverview.resolutionTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="avgResolutionHours" stroke="#18181b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Agent Performance Score</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MetricCard title="First Response Warnings" value={firstResponseWarnings} />
        <MetricCard title="First Response Breaches" value={firstResponseBreaches} alert={firstResponseBreaches > 0} />
        <MetricCard title="Resolution Breaches" value={resolutionBreaches} alert={resolutionBreaches > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <MetricCard title="AI Helpfulness" value={`${summary.kpis.aiHelpfulnessPercent}%`} />
        <MetricCard title="AI Confidence Avg" value={`${summary.kpis.avgAiConfidencePercent}%`} />
        <MetricCard title="Repeat Complainants" value={summary.kpis.repeatComplainantCount} />
        <MetricCard title="Duplicate Complaints" value={summary.kpis.duplicateComplaintsCount} />
      </div>

      <div className="text-xs text-zinc-500">Resolution warnings tracked: {resolutionWarnings}</div>
    </div>
  );
}

function MetricCard({ title, value, alert }: { title: string; value: number | string; alert?: boolean }) {
  return (
    <Card className="p-5 flex flex-col justify-between bg-white">
      <h3 className="text-[13px] font-medium text-zinc-500 mb-2">{title}</h3>
      <p className={`text-3xl font-bold tracking-tight ${alert ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
    </Card>
  );
}
