import type { ProcurementItem } from '@/types';
import type { ItemFieldKey } from './fields';
import { fmtDate, today } from './procurement';

/* ═══════════════════════════════════════════════════════════
   The order procurement actually happens in.

   Equipment is built, then inspected, then released, then it
   arrives: MFG → FAT → RTS → MOS. A record that skips a step is
   not an optimistic record, it is a wrong one — and every figure
   downstream, progress and S-curve included, inherits the error.

   One rule set, checked in both places a value can enter: the
   form in the app, and a returned vendor form. Rules live here
   rather than in either of those so the two can never disagree
   about what a valid item looks like.
   ═══════════════════════════════════════════════════════════ */

export type Severity =
  /** Refuses the save. The record would be self-contradictory. */
  | 'block'
  /** Allowed through, but says so. The record is unusual, not impossible. */
  | 'warn';

export interface RuleViolation {
  /** Which field to put the message under; 'general' has no single owner. */
  field: ItemFieldKey | 'general';
  severity: Severity;
  message: string;
}

/** The stages in the order they have to happen. */
const CHAIN = [
  { key: 'fat', name: 'FAT' },
  { key: 'rts', name: 'RTS' },
  { key: 'mos', name: 'Delivery' },
] as const;

type Checked = Pick<ProcurementItem, 'qty' | 'poDate' | 'readinessDoc' | 'mfg' | 'fat' | 'rts' | 'mos'>
  & Partial<Pick<ProcurementItem, 'doNo'>>;

function pct(value: number): string {
  return `${Math.round((value || 0) * 100)}%`;
}

/**
 * Every rule an item has to satisfy.
 *
 * Returns the violations rather than throwing, so a caller can show them all at
 * once instead of making the user fix one, save, and discover the next.
 */
export function validateItem(item: Checked): RuleViolation[] {
  const out: RuleViolation[] = [];
  const todayStr = today();
  const add = (field: RuleViolation['field'], severity: Severity, message: string) =>
    out.push({ field, severity, message });

  /* ── Quantities and percentages ── */
  if (!item.qty || item.qty <= 0) add('qty', 'block', 'Quantity must be more than zero.');

  const readiness = item.readinessDoc ?? 0;
  if (readiness < 0 || readiness > 1) {
    add('readinessDoc', 'block', 'Document readiness must be between 0% and 100%.');
  }

  const mfgPlan = item.mfg?.plan ?? 0;
  const mfgActual = item.mfg?.actual ?? 0;
  if (mfgPlan < 0 || mfgPlan > 1) add('mfg.plan', 'block', 'Manufacturing plan must be between 0% and 100%.');
  if (mfgActual < 0 || mfgActual > 1) add('mfg.actual', 'block', 'Manufacturing actual must be between 0% and 100%.');

  /* ── The chain: no stage may be closed before the one before it ── */
  if (item.fat.actual && mfgActual < 1) {
    add(
      'fat.actual', 'block',
      `FAT cannot be recorded while manufacturing is at ${pct(mfgActual)}. `
      + 'Set manufacturing to 100% first — a unit cannot be inspected before it is finished.',
    );
  }
  if (item.rts.actual && !item.fat.actual) {
    add('rts.actual', 'block', 'RTS cannot be recorded before FAT has an actual date.');
  }
  if (item.mos.actual && !item.rts.actual) {
    add('mos.actual', 'block', 'Delivery cannot be recorded before RTS has an actual date.');
  }

  /* ── Dates run forward through the chain ── */
  for (const part of ['plan', 'actual'] as const) {
    for (let i = 1; i < CHAIN.length; i++) {
      const prev = CHAIN[i - 1];
      const curr = CHAIN[i];
      const a = item[prev.key][part];
      const b = item[curr.key][part];
      if (a && b && b < a) {
        add(
          `${curr.key}.${part}` as ItemFieldKey, 'block',
          `${curr.name} ${part} (${fmtDate(b)}) cannot be earlier than `
          + `${prev.name} ${part} (${fmtDate(a)}).`,
        );
      }
    }
  }

  // Forecasts are a vendor's opinion, so an odd order is worth flagging, not refusing.
  for (let i = 1; i < CHAIN.length; i++) {
    const prev = CHAIN[i - 1];
    const curr = CHAIN[i];
    const a = item[prev.key].forecast;
    const b = item[curr.key].forecast;
    if (a && b && b < a) {
      add(
        `${curr.key}.forecast` as ItemFieldKey, 'warn',
        `${curr.name} forecast is earlier than ${prev.name} forecast.`,
      );
    }
  }

  /* ── Actual dates are history, not intention ── */
  for (const stage of CHAIN) {
    const actual = item[stage.key].actual;
    if (!actual) continue;
    if (actual > todayStr) {
      add(
        `${stage.key}.actual` as ItemFieldKey, 'block',
        `${stage.name} actual is ${fmtDate(actual)}, in the future. `
        + 'An actual date records something that already happened.',
      );
    }
    if (item.poDate && actual < item.poDate) {
      add(
        `${stage.key}.actual` as ItemFieldKey, 'block',
        `${stage.name} actual (${fmtDate(actual)}) is before the PO date `
        + `(${fmtDate(item.poDate)}).`,
      );
    }
  }

  /* ── Paperwork that should follow the goods ── */
  if (item.mos.actual && item.doNo !== undefined && !item.doNo.trim()) {
    add('doNo', 'warn', 'Material is on site but no DO number is recorded.');
  }
  if (mfgActual >= 1 && !item.fat.plan && !item.fat.forecast) {
    add('fat.plan', 'warn', 'Manufacturing is complete but no FAT date is scheduled.');
  }

  return out;
}

export function blockers(violations: RuleViolation[]): RuleViolation[] {
  return violations.filter(v => v.severity === 'block');
}

/** First message per field, which is all a form has room to show. */
export function byField(violations: RuleViolation[]): Map<string, RuleViolation> {
  const map = new Map<string, RuleViolation>();
  for (const v of violations) {
    if (!map.has(v.field)) map.set(v.field, v);
  }
  return map;
}
