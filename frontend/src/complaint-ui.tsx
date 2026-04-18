import type { Complaint, Sentiment } from './types';

import { Badge } from './components';

export type SlaTrafficState = 'green' | 'amber' | 'red' | 'none';

export function formatCountdown(totalMinutes: number): string {
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = Math.floor(absMinutes % 60);
  const label = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  return totalMinutes < 0 ? `-${label}` : label;
}

export function getComplaintDueAt(complaint: Complaint): string | undefined {
  if (!complaint.firstResponseAt && complaint.firstResponseDueAt) {
    return complaint.firstResponseDueAt;
  }

  if (!complaint.resolvedAt && complaint.resolutionDueAt) {
    return complaint.resolutionDueAt;
  }

  return undefined;
}

export function getSlaTraffic(complaint: Complaint, now = new Date()): {
  state: SlaTrafficState;
  countdown: string;
  remainingMinutes: number | null;
  slaStatus: 'Met' | 'Breached' | 'At Risk' | 'Open' | 'N/A';
} {
  const dueAt = getComplaintDueAt(complaint);
  if (!dueAt) {
    if (complaint.resolvedAt && complaint.resolutionDueAt) {
      const met = new Date(complaint.resolvedAt).getTime() <= new Date(complaint.resolutionDueAt).getTime();
      return {
        state: met ? 'green' : 'red',
        countdown: met ? 'SLA Met' : 'Breached',
        remainingMinutes: null,
        slaStatus: met ? 'Met' : 'Breached',
      };
    }

    return {
      state: 'none',
      countdown: 'N/A',
      remainingMinutes: null,
      slaStatus: 'N/A',
    };
  }

  const remainingMinutes = (new Date(dueAt).getTime() - now.getTime()) / (1000 * 60);
  if (remainingMinutes <= 0) {
    return {
      state: 'red',
      countdown: formatCountdown(Math.round(remainingMinutes)),
      remainingMinutes,
      slaStatus: 'Breached',
    };
  }

  if (remainingMinutes <= 30) {
    return {
      state: 'amber',
      countdown: formatCountdown(Math.round(remainingMinutes)),
      remainingMinutes,
      slaStatus: 'At Risk',
    };
  }

  return {
    state: 'green',
    countdown: formatCountdown(Math.round(remainingMinutes)),
    remainingMinutes,
    slaStatus: 'Open',
  };
}

export function sentimentEmoji(sentiment?: Sentiment): string {
  if (sentiment === 'Angry') {
    return '!!';
  }
  if (sentiment === 'Frustrated') {
    return '!';
  }
  if (sentiment === 'Neutral') {
    return '-';
  }
  if (sentiment === 'Satisfied') {
    return '+';
  }
  return '?';
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
    <div className="w-full max-w-[160px]">
      <div className="mb-1 text-xs text-zinc-500">{percent}%</div>
      <div className="h-2 w-full rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function SlaRing({ complaint }: { complaint: Complaint }) {
  const sla = getSlaTraffic(complaint);
  const ringClass =
    sla.state === 'red'
      ? 'border-red-500 text-red-700 bg-red-50'
      : sla.state === 'amber'
        ? 'border-amber-500 text-amber-700 bg-amber-50'
        : sla.state === 'green'
          ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
          : 'border-zinc-300 text-zinc-500 bg-zinc-50';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${ringClass}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-current" />
      <span>{sla.countdown}</span>
    </div>
  );
}
