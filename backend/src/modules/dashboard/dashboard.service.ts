import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";

import { db } from "../../db/client.js";
import { complaints, slaEvents } from "../../db/schema.js";

type BucketCount<T extends string> = {
  key: T;
  count: number;
};

type DashboardSummary = {
  kpis: {
    totalComplaints: number;
    openComplaints: number;
    triageFailed: number;
    highPriorityOpen: number;
    slaBreaches: number;
    avgResolutionHours: number;
    aiHelpfulnessPercent: number;
    avgAiConfidencePercent: number;
    repeatComplainantCount: number;
    duplicateComplaintsCount: number;
  };
  byCategory: BucketCount<"Product" | "Packaging" | "Trade" | "Untriaged">[];
  byPriority: BucketCount<"High" | "Medium" | "Low" | "Untriaged">[];
  byStatus: BucketCount<string>[];
  recentComplaints: Array<{
    id: string;
    source: string;
    category: string | null;
    priority: string | null;
    status: string;
    createdAt: Date;
  }>;
};

type NumericResult = { count: number };

function getCount(rows: NumericResult[]): number {
  return rows[0]?.count ?? 0;
}

function toBucketMap<T extends string>(rows: Array<{ key: T | null; count: number }>): BucketCount<T>[] {
  return rows.map((row) => ({
    key: row.key as T,
    count: row.count,
  }));
}

function averageResolutionHoursExpression(): SQL<number> {
  return sql<number>`coalesce(avg(extract(epoch from (${complaints.resolvedAt} - ${complaints.createdAt})) / 3600), 0)::float`;
}

