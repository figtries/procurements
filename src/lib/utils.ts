import type {
  Anomaly, ItemStatus, MilestoneEntry, ProcurementItem, Project,
} from '@/types';

/** Fixed engineering disciplines used across the app. */
export const DISCIPLINES = [
  'Process',
  'Mechanical',
  'Piping',
  'Electrical',
  'Instrument',
  'Civil',
  'Structural',
  'HSE',
] as const;

export const DISCIPLINE_COLORS: Record<string, { bg: string; color: string }> = {
  Process:     { bg: '#E5F9F9', color: '#0A7A7A' },
  Mechanical:  { bg: '#E8F8EC', color: '#1E7A33' },
  Piping:      { bg: '#F3EDFF', color: '#6E3FC7' },
  Electrical:  { bg: '#FFF6E5', color: '#B36900' },
  Instrument:  { bg: '#E8F1FF', color: '#007AFF' },
  Civil:       { bg: '#FCEDEB', color: '#C73E3A' },
  Structural:  { bg: '#EFF1F5', color: '#4A5568' },
  HSE:         { bg: '#FFEDF2', color: '#B32455' },
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

/* ═══════════════════════════════════════════════════════════
   DASHBOARD AGGREGATIONS
   Everything below derives from data the app already stores —
   no extra input is required from the user.
   ═══════════════════════════════════════════════════════════ */

/** Progress each milestone represents once reached. Mirrors deriveStatus(). */
const MS_WEIGHT = { fat: 50, rts: 75, mos: 100 } as const;

/** Progress an item had reached by `date`, following whichever date set is given. */
function progressAt(
  item: ProcurementItem,
  date: string,
  pick: (ms: MilestoneEntry) => string,
): number {
  const mos = pick(item.mos);
  if (mos && mos <= date) return MS_WEIGHT.mos;
  const rts = pick(item.rts);
  if (rts && rts <= date) return MS_WEIGHT.rts;
  const fat = pick(item.fat);
  if (fat && fat <= date) return MS_WEIGHT.fat;
  return 0;
}

const planDate     = (ms: MilestoneEntry) => ms.plan;
const actualDate   = (ms: MilestoneEntry) => ms.actual;
const forecastDate = (ms: MilestoneEntry) => ms.forecast || ms.plan;

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.toISOString().slice(0, 10);
}

export interface SCurvePoint {
  /** Last day of the month, ISO. */
  date: string;
  label: string;
  plan: number;
  /** Null once the month is in the future — the actual line stops at today. */
  actual: number | null;
  /** Null before today — the forecast line starts where actual ends. */
  forecast: number | null;
}

const MONTHS_ID = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];

/**
 * Build the plan / actual / forecast S-curve from milestone dates.
 * Spans the earliest known date through the project handover (or the last plan date).
 */
export function buildSCurve(items: ProcurementItem[], project: Project | null): SCurvePoint[] {
  if (!items.length) return [];

  const allDates: string[] = [];
  for (const it of items) {
    for (const ms of [it.fat, it.rts, it.mos]) {
      for (const d of [ms.plan, ms.forecast, ms.actual]) if (d) allDates.push(d);
    }
    if (it.poDate) allDates.push(it.poDate);
  }
  if (project?.handover) allDates.push(project.handover);
  if (!allDates.length) return [];

  allDates.sort();
  const todayStr = today();
  const start = new Date(allDates[0] + 'T00:00:00Z');
  const endStr = allDates[allDates.length - 1] > todayStr ? allDates[allDates.length - 1] : todayStr;
  const end = new Date(endStr + 'T00:00:00Z');

  // Cap at 36 points so multi-year projects stay readable.
  const months: SCurvePoint[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let guard = 0;
  while (cursor <= end && guard++ < 36) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const date = lastDayOfMonth(y, m);
    const isPast = date <= todayStr;

    const avg = (pick: (ms: MilestoneEntry) => string) =>
      Math.round(items.reduce((sum, it) => sum + progressAt(it, date, pick), 0) / items.length);

    months.push({
      date,
      label: `${MONTHS_ID[m]}${m === 0 ? ` '${String(y).slice(2)}` : ''}`,
      plan: avg(planDate),
      actual: isPast ? avg(actualDate) : null,
      forecast: isPast ? null : avg(forecastDate),
    });
    cursor.setUTCMonth(m + 1);
  }

  // Join the two lines: the last actual point also anchors the forecast.
  const lastActualIdx = months.map(p => p.actual !== null).lastIndexOf(true);
  if (lastActualIdx >= 0 && lastActualIdx < months.length - 1) {
    months[lastActualIdx].forecast = months[lastActualIdx].actual;
  }
  return months;
}

