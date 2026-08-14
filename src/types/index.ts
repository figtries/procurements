export type ItemStatus = 'planning' | 'ontrack' | 'atrisk' | 'late' | 'onsite';

export interface MilestoneEntry {
  plan: string;
  forecast: string;
  actual: string;
  note: string;
}

export interface ProcurementItem {
  id: string;
  projectId: string;
  desc: string;
  discipline: string;
  qty: number;
  unit: string;
  vendor: string;
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
  fat: MilestoneEntry;
  rts: MilestoneEntry;
  mos: MilestoneEntry;
  status: ItemStatus;
  progress: number;
  createdAt: string;
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
