import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { DashboardSummary, SlaOverview, WorkloadDistribution } from '../types';
import { Card } from '../components';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
  const [workload, setWorkload] = useState<WorkloadDistribution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [sum, sl, wl] = await Promise.all([
        api.getDashboardSummary(),
        api.getSlaOverview(),
        api.getWorkload(),
      ]);
      setSummary(sum);
      setSla(sl);
      setWorkload(wl);
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

    const refreshEvents = ['complaint.triaged', 'complaint.triage_failed', 'complaint.status_updated'] as const;
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

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (nextWidth > 0) {
        setChartWidth(nextWidth);
      }
    });

    observer.observe(container);
    setChartWidth(Math.floor(container.getBoundingClientRect().width));

    return () => observer.disconnect();
  }, []);

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

  if (!summary || !sla || !workload) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px] text-sm text-zinc-500">
        Loading dashboard metrics...
      </div>
    );
  }

  const getBucketCount = (rows: Array<{ key: string; count: number }>, key: string) =>
    rows.find((row) => row.key === key)?.count ?? 0;

  const firstResponseWarnings = getBucketCount(sla.warningsByMetric, 'first_response');
  const firstResponseBreaches = getBucketCount(sla.breachesByMetric, 'first_response');
  const resolutionWarnings = getBucketCount(sla.warningsByMetric, 'resolution');
  const resolutionBreaches = getBucketCount(sla.breachesByMetric, 'resolution');
  const workloadData = workload.queueByCategory.map(({ key, count }) => ({ name: key, count }));
  const safeChartWidth = Math.max(chartWidth, 280);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200/60 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Overview of current operations and queue metrics.
          </p>
        </div>
        {canExport ? (
          <div className="flex items-center space-x-3">
            <a href={api.exportReportsUrl('csv')} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors bg-white border border-zinc-200/80 rounded-lg px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-zinc-50">
              Export CSV
            </a>
            <a href={api.exportReportsUrl('pdf')} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors bg-white border border-zinc-200/80 rounded-lg px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-zinc-50">
              Export PDF
            </a>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Complaints" value={summary.kpis.totalComplaints} />
        <MetricCard title="Open Items" value={summary.kpis.openComplaints} />
        <MetricCard title="High Priority" value={summary.kpis.highPriorityOpen} alert={summary.kpis.highPriorityOpen > 0} />
        <MetricCard title="Avg Resolution" value={`${summary.kpis.avgResolutionHours}h`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <div className="p-5 border-b border-zinc-100">
            <h2 className="text-[15px] font-semibold text-zinc-900">Service Level Agreements</h2>
          </div>
          <div className="p-5 flex-1">
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-600 font-medium">First Response Warning</span>
                <span className="text-amber-600 font-semibold">{firstResponseWarnings}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-600 font-medium">First Response Breach</span>
                <span className="text-red-600 font-semibold">{firstResponseBreaches}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-600 font-medium">Resolution Warning</span>
                <span className="text-amber-600 font-semibold">{resolutionWarnings}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-600 font-medium">Resolution Breach</span>
                <span className="text-red-600 font-semibold">{resolutionBreaches}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col">
          <div className="p-5 border-b border-zinc-100">
            <h2 className="text-[15px] font-semibold text-zinc-900">Workload by Category</h2>
          </div>
          <div className="p-5 flex-1">
            <div ref={chartContainerRef} className="h-[200px] w-full min-w-0">
              <BarChart width={safeChartWidth} height={200} data={workloadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#a1a1aa" 
                  tick={{ fill: '#71717a', fontSize: 12, fontWeight: 500 }} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#a1a1aa" 
                  tick={{ fill: '#71717a', fontSize: 12 }} 
                  tickLine={false} 
                  axisLine={false} 
                  dx={-10}
                />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e4e4e7', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                  itemStyle={{ color: '#18181b' }}
                />
                <Bar dataKey="count" fill="#18181b" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, alert }: { title: string; value: number | string; alert?: boolean }) {
  return (
    <Card className="p-5 flex flex-col justify-between bg-white relative overflow-hidden group">
      <h3 className="text-[13px] font-medium text-zinc-500 mb-2">{title}</h3>
      <p className={`text-3xl font-bold tracking-tight ${alert ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
    </Card>
  );
}
