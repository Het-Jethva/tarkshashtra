import type { Complaint, Sentiment } from '../types';

export type SlaTrafficState = 'green' | 'amber' | 'red' | 'none';

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
    const remainingMinutes = (new Date(complaint.resolutionDueAt).getTime() - nowMs) / (1000 * 60);

    return {
      totalMinutes,
      consumedMinutes,
      consumedPercent,
      remainingMinutes,
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
    const remainingMinutes = (new Date(complaint.firstResponseDueAt).getTime() - nowMs) / (1000 * 60);

    return {
      totalMinutes,
      consumedMinutes,
      consumedPercent,
      remainingMinutes,
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

export function getSlaTraffic(complaint: Complaint, now = new Date()): {
  state: SlaTrafficState;
  remainingMinutes: number | null;
  slaStatus: 'Met' | 'Breached' | 'At Risk' | 'Open' | 'N/A';
} {
  const progress = getSlaProgress(complaint, now);

  if (progress.stage === 'none') {
    if (complaint.resolvedAt && complaint.resolutionDueAt) {
      const met = new Date(complaint.resolvedAt).getTime() <= new Date(complaint.resolutionDueAt).getTime();
      return {
        state: met ? 'green' : 'red',
        remainingMinutes: null,
        slaStatus: met ? 'Met' : 'Breached',
      };
    }

    return {
      state: 'none',
      remainingMinutes: null,
      slaStatus: 'N/A',
    };
  }

  const remainingMinutes = progress.remainingMinutes;
  if (remainingMinutes === null) {
    return {
      state: 'none',
      remainingMinutes: null,
      slaStatus: 'N/A',
    };
  }

  if (remainingMinutes <= 0) {
    return {
      state: 'red',
      remainingMinutes,
      slaStatus: 'Breached',
    };
  }

  if (remainingMinutes <= 30) {
    return {
      state: 'amber',
      remainingMinutes,
      slaStatus: 'At Risk',
    };
  }

  return {
    state: 'green',
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
