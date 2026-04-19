import { useEffect, useMemo, useState } from 'react';
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
import { Card } from '../components';
import { getErrorMessage } from '../lib/errors';
import type { QaTrends } from '../types';

const SENTIMENT_COLORS: Record<string, string> = {
  Angry: '#ef4444',
  Frustrated: '#f59e0b',
  Neutral: '#64748b',
  Satisfied: '#10b981',
  Unknown: '#a1a1aa',
};

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function QaDashboard() {
  const [trends, setTrends] = useState<QaTrends | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const result = await api.getQaTrends();
        if (cancelled) {
          return;
        }

        setTrends(result);
        setError(null);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(error, 'Failed to load QA trends'));
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const keywordData = useMemo(() => {
    const source = trends?.keywordFrequency ?? [];
    return [...source].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [trends]);

  const complaintsOverTimeData = useMemo(() => {
    const source = trends?.complaintsOverTime ?? [];
    return source
      .map((row) => {
        const date = new Date(row.date);
        const isValidDate = !Number.isNaN(date.getTime());
        const day = isValidDate ? WEEKDAY_SHORT[date.getDay()] : row.date;
        return {
          ...row,
          day,
          labelDate: isValidDate ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : row.date,
        };
      })
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  }, [trends]);

  const sentimentPercentData = useMemo(() => {
    const source = trends?.sentimentDistribution ?? [];
    const total = source.reduce((sum, row) => sum + row.count, 0);
    return source.map((row) => ({
      ...row,
      percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }));
  }, [trends]);

  const confidenceBandData = useMemo(() => {
    const source = trends?.confidenceBands ?? [];
    return source.map((band) => ({
      ...band,
      label:
        band.key === '0-40'
          ? 'Low (0-40%)'
          : band.key === '41-70'
            ? 'Medium (41-70%)'
            : 'High (71-100%)',
      order: band.key === '0-40' ? 1 : band.key === '41-70' ? 2 : 3,
    })).sort((a, b) => a.order - b.order);
  }, [trends]);

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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">QA Trends Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Weekly AI quality and complaint volume monitoring.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Complaints This Week" value={trends.thisWeekComplaints} />
        <StatCard title="Average AI Confidence" value={`${trends.avgConfidencePercent}%`} />
        <StatCard title="SLA Met" value={`${trends.slaMetPercent}%`} />
        <StatCard title="AI Helpful" value={`${trends.aiHelpfulnessPercent}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Keyword Frequency Bar Chart</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Shows the top 10 complaint keywords this week, sorted from highest to lowest by appearance count.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={keywordData} margin={{ top: 8, right: 12, left: 6, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="key"
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={76}
                  label={{ value: 'X-axis: Keywords', position: 'insideBottom', offset: -6, style: { fill: '#52525b', fontSize: 12 } }}
                />
                <YAxis
                  allowDecimals={false}
                  label={{ value: 'Y-axis: Keyword Count', angle: -90, position: 'insideLeft', style: { fill: '#52525b', fontSize: 12 } }}
                />
                <Tooltip
                  formatter={(value, name) => [`${value ?? 0} occurrences`, name === 'count' ? 'Keyword Count' : String(name)]}
                  labelFormatter={(label) => `Keyword: ${label}`}
                />
                <Bar dataKey="count" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Complaints Over Time Line Chart</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Shows daily complaint volume across the last 7 days by category: Product, Packaging, and Trade.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complaintsOverTimeData} margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="day"
                  label={{ value: 'X-axis: Day (Mon-Sun)', position: 'insideBottom', offset: -6, style: { fill: '#52525b', fontSize: 12 } }}
                />
                <YAxis
                  allowDecimals={false}
                  label={{ value: 'Y-axis: Complaint Count', angle: -90, position: 'insideLeft', style: { fill: '#52525b', fontSize: 12 } }}
                />
                <Tooltip
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { labelDate?: string } | undefined;
                    return row?.labelDate ?? String(label);
                  }}
                  formatter={(value, name) => [`${value ?? 0} complaints`, String(name)]}
                />
                <Legend verticalAlign="top" height={28} />
                <Line dataKey="Product" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line dataKey="Packaging" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line dataKey="Trade" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Sentiment Distribution Donut</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Shows the percentage split of weekly complaints by sentiment: Angry, Frustrated, Neutral, and Satisfied.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sentimentPercentData} dataKey="percent" nameKey="key" outerRadius={90} innerRadius={40}>
                  {sentimentPercentData.map((entry) => (
                    <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key] ?? '#a1a1aa'} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={24} />
                <Tooltip
                  formatter={(value, name, item) => {
                    const count = (item?.payload as { count?: number } | undefined)?.count ?? 0;
                    return [`${value ?? 0}% (${count} complaints)`, String(name)];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-zinc-500 mt-2">
            Segment value: percentage of total complaints this week.
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900">Confidence Score Distribution Bar Chart</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Shows how many complaints fall into Low (0-40%), Medium (41-70%), and High (71-100%) AI confidence bands.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceBandData} margin={{ top: 8, right: 12, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="label"
                  label={{ value: 'X-axis: Confidence Bands', position: 'insideBottom', offset: -6, style: { fill: '#52525b', fontSize: 12 } }}
                />
                <YAxis
                  allowDecimals={false}
                  label={{ value: 'Y-axis: Complaint Count', angle: -90, position: 'insideLeft', style: { fill: '#52525b', fontSize: 12 } }}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0} complaints`, 'Complaint Count']}
                  labelFormatter={(label) => `Band: ${label}`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {confidenceBandData.map((band) => (
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
