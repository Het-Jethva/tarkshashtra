import type { Complaint, Sentiment } from './types';

import { Badge } from './components';
import { getSlaTraffic } from './lib/complaint-ui';
import { cn } from './lib/utils';

function formatUnitMinutes(minutes: number): string {
  if (minutes >= 60) {
    return `${Math.round(minutes / 60)}h`;
  }

  return `${Math.round(minutes)}m`;
}

function getFirstResponseTotalMinutes(complaint: Complaint): number | null {
  if (!complaint.firstResponseDueAt) {
    return null;
  }

  const total = (new Date(complaint.firstResponseDueAt).getTime() - new Date(complaint.createdAt).getTime()) / (1000 * 60);
  return total > 0 ? total : null;
}

function getResolutionTotalMinutes(complaint: Complaint): number | null {
  if (!complaint.resolutionDueAt) {
    return null;
  }

  const startTime = complaint.firstResponseAt ? new Date(complaint.firstResponseAt).getTime() : new Date(complaint.createdAt).getTime();
  const total = (new Date(complaint.resolutionDueAt).getTime() - startTime) / (1000 * 60);
  return total > 0 ? total : null;
}

function getSlaProgress(complaint: Complaint, now = new Date()): {
  totalMinutes: number | null;
  consumedMinutes: number | null;
  consumedPercent: number | null;
  remainingMinutes: number | null;
  displayText: string;
  stage: 'resolution' | 'first_response' | 'none';
} {
  const nowMs = now.getTime();

  if (!complaint.resolvedAt && complaint.resolutionDueAt) {
    const totalMinutes = getResolutionTotalMinutes(complaint);
    if (!totalMinutes) {
      return {
        totalMinutes: null,
        consumedMinutes: null,
        consumedPercent: null,
        remainingMinutes: null,
        displayText: 'N/A',
        stage: 'none',
      };
    }

    const startMs = complaint.firstResponseAt ? new Date(complaint.firstResponseAt).getTime() : new Date(complaint.createdAt).getTime();
    const consumedMinutesRaw = (nowMs - startMs) / (1000 * 60);
    const consumedMinutes = Math.max(0, consumedMinutesRaw);
    const consumedPercent = Math.max(0, Math.min(100, (consumedMinutes / totalMinutes) * 100));

    return {
      totalMinutes,
      consumedMinutes,
      consumedPercent,
      remainingMinutes: (new Date(complaint.resolutionDueAt).getTime() - nowMs) / (1000 * 60),
      displayText: `${formatUnitMinutes(Math.min(consumedMinutes, totalMinutes))} of ${formatUnitMinutes(totalMinutes)} consumed`,
      stage: 'resolution',
    };
  }

  if (!complaint.firstResponseAt && complaint.firstResponseDueAt) {
    const totalMinutes = getFirstResponseTotalMinutes(complaint);
    if (!totalMinutes) {
      return {
        totalMinutes: null,
        consumedMinutes: null,
        consumedPercent: null,
        remainingMinutes: null,
        displayText: 'N/A',
        stage: 'none',
      };
    }

    const consumedMinutesRaw = (nowMs - new Date(complaint.createdAt).getTime()) / (1000 * 60);
    const consumedMinutes = Math.max(0, consumedMinutesRaw);
    const consumedPercent = Math.max(0, Math.min(100, (consumedMinutes / totalMinutes) * 100));

    return {
      totalMinutes,
      consumedMinutes,
      consumedPercent,
      remainingMinutes: (new Date(complaint.firstResponseDueAt).getTime() - nowMs) / (1000 * 60),
      displayText: `${formatUnitMinutes(Math.min(consumedMinutes, totalMinutes))} of ${formatUnitMinutes(totalMinutes)} consumed`,
      stage: 'first_response',
    };
  }

  return {
    totalMinutes: null,
    consumedMinutes: null,
    consumedPercent: null,
    remainingMinutes: null,
    displayText: 'N/A',
    stage: 'none',
  };
}

export function SentimentBadge({ sentiment, score }: { sentiment?: Sentiment; score?: number }) {
  if (!sentiment) {
    return <Badge>Unknown</Badge>;
  }

  const variant =
    sentiment === 'Angry'
      ? 'error'
      : sentiment === 'Frustrated'
        ? 'warning'
        : sentiment === 'Satisfied'
          ? 'success'
          : 'default';

  return (
    <Badge variant={variant}>
      {sentiment} {typeof score === 'number' ? `(${score})` : ''}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority?: string }) {
  const variant =
    priority === 'High' ? 'error' : priority === 'Medium' ? 'warning' : priority === 'Low' ? 'info' : 'default';
  return <Badge variant={variant}>{priority ?? 'Untriaged'}</Badge>;
}

export function ConfidenceBar({ confidence }: { confidence?: number }) {
  const percent = typeof confidence === 'number' ? Math.max(0, Math.min(100, Math.round(confidence * 100))) : 0;
  const tone = percent >= 71 ? 'bg-emerald-500' : percent >= 41 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="w-full max-w-[200px]">
      <div className="mb-1 text-xs text-zinc-500">{percent}%</div>
      <div
        className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden"
        role="progressbar"
        aria-label="AI confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function SlaRing({ complaint }: { complaint: Complaint }) {
  const traffic = getSlaTraffic(complaint);

  const ringClass =
    traffic.state === 'red'
      ? 'border-red-500 text-red-700 bg-red-50'
      : traffic.state === 'amber'
        ? 'border-amber-500 text-amber-700 bg-amber-50'
        : traffic.state === 'green'
          ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
          : 'border-zinc-300 text-zinc-500 bg-zinc-50';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${ringClass}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-current" />
      <span>{traffic.slaStatus === 'N/A' ? 'N/A' : `${traffic.slaStatus}`}</span>
    </div>
  );
}

export function SlaProgress({ complaint }: { complaint: Complaint }) {
  const progress = getSlaProgress(complaint);
  const traffic = getSlaTraffic(complaint);

  if (progress.stage === 'none' || progress.consumedPercent === null) {
    return <div className="text-xs text-zinc-500">N/A</div>;
  }

  const fillColor =
    traffic.state === 'red' ? 'bg-red-500' : progress.consumedPercent >= 75 ? 'bg-amber-500' : 'bg-emerald-500';

  const safePercent = Math.max(0, Math.min(100, progress.consumedPercent));

  return (
    <div className="w-full min-w-[170px]">
      <div
        className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-label={`SLA progress for ${progress.stage === 'resolution' ? 'resolution' : 'first response'}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safePercent)}
      >
        <div className={cn('h-full transition-[width]', fillColor)} style={{ width: `${safePercent}%` }} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">{progress.displayText}</div>
    </div>
  );
}
