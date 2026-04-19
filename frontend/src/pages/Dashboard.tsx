import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Label,
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 25 } },
  };

  return (
    <motion.div 
      variants={containerVariants} 
      initial="hidden" 
      animate="show" 
      className="space-y-6 lg:space-y-8"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200/50 pb-6 gap-4 relative">
        <div className="absolute -left-8 -top-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 flex items-center gap-3">
            <span className="bg-zinc-950 text-white p-2 rounded-xl shadow-lg shadow-zinc-900/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bar-chart-2"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
            </span>
            Manager Overview
          </h1>
          <p className="text-[15px] text-zinc-500 mt-2 max-w-2xl">Monitor real-time resolution progress, open priority load, and overall team performance metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          {canExport ? (
            <Link
              to="/admin/reports"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-all bg-white border border-zinc-200/80 rounded-xl px-4 py-2 shadow-sm hover:shadow-md hover:border-zinc-300"
            >
              Export Reports
            </Link>
          ) : null}
          <Link
            to="/admin/complaints"
            className="text-sm font-medium text-white bg-zinc-950 hover:bg-zinc-800 transition-all rounded-xl px-4 py-2 shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] flex items-center gap-2"
          >
            Manage Queue
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 relative">
        <MetricCard title="Total Incoming" value={scopedOverview.kpis.totalComplaintsToday} trend="+12%" trendUp />
        <MetricCard title="SLA Compliance" value={`${scopedOverview.kpis.slaCompliancePercent}%`} trend="-2%" trendUp={false} />
        <MetricCard title="Avg Resolution" value={`${scopedOverview.kpis.avgResolutionTimeHours}h`} trend="-0.5h" trendUp />
        <MetricCard title="Critical Open" value={scopedOverview.kpis.openHighPriorityNow} variant="critical" />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none transition-opacity duration-500 opacity-50 group-hover:opacity-100" />
          <div className="relative flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Agent Command Center</h2>
              <p className="text-sm text-zinc-500 mt-1">Select an agent to filter the entire dashboard by their specific workload.</p>
            </div>
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <Input
                aria-label="Search agents"
                autoComplete="off"
                placeholder="Search roster..."
                value={agentSearch}
                onChange={(event) => setAgentSearch(event.target.value)}
                className="max-w-[260px] pl-9 bg-zinc-50/50 border-zinc-200/80 rounded-xl focus:bg-white"
              />
            </div>
          </div>
          <div ref={agentTableRef} className="overflow-x-auto rounded-xl border border-zinc-200/50 bg-white/50 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50/80 border-b border-zinc-200/60 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wider text-[11px]">Agent Name</th>
                  <th className="px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wider text-[11px]">Open Load</th>
                  <th className="px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wider text-[11px]">High Priority</th>
                  <th className="px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wider text-[11px]">SLA Breached</th>
                  <th className="px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wider text-[11px]">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/80">
                {workloadRows.length > 0 ? (
                  workloadRows.map((row) => {
                    const isSelected = selectedAgent === row.agentName;
                    const hasBreach = row.slaBreachedCount > 0;
                    return (
                      <tr
                        key={row.agentName}
                        role="button"
                        tabIndex={0}
                        aria-label={`Filter dashboard for ${row.agentName}`}
                        className={`cursor-pointer transition-all duration-200 outline-none focus-visible:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/50
                          ${isSelected ? 'bg-blue-50/80 shadow-[inset_4px_0_0_rgba(59,130,246,1)]' : hasBreach ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-zinc-50/80'}`}
                        onClick={() => setSelectedAgent((prev) => (prev === row.agentName ? '' : row.agentName))}
                        onKeyDown={(event) => handleRowKeyDown(event, row.agentName)}
                      >
                        <td className="px-4 py-3.5 font-medium text-zinc-900 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600'}`}>
                            {row.agentName.charAt(0).toUpperCase()}
                          </div>
                          {row.agentName}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600 font-medium">{row.openComplaints}</td>
                        <td className="px-4 py-3.5 text-zinc-600 font-medium">
                          {row.highPriorityCount > 0 ? <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-800 text-xs font-bold">{row.highPriorityCount}</span> : <span className="text-zinc-400">0</span>}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600 font-medium">
                          {hasBreach ? <span className="inline-flex px-2 py-0.5 rounded-md bg-red-100/80 text-red-800 text-xs font-bold shadow-sm">{row.slaBreachedCount}</span> : <span className="text-zinc-400">0</span>}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600">
                          <div className="flex items-center gap-2">
                            <div className="w-full max-w-[100px] h-2 bg-zinc-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${row.performanceScore >= 90 ? 'bg-emerald-500' : row.performanceScore >= 70 ? 'bg-blue-500' : row.performanceScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${row.performanceScore}%` }} />
                            </div>
                            <span className="text-xs font-bold font-mono">{row.performanceScore}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No active agents match "<span className="font-medium text-zinc-900">{agentSearch}</span>"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <motion.div variants={itemVariants} className="h-full">
          <Card className="p-6 h-full flex flex-col group relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100" />
            <h2 className="text-[17px] font-bold text-zinc-900">Resolution Progress</h2>
            <p className="text-sm text-zinc-500 mt-1 mb-6">Open vs resolved volume separated by root category.</p>
            <div className="flex-1 min-h-[280px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f4f4f5', opacity: 0.4 }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 500 }}
                    labelFormatter={(label) => `Category: ${label}`}
                    formatter={(value, name) => [`${value ?? 0} complaints`, String(name)]}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: '20px', fontSize: '13px', fontWeight: 500 }} />
                  <Bar dataKey="Open" fill="#f43f5e" radius={[6, 6, 6, 6]} barSize={28} />
                  <Bar dataKey="Resolved" fill="#10b981" radius={[6, 6, 6, 6]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="h-full">
          <Card className="p-6 h-full flex flex-col relative overflow-hidden group">
            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100" />
            <h2 className="text-[17px] font-bold text-zinc-900">Current Queue Priority</h2>
            <p className="text-sm text-zinc-500 mt-1 mb-6">Distribution of open items awaiting triage.</p>
            <div className="flex-1 min-h-[280px] w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={priorityPieData} 
                    dataKey="value" 
                    nameKey="name" 
                    outerRadius={110} 
                    innerRadius={75}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {priorityPieData.map((item) => (
                      <Cell
                        key={item.name}
                        fill={item.name === 'High' ? '#f43f5e' : item.name === 'Medium' ? '#f59e0b' : '#10b981'}
                        style={{ filter: `drop-shadow(0 4px 8px ${item.name === 'High' ? 'rgba(244,63,94,0.3)' : item.name === 'Medium' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'})` }}
                      />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        const { cx, cy } = viewBox as { cx: number; cy: number };
                        return (
                          <g>
                            <text
                              x={cx}
                              y={cy}
                              dy="-0.2em"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#18181b"
                              fontSize="48"
                              fontWeight="900"
                              letterSpacing="-0.02em"
                            >
                              {totalOpenPriorityCount}
                            </text>
                            <text
                              x={cx}
                              y={cy}
                              dy="1.8em"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#71717a"
                              fontSize="12"
                              fontWeight="600"
                              letterSpacing="0.2em"
                            >
                              OPEN
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Pie>
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={10} wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 500 }}
                    formatter={(value, name) => {
                      const count = Number(value ?? 0);
                      const percent = totalOpenPriorityCount > 0 ? Math.round((count / totalOpenPriorityCount) * 100) : 0;
                      return [`${count} items (${percent}%)`, String(name)];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="h-full">
          <Card className="p-6 h-full flex flex-col group relative overflow-hidden">
            <div className="absolute right-10 -bottom-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[70px] pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100" />
            <h2 className="text-[17px] font-bold text-zinc-900">Velocity Trend (14D)</h2>
            <p className="text-sm text-zinc-500 mt-1 mb-6">Average daily hours required to reach resolution.</p>
            <div className="flex-1 min-h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={resolutionTimeTrendData} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f4f4f5" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="shortDate"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={[0, 'auto']}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ stroke: '#a1a1aa', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 500 }}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as { fullDate?: string } | undefined;
                      return row?.fullDate ?? String(label);
                    }}
                    formatter={(value) => {
                      const normalized = Number(value ?? 0);
                      return [`${Number(normalized.toFixed(2))} hrs`, 'Avg Velocity'];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgResolutionHours"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#fff', stroke: '#6366f1', strokeWidth: 2, style: { filter: 'drop-shadow(0 2px 4px rgba(99,102,241,0.4))' } }}
                    style={{ filter: 'drop-shadow(0 6px 8px rgba(99,102,241,0.2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="h-full">
          <Card className="p-6 h-full flex flex-col relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100" />
            <h2 className="text-[17px] font-bold text-zinc-900">Scorecard by Agent</h2>
            <p className="text-sm text-zinc-500 mt-1 mb-6">Comparative view of composite performance scores.</p>
            <div className="flex-1 min-h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentPerformanceData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12, fontWeight: 500 }}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: '#f4f4f5', opacity: 0.6 }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 500 }}
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
                        `Score: ${score} | SLA: ${sla}% | Velocity: ${avg.toFixed(1)}h | Resolved: ${resolved}/${assigned}`,
                        'Performance',
                      ];
                    }}
                  />
                  <Bar dataKey="score" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function MetricCard({ title, value, trend, trendUp, variant = 'default' }: { title: string; value: number | string, trend?: string, trendUp?: boolean, variant?: 'default' | 'critical' }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="h-full">
      <Card className={`p-6 h-full flex flex-col justify-between relative overflow-hidden group ${variant === 'critical' ? 'bg-red-500 text-white border-red-600/50 shadow-[0_4px_20px_rgba(239,68,68,0.2)] hover:shadow-[0_8px_30px_rgba(239,68,68,0.3)]' : ''}`}>
        {variant === 'critical' && (
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -z-10" />
        )}
        <div>
          <h3 className={`text-[14px] font-semibold mb-2 flex items-center justify-between ${variant === 'critical' ? 'text-red-100' : 'text-zinc-500'}`}>
            {title}
            {variant !== 'critical' && trend && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {trendUp ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>}
                {trend}
              </span>
            )}
          </h3>
          <p className={`text-4xl font-black tracking-tight ${variant === 'critical' ? 'text-white drop-shadow-md' : 'text-zinc-950'}`}>{value}</p>
        </div>
        
        {variant === 'critical' && (
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-red-100 bg-red-600/40 w-fit px-3 py-1.5 rounded-lg border border-red-400/30 backdrop-blur-sm shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Requires immediate attention
          </div>
        )}
      </Card>
    </motion.div>
  );
}
