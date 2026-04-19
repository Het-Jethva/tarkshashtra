import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../api';
import { Card, Input } from '../components';
import { getErrorMessage } from '../lib/errors';
import type { ManagerOverview } from '../types';

type DashboardProps = {
  canExport: boolean;
  canStream: boolean;
  streamUrl: string;
};

const MANAGER_CATEGORIES = ['Product', 'Packaging', 'Trade'] as const;
const MANAGER_PRIORITIES = ['High', 'Medium', 'Low'] as const;

export function Dashboard({ canExport, canStream: _canStream, streamUrl: _streamUrl }: DashboardProps) {
  void _canStream;
  void _streamUrl;

  const [baseOverview, setBaseOverview] = useState<ManagerOverview | null>(null);
  const [scopedOverview, setScopedOverview] = useState<ManagerOverview | null>(null);
  const [agentSearch, setAgentSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const agentTableRef = useRef<HTMLDivElement | null>(null);

  void _canStream;
  void _streamUrl;

  useEffect(() => {
    let cancelled = false;

    const loadBase = async () => {
      setLoading(true);
      try {
        const manager = await api.getManagerOverview();
        if (cancelled) {
          return;
        }

        setBaseOverview(manager);
        setError(null);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(error, 'Failed to load manager dashboard'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadBase();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadScoped = async () => {
      if (!selectedAgent) {
        setScopedOverview(baseOverview);
        return;
      }

      try {
        const manager = await api.getManagerOverview(selectedAgent);
        if (cancelled) {
          return;
        }

        setScopedOverview(manager);
        setError(null);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(error, 'Failed to filter manager charts by agent'));
      }
    };

    void loadScoped();

    return () => {
      cancelled = true;
    };
  }, [baseOverview, selectedAgent]);

  useEffect(() => {
    if (!selectedAgent) {
      return;
    }

    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (agentTableRef.current && target && !agentTableRef.current.contains(target)) {
        setSelectedAgent('');
      }
    };

    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('touchstart', handleOutsidePointer);

    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('touchstart', handleOutsidePointer);
    };
  }, [selectedAgent]);

  if (error) {
    return (
      <Card className="p-6 border-red-200/60 bg-red-50/50 text-red-900">
        <div className="font-semibold">Unable to load manager dashboard</div>
        <div className="text-sm mt-1">{error}</div>
      </Card>
    );
  }

  if (loading || !baseOverview || !scopedOverview) {
    return <div className="p-8 text-sm text-zinc-500">Loading manager dashboard…</div>;
  }

  const workloadRows =
    agentSearch.trim().length > 0
      ? baseOverview.agentWorkload.filter((row) =>
          row.agentName.toLowerCase().includes(agentSearch.trim().toLowerCase()),
        )
      : baseOverview.agentWorkload;

  const categoryByName = new Map(scopedOverview.categoryOpenResolved.map((row) => [row.category, row]));
  const categoryChartData = MANAGER_CATEGORIES.map((category) => {
    const row = categoryByName.get(category);
    return {
      category,
      Open: row?.Open ?? 0,
      Resolved: row?.Resolved ?? 0,
    };
  });

  const priorityByKey = new Map(scopedOverview.priorityDistribution.map((row) => [row.key, row.count]));
  const priorityPieData = MANAGER_PRIORITIES.map((priority) => ({
    name: priority,
    value: priorityByKey.get(priority) ?? 0,
  }));
  const totalOpenPriorityCount = priorityPieData.reduce((sum, row) => sum + row.value, 0);

  const agentPerformanceData = scopedOverview.agentWorkload.map((row) => ({
    name: row.agentName,
    score: row.performanceScore,
    slaMetPercent: row.slaMetPercent,
    avgResolutionHours: row.avgResolutionHours,
    resolvedCount: row.resolvedCount,
    assignedCount: row.assignedCount,
  }));

  const resolutionTimeTrendData = [...scopedOverview.resolutionTimeTrend]
    .filter((row) => Number.isFinite(row.avgResolutionHours))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const date = new Date(row.date);
      const isValidDate = !Number.isNaN(date.getTime());
      return {
        ...row,
        shortDate: isValidDate ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : row.date,
        fullDate: isValidDate
          ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          : row.date,
      };
    });

  const handleRowKeyDown = (event: ReactKeyboardEvent<HTMLTableRowElement>, agentName: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedAgent((prev) => (prev === agentName ? '' : agentName));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200/60 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Manager Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Resolution progress, open priority load, and team performance.</p>
        </div>
        <div className="flex items-center gap-3">
          {canExport ? (
            <Link
              to="/admin/reports"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors bg-white border border-zinc-200/80 rounded-lg px-3 py-1.5"
            >
              Open Reports
            </Link>
          ) : null}
          <Link
            to="/admin/complaints"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors bg-white border border-zinc-200/80 rounded-lg px-3 py-1.5"
          >
            Open Complaints
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Complaints Today" value={scopedOverview.kpis.totalComplaintsToday} />
        <MetricCard title="SLA Compliance" value={`${scopedOverview.kpis.slaCompliancePercent}%`} />
        <MetricCard title="Avg Resolution Time" value={`${scopedOverview.kpis.avgResolutionTimeHours}h`} />
        <MetricCard title="Open High Priority" value={scopedOverview.kpis.openHighPriorityNow} />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[15px] font-semibold text-zinc-900">Agent Workload & SLA Alert Panel</h2>
          <Input
            aria-label="Search agents"
            autoComplete="off"
            placeholder="Search agent"
            value={agentSearch}
            onChange={(event) => setAgentSearch(event.target.value)}
            className="max-w-[220px]"
          />
        </div>
        <div ref={agentTableRef} className="overflow-x-auto rounded-lg border border-zinc-200/70">
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
              {workloadRows.length > 0 ? (
                workloadRows.map((row) => {
                  const isSelected = selectedAgent === row.agentName;
                  return (
                    <tr
                      key={row.agentName}
                      role="button"
                      tabIndex={0}
                      aria-label={`Filter dashboard for ${row.agentName}`}
                      className={`cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 ${isSelected ? 'bg-blue-50' : row.slaBreachedCount > 0 ? 'bg-red-50/60' : 'hover:bg-zinc-50'}`}
                      onClick={() => setSelectedAgent((prev) => (prev === row.agentName ? '' : row.agentName))}
                      onKeyDown={(event) => handleRowKeyDown(event, row.agentName)}
                    >
                      <td className="px-3 py-2 font-medium text-zinc-800">{row.agentName}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.openComplaints}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.highPriorityCount}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.slaBreachedCount}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.performanceScore}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                    No agents match the current search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Complaints by Category Bar Chart</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Compares open vs resolved complaints for Product, Packaging, and Trade to show category resolution progress.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="category"
                  label={{ value: 'X-axis: Category', position: 'insideBottom', offset: -6, style: { fill: '#52525b', fontSize: 12 } }}
                />
                <YAxis
                  allowDecimals={false}
                  label={{ value: 'Y-axis: Complaint Count', angle: -90, position: 'insideLeft', style: { fill: '#52525b', fontSize: 12 } }}
                />
                <Tooltip
                  labelFormatter={(label) => `Category: ${label}`}
                  formatter={(value, name) => [`${value ?? 0} complaints`, String(name)]}
                />
                <Legend verticalAlign="top" height={28} />
                <Bar dataKey="Open" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Priority Distribution Donut</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Shows currently open complaints by priority level: High, Medium, and Low.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityPieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={42}>
                  {priorityPieData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.name === 'High' ? '#ef4444' : item.name === 'Medium' ? '#f59e0b' : '#22c55e'}
                    />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={24} />
                <Tooltip
                  formatter={(value, name) => {
                    const count = Number(value ?? 0);
                    const percent = totalOpenPriorityCount > 0 ? Math.round((count / totalOpenPriorityCount) * 100) : 0;
                    return [`${count} open complaints (${percent}%)`, String(name)];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-zinc-500 mt-2">X-axis: Priority Levels | Y-axis: Open Complaint Count</div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Resolution Time Trend — Last 14 Days</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Average time taken to resolve complaints for each resolved day in the last 14 days.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={resolutionTimeTrendData} margin={{ top: 8, right: 12, left: 8, bottom: 20 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  label={{ value: 'Date', position: 'insideBottom', offset: -6, style: { fill: '#52525b', fontSize: 12 } }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  allowDecimals={false}
                  label={{ value: 'Avg Hours', angle: -90, position: 'insideLeft', style: { fill: '#52525b', fontSize: 12 } }}
                />
                <Tooltip
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { fullDate?: string } | undefined;
                    return row?.fullDate ?? String(label);
                  }}
                  formatter={(value) => {
                    const normalized = Number(value ?? 0);
                    return [`${Number(normalized.toFixed(2))} hrs`, 'Avg Hours'];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgResolutionHours"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#4F46E5', stroke: '#4F46E5' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Agent Performance Bar Chart</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Shows per-agent performance score (0-100) based on SLA met rate, resolution speed, and resolved volume.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentPerformanceData} margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="name"
                  label={{ value: 'X-axis: Agent Name', position: 'insideBottom', offset: -6, style: { fill: '#52525b', fontSize: 12 } }}
                />
                <YAxis
                  domain={[0, 100]}
                  label={{ value: 'Y-axis: Performance Score (0-100)', angle: -90, position: 'insideLeft', style: { fill: '#52525b', fontSize: 12 } }}
                />
                <Tooltip
                  labelFormatter={(label) => `Agent: ${label}`}
                  formatter={(value, name, item) => {
                    if (name !== 'score') {
                      return [String(value ?? ''), String(name)];
                    }

                    const payload = item?.payload as
                      | {
                          slaMetPercent?: number;
                          avgResolutionHours?: number;
                          resolvedCount?: number;
                          assignedCount?: number;
                        }
                      | undefined;

                    const score = Number(value ?? 0);
                    const sla = payload?.slaMetPercent ?? 0;
                    const avg = payload?.avgResolutionHours ?? 0;
                    const resolved = payload?.resolvedCount ?? 0;
                    const assigned = payload?.assignedCount ?? 0;

                    return [
                      `Score ${score} | SLA ${sla}% | Avg ${avg.toFixed(2)}h | Resolved ${resolved}/${assigned}`,
                      'Performance',
                    ];
                  }}
                />
                <Bar dataKey="score" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card className="p-5">
      <h3 className="text-[13px] font-medium text-zinc-500 mb-2">{title}</h3>
      <p className="text-3xl font-bold tracking-tight text-zinc-900">{value}</p>
    </Card>
  );
}