class DashboardService {
  async getSummary(): Promise<DashboardSummary> {
    const [
      totalComplaints,
      openComplaints,
      triageFailed,
      highPriorityOpen,
      slaBreaches,
      avgResolutionHours,
      helpfulness,
      avgAiConfidence,
      repeatComplainantCount,
      duplicateCount,
      categoryRows,
      priorityRows,
      statusRows,
      recentComplaints,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(complaints),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(complaints)
        .where(sql`${complaints.status} <> 'Closed'`),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(complaints)
        .where(eq(complaints.status, "TriageFailed")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(complaints)
        .where(and(eq(complaints.priority, "High"), sql`${complaints.status} <> 'Closed'`)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(slaEvents)
        .where(eq(slaEvents.eventType, "breach")),
      db
        .select({
          hours: averageResolutionHoursExpression(),
        })
        .from(complaints)
        .where(eq(complaints.status, "Closed")),
      db
        .select({
          total: sql<number>`count(*)::int`,
          helpful: sql<number>`count(*) filter (where ${complaints.aiHelpful} = true)::int`,
        })
        .from(complaints)
        .where(sql`${complaints.aiHelpful} is not null`),
      db
        .select({
          avg: sql<number>`coalesce(avg(${complaints.confidence}), 0)::float`,
        })
        .from(complaints)
        .where(eq(complaints.triageStatus, "success")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(complaints)
        .where(eq(complaints.isRepeatComplainant, true)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(complaints)
        .where(sql`${complaints.duplicateOfComplaintId} is not null`),
      db
        .select({
          key: sql<"Product" | "Packaging" | "Trade" | "Untriaged">`coalesce(cast(${complaints.category} as text), 'Untriaged')`,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .groupBy(sql`coalesce(cast(${complaints.category} as text), 'Untriaged')`),
      db
        .select({
          key: sql<"High" | "Medium" | "Low" | "Untriaged">`coalesce(cast(${complaints.priority} as text), 'Untriaged')`,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .groupBy(sql`coalesce(cast(${complaints.priority} as text), 'Untriaged')`),
      db
        .select({
          key: complaints.status,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .groupBy(complaints.status),
      db
        .select({
          id: complaints.id,
          source: complaints.source,
          category: complaints.category,
          priority: complaints.priority,
          status: complaints.status,
          createdAt: complaints.createdAt,
        })
        .from(complaints)
        .orderBy(desc(complaints.createdAt))
        .limit(8),
    ]);

    return {
      kpis: {
        totalComplaints: totalComplaints[0]?.count ?? 0,
        openComplaints: getCount(openComplaints),
        triageFailed: getCount(triageFailed),
        highPriorityOpen: getCount(highPriorityOpen),
        slaBreaches: getCount(slaBreaches),
        avgResolutionHours: Number((avgResolutionHours[0]?.hours ?? 0).toFixed(2)),
        aiHelpfulnessPercent:
          helpfulness[0] && helpfulness[0].total > 0
            ? Math.round((helpfulness[0].helpful / helpfulness[0].total) * 100)
            : 0,
        avgAiConfidencePercent: Math.round((avgAiConfidence[0]?.avg ?? 0) * 100),
        repeatComplainantCount: repeatComplainantCount[0]?.count ?? 0,
        duplicateComplaintsCount: duplicateCount[0]?.count ?? 0,
      },
      byCategory: toBucketMap(categoryRows),
      byPriority: toBucketMap(priorityRows),
      byStatus: statusRows,
      recentComplaints,
    };
  }

  async getSlaOverview(): Promise<{
    breachesByMetric: BucketCount<string>[];
    warningsByMetric: BucketCount<string>[];
  }> {
    const [breaches, warnings] = await Promise.all([
      db
        .select({
          key: slaEvents.metric,
          count: sql<number>`count(*)::int`,
        })
        .from(slaEvents)
        .where(eq(slaEvents.eventType, "breach"))
        .groupBy(slaEvents.metric),
      db
        .select({
          key: slaEvents.metric,
          count: sql<number>`count(*)::int`,
        })
        .from(slaEvents)
        .where(eq(slaEvents.eventType, "warning"))
        .groupBy(slaEvents.metric),
    ]);

    return {
      breachesByMetric: breaches,
      warningsByMetric: warnings,
    };
  }

  async getWorkloadDistribution(): Promise<{
    queueByPriority: BucketCount<string>[];
    queueByCategory: BucketCount<string>[];
  }> {
    const openStatuses = ["Triaged", "InProgress", "WaitingCustomer"] as const;

    const [byPriority, byCategory] = await Promise.all([
      db
        .select({
          key: sql<string>`coalesce(cast(${complaints.priority} as text), 'Untriaged')`,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .where(inArray(complaints.status, openStatuses))
        .groupBy(sql`coalesce(cast(${complaints.priority} as text), 'Untriaged')`),
      db
        .select({
          key: sql<string>`coalesce(cast(${complaints.category} as text), 'Untriaged')`,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .where(inArray(complaints.status, openStatuses))
        .groupBy(sql`coalesce(cast(${complaints.category} as text), 'Untriaged')`),
    ]);

    return {
      queueByPriority: byPriority,
      queueByCategory: byCategory,
    };
  }

  async getQaTrends(): Promise<{
    thisWeekComplaints: number;
    avgConfidencePercent: number;
    slaMetPercent: number;
    aiHelpfulnessPercent: number;
    keywordFrequency: Array<{ key: string; count: number }>;
    complaintsOverTime: Array<{ date: string; Product: number; Packaging: number; Trade: number }>;
    sentimentDistribution: BucketCount<string>[];
    confidenceBands: Array<{ key: "0-40" | "41-70" | "71-100"; count: number }>;
    lowConfidenceComplaints: Array<{
      id: string;
      createdAt: Date;
      customerName: string | null;
      category: string | null;
      confidence: number | null;
      summary: string | null;
      needsRetraining: boolean;
    }>;
  }> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const [weekStats, aiFeedbackStats, sentiments, confidenceRows, lowConfidenceRows, timeRows, keywordSourceRows] =
      await Promise.all([
        db
          .select({
            total: sql<number>`count(*)::int`,
            avgConfidence: sql<number>`coalesce(avg(${complaints.confidence}), 0)::float`,
            slaMet: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null and ${complaints.resolutionDueAt} is not null and ${complaints.resolvedAt} <= ${complaints.resolutionDueAt})::int`,
          })
          .from(complaints)
          .where(gte(complaints.createdAt, weekStart)),
        db
          .select({
            total: sql<number>`count(*)::int`,
            helpful: sql<number>`count(*) filter (where ${complaints.aiHelpful} = true)::int`,
          })
          .from(complaints)
          .where(and(gte(complaints.createdAt, weekStart), sql`${complaints.aiHelpful} is not null`)),
        db
          .select({
            key: sql<string>`coalesce(cast(${complaints.sentiment} as text), 'Unknown')`,
            count: sql<number>`count(*)::int`,
          })
          .from(complaints)
          .where(gte(complaints.createdAt, weekStart))
          .groupBy(sql`coalesce(cast(${complaints.sentiment} as text), 'Unknown')`),
        db
          .select({
            key: sql<"0-40" | "41-70" | "71-100">`case when ${complaints.confidence} < 0.41 then '0-40' when ${complaints.confidence} <= 0.70 then '41-70' else '71-100' end`,
            count: sql<number>`count(*)::int`,
          })
          .from(complaints)
          .where(and(gte(complaints.createdAt, weekStart), sql`${complaints.confidence} is not null`))
          .groupBy(sql`case when ${complaints.confidence} < 0.41 then '0-40' when ${complaints.confidence} <= 0.70 then '41-70' else '71-100' end`),
        db
          .select({
            id: complaints.id,
            createdAt: complaints.createdAt,
            customerName: complaints.customerName,
            category: complaints.category,
            confidence: complaints.confidence,
            summary: complaints.summary,
            needsRetraining: complaints.needsRetraining,
          })
          .from(complaints)
          .where(and(gte(complaints.createdAt, weekStart), sql`${complaints.confidence} < 0.6`))
          .orderBy(desc(complaints.createdAt))
          .limit(100),
        db
          .select({
            day: sql<string>`to_char(${complaints.createdAt}, 'YYYY-MM-DD')`,
            category: sql<string>`coalesce(cast(${complaints.category} as text), 'Untriaged')`,
            count: sql<number>`count(*)::int`,
          })
          .from(complaints)
          .where(gte(complaints.createdAt, weekStart))
          .groupBy(sql`to_char(${complaints.createdAt}, 'YYYY-MM-DD')`, sql`coalesce(cast(${complaints.category} as text), 'Untriaged')`)
          .orderBy(sql`to_char(${complaints.createdAt}, 'YYYY-MM-DD')`),
        db
          .select({
            keywords: complaints.keywords,
          })
          .from(complaints)
          .where(and(gte(complaints.createdAt, weekStart), sql`${complaints.keywords} is not null`))
          .limit(2000),
      ]);

    const keywordCounter = new Map<string, number>();
    for (const row of keywordSourceRows) {
      const keywords = Array.isArray(row.keywords) ? row.keywords : [];
      for (const rawKeyword of keywords) {
        const keyword = rawKeyword.trim().toLowerCase();
        if (!keyword) {
          continue;
        }

        keywordCounter.set(keyword, (keywordCounter.get(keyword) ?? 0) + 1);
      }
    }

    const keywordFrequency = [...keywordCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));

    const daySet = new Set<string>();
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      daySet.add(day.toISOString().slice(0, 10));
    }

    const dayMap = new Map<string, { date: string; Product: number; Packaging: number; Trade: number }>();
    for (const day of daySet) {
      dayMap.set(day, { date: day, Product: 0, Packaging: 0, Trade: 0 });
    }

    for (const row of timeRows) {
      const bucket = dayMap.get(row.day);
      if (!bucket) {
        continue;
      }

      if (row.category === "Product") {
        bucket.Product = row.count;
      }
      if (row.category === "Packaging") {
        bucket.Packaging = row.count;
      }
      if (row.category === "Trade") {
        bucket.Trade = row.count;
      }
    }

    const confidenceBandDefaults: Record<"0-40" | "41-70" | "71-100", number> = {
      "0-40": 0,
      "41-70": 0,
      "71-100": 0,
    };
    for (const row of confidenceRows) {
      confidenceBandDefaults[row.key] = row.count;
    }

    const totalComplaints = weekStats[0]?.total ?? 0;
    const slaMetCount = weekStats[0]?.slaMet ?? 0;

    return {
      thisWeekComplaints: totalComplaints,
      avgConfidencePercent: Math.round((weekStats[0]?.avgConfidence ?? 0) * 100),
      slaMetPercent: totalComplaints > 0 ? Math.round((slaMetCount / totalComplaints) * 100) : 0,
      aiHelpfulnessPercent:
        (aiFeedbackStats[0]?.total ?? 0) > 0
          ? Math.round(((aiFeedbackStats[0]?.helpful ?? 0) / (aiFeedbackStats[0]?.total ?? 1)) * 100)
          : 0,
      keywordFrequency,
      complaintsOverTime: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      sentimentDistribution: sentiments,
      confidenceBands: [
        { key: "0-40", count: confidenceBandDefaults["0-40"] },
        { key: "41-70", count: confidenceBandDefaults["41-70"] },
        { key: "71-100", count: confidenceBandDefaults["71-100"] },
      ],
      lowConfidenceComplaints: lowConfidenceRows,
    };
  }

  async getManagerOverview(agentName?: string): Promise<{
    agentWorkload: Array<{
      agentName: string;
      openComplaints: number;
      highPriorityCount: number;
      slaBreachedCount: number;
      performanceScore: number;
      avgResolutionHours: number;
      slaMetPercent: number;
      resolvedCount: number;
      assignedCount: number;
    }>;
    categoryOpenResolved: Array<{ category: string; Open: number; Resolved: number }>;
    priorityDistribution: BucketCount<string>[];
    resolutionTimeTrend: Array<{ date: string; avgResolutionHours: number }>;
    kpis: {
      totalComplaintsToday: number;
      slaCompliancePercent: number;
      avgResolutionTimeHours: number;
      openHighPriorityNow: number;
    };
  }> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 13);
    twoWeeksAgo.setHours(0, 0, 0, 0);

    const normalizedAgent = agentName?.trim();
    const agentFilter = normalizedAgent ? eq(complaints.assignedTo, normalizedAgent) : undefined;

    const [agentRows, categoryRows, priorityRows, trendRows, kpiRows] = await Promise.all([
      db
        .select({
          agentName: sql<string>`coalesce(${complaints.assignedTo}, 'Unassigned')`,
          openComplaints: sql<number>`count(*) filter (where ${complaints.status} in ('Triaged','InProgress','WaitingCustomer'))::int`,
          highPriorityCount: sql<number>`count(*) filter (where ${complaints.priority} = 'High' and ${complaints.status} <> 'Closed')::int`,
          slaBreachedCount: sql<number>`count(*) filter (
            where (
              (${complaints.firstResponseAt} is null and ${complaints.firstResponseDueAt} is not null and ${complaints.firstResponseDueAt} < now())
              or
              (${complaints.resolvedAt} is null and ${complaints.resolutionDueAt} is not null and ${complaints.resolutionDueAt} < now())
            )
          )::int`,
          avgResolutionHours: sql<number>`coalesce(avg(extract(epoch from (${complaints.resolvedAt} - ${complaints.createdAt})) / 3600) filter (where ${complaints.resolvedAt} is not null), 0)::float`,
          slaMetCount: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null and ${complaints.resolutionDueAt} is not null and ${complaints.resolvedAt} <= ${complaints.resolutionDueAt})::int`,
          resolvedCount: sql<number>`count(*) filter (where ${complaints.status} in ('Resolved','Closed'))::int`,
          assignedCount: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .where(agentFilter)
        .groupBy(sql`coalesce(${complaints.assignedTo}, 'Unassigned')`)
        .orderBy(sql`coalesce(${complaints.assignedTo}, 'Unassigned')`),
      db
        .select({
          category: sql<string>`coalesce(cast(${complaints.category} as text), 'Untriaged')`,
          openCount: sql<number>`count(*) filter (where ${complaints.status} in ('Triaged','InProgress','WaitingCustomer'))::int`,
          resolvedCount: sql<number>`count(*) filter (where ${complaints.status} in ('Resolved','Closed'))::int`,
        })
        .from(complaints)
        .where(agentFilter)
        .groupBy(sql`coalesce(cast(${complaints.category} as text), 'Untriaged')`),
      db
        .select({
          key: sql<string>`coalesce(cast(${complaints.priority} as text), 'Untriaged')`,
          count: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .where(and(sql`${complaints.status} in ('Triaged','InProgress','WaitingCustomer')`, agentFilter))
        .groupBy(sql`coalesce(cast(${complaints.priority} as text), 'Untriaged')`),
      db
        .select({
          date: sql<string>`to_char(${complaints.createdAt}, 'YYYY-MM-DD')`,
          avgResolutionHours: sql<number>`coalesce(avg(extract(epoch from (${complaints.resolvedAt} - ${complaints.createdAt})) / 3600) filter (where ${complaints.resolvedAt} is not null), 0)::float`,
        })
        .from(complaints)
        .where(and(gte(complaints.createdAt, twoWeeksAgo), agentFilter))
        .groupBy(sql`to_char(${complaints.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${complaints.createdAt}, 'YYYY-MM-DD')`),
      db
        .select({
          totalToday: sql<number>`count(*) filter (where ${complaints.createdAt} >= ${todayStart})::int`,
          slaCompliant: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null and ${complaints.resolutionDueAt} is not null and ${complaints.resolvedAt} <= ${complaints.resolutionDueAt})::int`,
          resolvedTotal: sql<number>`count(*) filter (where ${complaints.resolvedAt} is not null)::int`,
          avgResolutionHours: sql<number>`coalesce(avg(extract(epoch from (${complaints.resolvedAt} - ${complaints.createdAt})) / 3600) filter (where ${complaints.resolvedAt} is not null), 0)::float`,
          openHigh: sql<number>`count(*) filter (where ${complaints.priority} = 'High' and ${complaints.status} in ('Triaged','InProgress','WaitingCustomer'))::int`,
        })
        .from(complaints)
        .where(agentFilter),
    ]);

    const agentWorkload = agentRows.map((row) => {
      const slaMetPercent = row.assignedCount > 0 ? Math.round((row.slaMetCount / row.assignedCount) * 100) : 0;
      const completionRatio = row.assignedCount > 0 ? row.resolvedCount / row.assignedCount : 0;
      const normalizedSpeed = row.avgResolutionHours > 0 ? Math.max(0, 1 - row.avgResolutionHours / 72) : 1;
      const breachPenalty = row.slaBreachedCount > 0 ? Math.min(25, row.slaBreachedCount * 5) : 0;

      const performanceScore = Math.max(
        0,
        Math.round(
          slaMetPercent * 0.4 +
            normalizedSpeed * 100 * 0.3 +
            completionRatio * 100 * 0.2 +
            (row.openComplaints > 0 ? 70 : 85) * 0.1 -
            breachPenalty,
        ),
      );

      return {
        agentName: row.agentName,
        openComplaints: row.openComplaints,
        highPriorityCount: row.highPriorityCount,
        slaBreachedCount: row.slaBreachedCount,
        performanceScore,
        avgResolutionHours: Number(row.avgResolutionHours.toFixed(2)),
        slaMetPercent,
        resolvedCount: row.resolvedCount,
        assignedCount: row.assignedCount,
      };
    });

    const summary = kpiRows[0];

    return {
      agentWorkload,
      categoryOpenResolved: categoryRows.map((row) => ({
        category: row.category,
        Open: row.openCount,
        Resolved: row.resolvedCount,
      })),
      priorityDistribution: priorityRows,
      resolutionTimeTrend: trendRows.map((row) => ({
        date: row.date,
        avgResolutionHours: Number(row.avgResolutionHours.toFixed(2)),
      })),
      kpis: {
        totalComplaintsToday: summary?.totalToday ?? 0,
        slaCompliancePercent:
          summary && summary.resolvedTotal > 0
            ? Math.round((summary.slaCompliant / summary.resolvedTotal) * 100)
            : 0,
        avgResolutionTimeHours: Number((summary?.avgResolutionHours ?? 0).toFixed(2)),
        openHighPriorityNow: summary?.openHigh ?? 0,
      },
    };
  }
}

export const dashboardService = new DashboardService();
