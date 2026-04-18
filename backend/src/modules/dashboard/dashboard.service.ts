import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

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
}

export const dashboardService = new DashboardService();
