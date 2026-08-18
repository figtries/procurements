export type ItemStatus = 'planning' | 'ontrack' | 'atrisk' | 'late' | 'onsite';

/** The three milestones every item is tracked through. */
export type MilestoneKey = 'fat' | 'rts' | 'mos';

/**
 * How far the vendor has got building the thing, before any of it can be
 * inspected or shipped.
 *
 * Held as a pair of percentages rather than dates, because that is how vendors
 * actually report it week to week: the schedule says 60% by now, they say 45%,
 * and the gap is the warning. Both are 0–1.
 */
export interface ManufacturingProgress {
  /** Where the schedule says fabrication should be. Ours to set. */
  plan: number;
  /** What the vendor reports. */
  actual: number;
  note: string;
}

export interface MilestoneEntry {
  plan: string;
  forecast: string;
  actual: string;
  note: string;
}

/**
 * One recorded change to an item.
 *
 * Written both by hand-editing in the app and by a vendor import, so the
 * detail page can show a single history rather than two partial ones.
 */
export interface ItemEvent {
  /** ISO timestamp of when the change was applied. */
  at: string;
  source: 'manual' | 'vendor-import' | 'own-import' | 'created';
  /** Vendor name for an import, project PIC for a hand edit. */
  actor: string;
  /** Field registry key, e.g. `mos.forecast`. Empty on a 'created' entry. */
  field: string;
  from: string;
  to: string;
  /** Vendor's explanation, taken from the sheet's "Alasan Perubahan" column. */
  reason?: string;
}

export interface ProcurementItem {
  id: string;
  projectId: string;
  desc: string;
  discipline: string;
  qty: number;
  unit: string;
  vendor: string;
  /** Person at the vendor we actually chase, and the number we chase them on. */
  vendorPic: string;
  vendorPhone: string;
  brand: string;
  delivery: string;
  poNo: string;
  poDate: string;
  statusNote: string;
  /** Document readiness, 0–1. Mirrors the "READINESS DOC" column in client sheets. */
  readinessDoc: number;
  /** Delivery Order number(s). Free text — vendors often send several per item. */
  doNo: string;
  /** Payment terms, kept per item because a vendor can quote different terms per PO. */
  termOfPayment: string;
  /** Manufacturing / fabrication, the stretch before FAT. */
  mfg: ManufacturingProgress;
  fat: MilestoneEntry;
  rts: MilestoneEntry;
  mos: MilestoneEntry;
  status: ItemStatus;
  progress: number;
  createdAt: string;
  /** Newest first. */
  events: ItemEvent[];
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
  createdAt: string;
  /** Bumped on every Excel export so the sheet carries "rev.N" like the client's own file. */
  revision?: number;
}

export type GroupBy = 'discipline' | 'status' | 'vendor';

export type PageName = 'dashboard' | 'overview' | 'projects' | 'itemDetail';

/* ─────────────── Anomaly detection ─────────────── */

export type AnomalySeverity = 'crit' | 'warn';

export interface Anomaly {
  itemId: string;
  severity: AnomalySeverity;
  /** Emoji shown in the anomaly card. */
  icon: string;
  /** Stable identifier for the rule that fired. */
  rule:
    | 'milestone-overdue'
    | 'readiness-low-delivery-near'
    | 'no-po-but-scheduled'
    | 'forecast-slipped'
    | 'delivered-no-do';
  title: string;
  detail: string;
}

/* ─────────────── Excel import ─────────────── */

export interface ImportedRow {
  /** Row is checked for import unless the user unticks it. */
  include: boolean;
  desc: string;
  discipline: string;
  qty: number;
  unit: string;
  vendor: string;
  brand: string;
  poNo: string;
  poDate: string;
  readinessDoc: number;
  doNo: string;
  termOfPayment: string;
  delivery: string;
  statusNote: string;
  fat: MilestoneEntry;
  rts: MilestoneEntry;
  mos: MilestoneEntry;
  /** Sheet the row came from, shown in the preview so duplicates are traceable. */
  sourceSheet: string;
  sourceRow: number;
  /** Set when another parsed row shares the same PO + description. */
  duplicateOf?: number;
  /** Set when an existing item in the project matches — import will update, not insert. */
  matchesItemId?: string;
  warnings: string[];
}

export interface ImportResult {
  rows: ImportedRow[];
  sheetsRead: string[];
  errors: string[];
}
