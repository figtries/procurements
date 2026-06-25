import type { ItemStatus, MilestoneEntry, ProcurementItem } from '@/types';

export const DISCIPLINE_COLORS: Record<string, { bg: string; color: string }> = {
  Instrument:  { bg: '#E8F1FF', color: '#007AFF' },
  Electrical:  { bg: '#FFF6E5', color: '#B36900' },
  Mechanical:  { bg: '#E8F8EC', color: '#1E7A33' },
  Civil:       { bg: '#FCEDEB', color: '#C73E3A' },
  Piping:      { bg: '#F3EDFF', color: '#6E3FC7' },
  HVAC:        { bg: '#E5F9F9', color: '#0A7A7A' },
};

export function getDisciplineStyle(disc: string): { bg: string; color: string } {
  return DISCIPLINE_COLORS[disc] ?? { bg: '#F0F0F2', color: '#6E6E73' };
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  planning: 'Planning',
  ontrack:  'On Track',
  atrisk:   'At Risk',
  late:     'Late',
  onsite:   'On Site',
};

export function fmtDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysDiff(from: string, to: string): number {
  const a = new Date(from), b = new Date(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derive item status and progress from milestones.
 * Priority: MOS actual → RTS actual → FAT actual → forecasts → plan dates vs today
 */
export function deriveStatus(item: Pick<ProcurementItem, 'fat' | 'rts' | 'mos' | 'status' | 'progress'>): {
  status: ItemStatus;
  progress: number;
} {
  const todayStr = today();

  // If MOS actual done → on site
  if (item.mos.actual) return { status: 'onsite', progress: 100 };

  // If RTS actual done → past RTS
  if (item.rts.actual) {
    const mosDeadline = item.mos.forecast || item.mos.plan;
    if (mosDeadline && mosDeadline < todayStr) return { status: 'late', progress: 75 };
    return { status: 'ontrack', progress: 75 };
  }

  // If FAT actual done
  if (item.fat.actual) {
    const rtsDeadline = item.rts.forecast || item.rts.plan;
    if (rtsDeadline && rtsDeadline < todayStr) return { status: 'late', progress: 50 };
    return { status: 'ontrack', progress: 50 };
  }

  // Check if any milestone is overdue based on forecast/plan
  const fatDeadline = item.fat.forecast || item.fat.plan;
  if (fatDeadline && fatDeadline < todayStr) return { status: 'late', progress: 15 };

  // At risk if FAT is within 14 days
  if (fatDeadline) {
    const diff = daysDiff(todayStr, fatDeadline);
    if (diff <= 14) return { status: 'atrisk', progress: 20 };
  }

  // No milestones → planning
  if (!fatDeadline) return { status: 'planning', progress: 0 };

  return { status: 'ontrack', progress: 25 };
}

export function getNextMilestone(item: ProcurementItem): string {
  if (!item.fat.actual) {
    const d = item.fat.forecast || item.fat.plan;
    return d ? `FAT: ${fmtDate(d)}` : '';
  }
  if (!item.rts.actual) {
    const d = item.rts.forecast || item.rts.plan;
    return d ? `RTS: ${fmtDate(d)}` : '';
  }
  if (!item.mos.actual) {
    const d = item.mos.forecast || item.mos.plan;
    return d ? `MOS: ${fmtDate(d)}` : '';
  }
  return 'Complete';
}

export function computeOverallProgress(items: ProcurementItem[]): number {
  if (!items.length) return 0;
  const total = items.reduce((acc, i) => acc + i.progress, 0);
  return Math.round(total / items.length);
}

export function milestoneState(ms: MilestoneEntry): 'done' | 'late' | 'current' | 'upcoming' {
  if (ms.actual) return 'done';
  const deadline = ms.forecast || ms.plan;
  if (!deadline) return 'upcoming';
  if (deadline < today()) return 'late';
  return 'current';
}
