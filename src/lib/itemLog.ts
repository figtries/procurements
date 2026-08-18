import type { ItemEvent, ProcurementItem } from '@/types';
import {
  LOGGED_FIELDS, type ItemFieldKey, fieldLabel, isManufacturingField, readField,
} from './fields';
import { fmtDate } from './procurement';

/* ═══════════════════════════════════════════════════════════
   What changed on an item, and when.

   Every write path funnels through here — hand edits in the app and
   rows coming back from a vendor sheet — so the detail page shows one
   history instead of two partial ones. A log that only covered imports
   would keep leaving the user wondering who moved a date.
   ═══════════════════════════════════════════════════════════ */

export interface LogContext {
  source: ItemEvent['source'];
  /** Vendor name for an import, project PIC for a hand edit. */
  actor: string;
  /** Vendor's explanation for this batch of changes, where one was given. */
  reason?: string;
  /** Defaults to now; passed in so a whole import shares one timestamp. */
  at?: string;
}

/**
 * Milestone dates are compared and shown as dates.
 *
 * Manufacturing shares the `.plan` / `.actual` shape but holds percentages, so
 * it has to be excluded by name rather than by pattern.
 */
function isDateField(key: ItemFieldKey): boolean {
  if (isManufacturingField(key)) return false;
  return key === 'poDate' || /\.(plan|forecast|actual)$/.test(key);
}

function sameValue(a: string | number, b: string | number): boolean {
  return String(a ?? '') === String(b ?? '');
}

/**
 * Compare two versions of an item and describe what moved.
 *
 * Only fields marked `logged` in the registry are considered, so retyping a
 * note does not bury the date changes that matter.
 */
export function diffItem(
  before: ProcurementItem, after: ProcurementItem, ctx: LogContext,
): ItemEvent[] {
  const at = ctx.at ?? new Date().toISOString();
  const events: ItemEvent[] = [];

  for (const key of LOGGED_FIELDS) {
    const from = readField(before, key);
    const to = readField(after, key);
    if (sameValue(from, to)) continue;

    events.push({
      at,
      source: ctx.source,
      actor: ctx.actor,
      field: key,
      from: String(from ?? ''),
      to: String(to ?? ''),
      ...(ctx.reason ? { reason: ctx.reason } : {}),
    });
  }
  return events;
}

/** Newest first, so the detail page can render the list as it comes. */
export function appendEvents(item: ProcurementItem, events: ItemEvent[]): ItemEvent[] {
  if (!events.length) return item.events ?? [];
  return [...events, ...(item.events ?? [])];
}

/** The entry every item opens its history with. */
export function createdEvent(ctx: LogContext): ItemEvent {
  return {
    at: ctx.at ?? new Date().toISOString(),
    source: ctx.source,
    actor: ctx.actor,
    field: '',
    from: '',
    to: '',
    ...(ctx.reason ? { reason: ctx.reason } : {}),
  };
}

/* ─────────────── Reading a log entry ─────────────── */

/**
 * `slip` is the one the user is scanning for, so it gets its own tone rather
 * than sitting in with every other edit.
 */
export type EventTone = 'slip' | 'gain' | 'done' | 'info';

export interface EventLine {
  tone: EventTone;
  headline: string;
}

const STAGE_NAMES: Record<string, string> = { fat: 'FAT', rts: 'RTS', mos: 'MOS' };

function stageOf(field: string): string {
  return STAGE_NAMES[field.split('.')[0]] ?? '';
}

function show(key: ItemFieldKey, raw: string): string {
  if (!raw) return '—';
  if (isDateField(key)) return fmtDate(raw) || raw;
  if (key === 'readinessDoc' || key === 'mfg.plan' || key === 'mfg.actual') {
    return `${Math.round(Number(raw) * 100)}%`;
  }
  return raw;
}

/** Turn an event into the sentence shown in the update log. */
export function describeEvent(event: ItemEvent): EventLine {
  const key = event.field as ItemFieldKey;

  if (!event.field) {
    return { tone: 'info', headline: 'Item created' };
  }

  const from = show(key, event.from);
  const to = show(key, event.to);

  /* Manufacturing comes before the milestone branches: it wears the same
     `.actual` suffix but means "how much is built", not "it happened". */
  if (event.field === 'mfg.actual') {
    const rising = Number(event.to) > Number(event.from);
    if (!Number(event.from)) {
      return { tone: 'info', headline: `Manufacturing reported at ${to}` };
    }
    return {
      tone: rising ? 'gain' : 'slip',
      headline: `Manufacturing ${rising ? 'up' : 'back'} ${from} → ${to}`,
    };
  }
  if (event.field === 'mfg.plan') {
    return { tone: 'info', headline: `Manufacturing plan moved ${from} → ${to}` };
  }

  if (/\.actual$/.test(event.field)) {
    // An actual date arriving is the milestone being met; a corrected one is not.
    if (!event.from) return { tone: 'done', headline: `${stageOf(event.field)} reached — ${to}` };
    return { tone: 'info', headline: `${stageOf(event.field)} actual corrected ${from} → ${to}` };
  }

  if (/\.forecast$/.test(event.field)) {
    const stage = stageOf(event.field);
    if (!event.from) return { tone: 'info', headline: `${stage} forecast set to ${to}` };
    if (event.to > event.from) {
      return { tone: 'slip', headline: `${stage} forecast slipped ${from} → ${to}` };
    }
    return { tone: 'gain', headline: `${stage} forecast pulled in ${from} → ${to}` };
  }

  if (/\.plan$/.test(event.field)) {
    return { tone: 'info', headline: `${stageOf(event.field)} plan moved ${from} → ${to}` };
  }

  if (key === 'readinessDoc') {
    const rising = Number(event.to) > Number(event.from);
    return {
      tone: rising ? 'gain' : 'slip',
      headline: `Document readiness ${rising ? 'up' : 'down'} ${from} → ${to}`,
    };
  }

  if (!event.from) return { tone: 'info', headline: `${fieldLabel(key)} set to ${to}` };
  return { tone: 'info', headline: `${fieldLabel(key)} changed ${from} → ${to}` };
}

/** Day-level grouping for the log, newest day first. */
export function groupEventsByDay(events: ItemEvent[]): Array<{ day: string; events: ItemEvent[] }> {
  const days = new Map<string, ItemEvent[]>();
  for (const event of events) {
    const day = event.at.slice(0, 10);
    const bucket = days.get(day);
    if (bucket) bucket.push(event);
    else days.set(day, [event]);
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, list]) => ({ day, events: list }));
}