export interface DeviationSummary {
  planPct: number;
  actualPct: number;
  deviation: number;
  /** Rough schedule slip in days, read off the plan curve. */
  slipDays: number;
}

/** Where the project stands today versus where the plan said it would be. */
export function computeDeviation(items: ProcurementItem[], project: Project | null): DeviationSummary {
  if (!items.length) return { planPct: 0, actualPct: 0, deviation: 0, slipDays: 0 };

  const todayStr = today();
  const planPct   = Math.round(items.reduce((s, i) => s + progressAt(i, todayStr, planDate), 0) / items.length);
  const actualPct = computeOverallProgress(items);
  const deviation = actualPct - planPct;

  // Walk the plan curve backwards to find when the plan last sat at today's actual.
  let slipDays = 0;
  if (deviation < 0) {
    const curve = buildSCurve(items, project);
    const behind = [...curve].reverse().find(p => p.plan <= actualPct);
    if (behind) slipDays = Math.max(0, daysDiff(behind.date, todayStr));
  }
  return { planPct, actualPct, deviation, slipDays };
}

export type MilestoneKey = 'fat' | 'rts' | 'mos';

export interface MilestoneStat {
  key: MilestoneKey;
  label: string;
  name: string;
  done: number;
  scheduled: number;
  overdue: number;
  unplanned: number;
  total: number;
}

const MILESTONE_META: Record<MilestoneKey, { label: string; name: string }> = {
  fat: { label: 'FAT', name: 'Factory Acceptance Test' },
  rts: { label: 'RTS', name: 'Ready to Ship' },
  mos: { label: 'MOS', name: 'Material on Site' },
};

/** How many items have cleared each milestone, and how many are overdue. */
export function milestoneStats(items: ProcurementItem[]): MilestoneStat[] {
  return (['fat', 'rts', 'mos'] as MilestoneKey[]).map(key => {
    let done = 0, scheduled = 0, overdue = 0, unplanned = 0;
    for (const item of items) {
      switch (milestoneState(item[key])) {
        case 'done':     done++;      break;
        case 'late':     overdue++;   break;
        case 'current':  scheduled++; break;
        default:         unplanned++;
      }
    }
    return { key, ...MILESTONE_META[key], done, scheduled, overdue, unplanned, total: items.length };
  });
}

export interface DisciplineBreakdown {
  discipline: string;
  total: number;
  counts: Record<ItemStatus, number>;
}

/** Status composition per discipline, biggest group first. */
export function disciplineBreakdown(items: ProcurementItem[]): DisciplineBreakdown[] {
  const map = new Map<string, DisciplineBreakdown>();
  for (const item of items) {
    const key = item.discipline || 'Uncategorised';
    if (!map.has(key)) {
      map.set(key, {
        discipline: key,
        total: 0,
        counts: { planning: 0, ontrack: 0, atrisk: 0, late: 0, onsite: 0 },
      });
    }
    const row = map.get(key)!;
    row.total++;
    row.counts[item.status]++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export interface LookaheadEvent {
  itemId: string;
  kind: MilestoneKey;
  label: string;
  date: string;
  /** Short weekday, e.g. "SEN". */
  day: string;
  desc: string;
  vendor: string;
  overdue: boolean;
}

export interface LookaheadWeek {
  label: string;
  range: string;
  isCurrent: boolean;
  events: LookaheadEvent[];
}

const DAYS_ID = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Milestones falling due over the next `weeks` weeks, bucketed by week. */
export function buildLookahead(items: ProcurementItem[], weeks = 4): LookaheadWeek[] {
  const now = new Date();
  const first = startOfWeek(now);

  const buckets: LookaheadWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const from = new Date(first); from.setDate(from.getDate() + w * 7);
    const to   = new Date(from);  to.setDate(to.getDate() + 6);
    const fmt  = (d: Date) => `${d.getDate()} ${MONTHS_ID[d.getMonth()].slice(0, 3)}`;
    buckets.push({
      label: w === 0 ? 'Minggu ini' : w === 1 ? 'Minggu depan' : `Minggu ${w + 1}`,
      range: `${fmt(from)}–${fmt(to)}`,
      isCurrent: w === 0,
      events: [],
    });
  }

  const rangeEnd = new Date(first);
  rangeEnd.setDate(rangeEnd.getDate() + weeks * 7);
  const rangeEndStr = rangeEnd.toISOString().slice(0, 10);
  const todayStr = today();

  for (const item of items) {
    for (const key of ['fat', 'rts', 'mos'] as MilestoneKey[]) {
      const ms = item[key];
      if (ms.actual) continue;
      const date = ms.forecast || ms.plan;
      if (!date || date >= rangeEndStr) continue;

      // Overdue milestones surface in the current week so they are not lost off-screen.
      const overdue = date < todayStr;
      const target = new Date(date + 'T00:00:00');
      const idx = overdue
        ? 0
        : Math.floor((startOfWeek(target).getTime() - first.getTime()) / (7 * 86400000));
      if (idx < 0 || idx >= weeks) continue;

      buckets[idx].events.push({
        itemId: item.id,
        kind: key,
        label: MILESTONE_META[key].label,
        date,
        day: DAYS_ID[target.getDay()],
        desc: item.desc,
        vendor: item.vendor,
        overdue,
      });
    }
  }

  for (const b of buckets) b.events.sort((a, z) => a.date.localeCompare(z.date));
  return buckets;
}

/* ═══════════════════════════════════════════════════════════
   ANOMALY DETECTION
   ═══════════════════════════════════════════════════════════ */

/** Days a delivery may be away before low document readiness becomes a warning. */
const READINESS_HORIZON_DAYS = 21;
const READINESS_THRESHOLD = 0.9;

/**
 * Flag items that need a human to look at them.
 * Rules are ordered by severity so the dashboard can show the worst first.
 */
export function detectAnomalies(items: ProcurementItem[]): Anomaly[] {
  const todayStr = today();
  const out: Anomaly[] = [];

  for (const item of items) {
    /* 1 — a milestone deadline has passed with no actual date recorded */
    for (const key of ['mos', 'rts', 'fat'] as MilestoneKey[]) {
      const ms = item[key];
      if (ms.actual) continue;
      const deadline = ms.forecast || ms.plan;
      if (!deadline || deadline >= todayStr) continue;
      const late = daysDiff(deadline, todayStr);
      out.push({
        itemId: item.id,
        severity: late > 14 ? 'crit' : 'warn',
        icon: '⚠️',
        rule: 'milestone-overdue',
        title: MILESTONE_META[key].label,
        detail: `${MILESTONE_META[key].label} dijadwalkan ${fmtDate(deadline)} — sudah lewat ${late} hari tanpa tanggal aktual.`,
      });
      break; // one overdue milestone per item is enough to act on
    }

    /* 2 — documents incomplete while delivery is close */
    const mosDue = item.mos.forecast || item.mos.plan;
    if (!item.mos.actual && mosDue && item.readinessDoc < READINESS_THRESHOLD) {
      const daysToDelivery = daysDiff(todayStr, mosDue);
      if (daysToDelivery <= READINESS_HORIZON_DAYS) {
        out.push({
          itemId: item.id,
          severity: daysToDelivery < 0 || item.readinessDoc < 0.5 ? 'crit' : 'warn',
          icon: '📄',
          rule: 'readiness-low-delivery-near',
          title: 'Dokumen belum lengkap',
          detail: daysToDelivery < 0
            ? `Readiness dokumen ${Math.round(item.readinessDoc * 100)}% dan rencana delivery ${fmtDate(mosDue)} sudah terlewat.`
            : `Readiness dokumen ${Math.round(item.readinessDoc * 100)}% tapi delivery tinggal ${daysToDelivery} hari lagi.`,
        });
      }
    }

    /* 3 — milestones scheduled but no PO issued yet */
    if (!item.poNo.trim()) {
      const firstDue = [item.fat, item.rts, item.mos]
        .map(ms => ms.forecast || ms.plan)
        .filter(Boolean)
        .sort()[0];
      if (firstDue) {
        out.push({
          itemId: item.id,
          severity: firstDue < todayStr ? 'crit' : 'warn',
          icon: '🧾',
          rule: 'no-po-but-scheduled',
          title: 'PO belum terbit',
          detail: `Sudah ada jadwal milestone ${fmtDate(firstDue)} tapi nomor PO masih kosong.`,
        });
      }
    }

    /* 4 — forecast has slipped past the original plan */
    for (const key of ['fat', 'rts', 'mos'] as MilestoneKey[]) {
      const ms = item[key];
      if (ms.actual || !ms.plan || !ms.forecast || ms.forecast <= ms.plan) continue;
      const slip = daysDiff(ms.plan, ms.forecast);
      out.push({
        itemId: item.id,
        severity: slip > 14 ? 'crit' : 'warn',
        icon: '🚢',
        rule: 'forecast-slipped',
        title: `${MILESTONE_META[key].label} mundur`,
        detail: `Forecast ${MILESTONE_META[key].label} mundur ${slip} hari dari rencana — ${fmtDate(ms.plan)} → ${fmtDate(ms.forecast)}.`,
      });
      break;
    }

    /* 5 — material arrived but the delivery order was never recorded */
    if (item.mos.actual && !item.doNo.trim()) {
      out.push({
        itemId: item.id,
        severity: 'warn',
        icon: '📦',
        rule: 'delivered-no-do',
        title: 'No. DO belum diisi',
        detail: `Material tercatat on site ${fmtDate(item.mos.actual)} tapi nomor Delivery Order masih kosong.`,
      });
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'crit' ? -1 : 1));
}

export interface VendorStat {
  vendor: string;
  items: number;
  itemNames: string[];
  avgReadiness: number;
  /** Mean slip in days across milestones that moved; 0 when nothing slipped. */
  avgSlipDays: number;
  /** Worst status among the vendor's items. */
  worstStatus: ItemStatus;
}

const STATUS_RANK: Record<ItemStatus, number> = {
  late: 0, atrisk: 1, planning: 2, ontrack: 3, onsite: 4,
};

/** Per-vendor roll-up, worst performers first. */
export function vendorStats(items: ProcurementItem[]): VendorStat[] {
  const map = new Map<string, ProcurementItem[]>();
  for (const item of items) {
    const key = item.vendor.trim() || 'Belum ditentukan';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const todayStr = today();
  const out: VendorStat[] = [];

  for (const [vendor, list] of map) {
    let slipTotal = 0, slipCount = 0;
    for (const item of list) {
      for (const key of ['fat', 'rts', 'mos'] as MilestoneKey[]) {
        const ms = item[key];
        if (ms.actual && ms.plan) {
          slipTotal += daysDiff(ms.plan, ms.actual); slipCount++;
        } else if (!ms.actual && ms.plan) {
          const due = ms.forecast || ms.plan;
          const ref = due < todayStr ? todayStr : due;
          const slip = daysDiff(ms.plan, ref);
          if (slip !== 0) { slipTotal += slip; slipCount++; }
        }
      }
    }
    out.push({
      vendor,
      items: list.length,
      itemNames: list.map(i => i.desc),
      avgReadiness: list.reduce((s, i) => s + (i.readinessDoc || 0), 0) / list.length,
      avgSlipDays: slipCount ? Math.round(slipTotal / slipCount) : 0,
      worstStatus: list.reduce<ItemStatus>(
        (worst, i) => (STATUS_RANK[i.status] < STATUS_RANK[worst] ? i.status : worst),
        'onsite',
      ),
    });
  }

  return out.sort((a, b) =>
    STATUS_RANK[a.worstStatus] - STATUS_RANK[b.worstStatus] || b.avgSlipDays - a.avgSlipDays);
}
