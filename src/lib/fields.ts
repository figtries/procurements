import type { MilestoneEntry, MilestoneKey, ProcurementItem } from '@/types';
import { CYAN, GREEN, GREY, PEACH, YELLOW } from './excelTheme';

/* ═══════════════════════════════════════════════════════════
   One list of the fields an item carries.

   Everything that writes or reads a field takes it from here: the
   vendor sheet's columns, the header matching that reads that sheet
   back, and the wording of the update log. Adding a field used to
   mean editing the form, the exporter and the importer separately —
   and forgetting one of them.

   The form and the detail page keep their hand-built layouts, but
   take their labels from this file, so the app and the spreadsheet
   cannot disagree about what a column is called.
   ═══════════════════════════════════════════════════════════ */

/** Dotted path for the three-part milestone fields. */
export type MilestoneField = `${MilestoneKey}.${keyof MilestoneEntry}`;

export type ItemFieldKey =
  | 'desc' | 'discipline' | 'qty' | 'unit'
  | 'vendor' | 'vendorPic' | 'vendorPhone' | 'brand' | 'delivery'
  | 'poNo' | 'poDate' | 'termOfPayment' | 'doNo' | 'readinessDoc'
  | 'mfg.plan' | 'mfg.actual' | 'mfg.note'
  | MilestoneField
  | 'statusNote';

/**
 * `changeReason` is the one column with nowhere to live on the item: it
 * explains a change rather than describing the equipment, so it lands in
 * that change's log entry instead of being stored on the item again.
 */
export type SheetFieldKey = ItemFieldKey | 'changeReason';

export type FieldKind =
  | 'text'       // one-line free text
  | 'longtext'   // wraps, wide column
  | 'discipline' // one of DISCIPLINES, offered as a dropdown
  | 'qty'
  | 'date'
  | 'percent';   // stored 0–1, shown as a percentage

export interface FieldDef {
  key: SheetFieldKey;
  /** Column header, and the name this field goes by in the update log. */
  label: string;
  /** Header used inside a milestone block, which already names the stage. */
  short?: string;
  kind: FieldKind;
  /** Excel column width. */
  width: number;
  /**
   * The vendor may type here: the cell is tinted and left unlocked in the
   * template, and the importer accepts a new value for it.
   *
   * The split is contractual versus actual. We own what was agreed — scope,
   * quantity, PO, payment terms, the baseline plan dates. The vendor owns
   * what is happening — brand supplied, documents, delivery note, forecasts
   * and actual dates.
   */
  vendorEditable: boolean;
  /** Changes to this field are worth recording in the item's update log. */
  logged: boolean;
  /** Extra wordings to recognise when reading a sheet that is not ours. */
  patterns?: RegExp[];
}

export interface FieldGroup {
  label: string;
  colour: string;
  /** Set on the three milestone blocks, whose headers name the stage once. */
  milestone?: MilestoneKey;
  fields: FieldDef[];
}

function milestoneGroup(key: MilestoneKey, label: string): FieldGroup {
  const stage = key.toUpperCase();
  return {
    label, colour: PEACH, milestone: key,
    fields: [
      {
        key: `${key}.plan`, label: `${stage} Plan`, short: 'Plan',
        kind: 'date', width: 11.5, vendorEditable: false, logged: true,
      },
      {
        key: `${key}.forecast`, label: `${stage} Forecast`, short: 'Forecast',
        kind: 'date', width: 11.5, vendorEditable: true, logged: true,
      },
      {
        key: `${key}.actual`, label: `${stage} Actual`, short: 'Actual',
        kind: 'date', width: 11.5, vendorEditable: true, logged: true,
      },
      {
        key: `${key}.note`, label: `${stage} Catatan`, short: 'Note',
        kind: 'longtext', width: 26, vendorEditable: true, logged: false,
      },
    ],
  };
}

/** Sections and wording follow the Add Item form, field for field. */
export const FIELD_GROUPS: FieldGroup[] = [
  {
    label: 'Equipment', colour: GREY, fields: [
      {
        key: 'desc', label: 'Description', kind: 'longtext', width: 30,
        vendorEditable: false, logged: false,
        patterns: [/EQUIPMENT|MATERIAL|DESCRIPTION|DESKRIPSI|URAIAN|NAMA\s*BARANG/],
      },
      {
        key: 'discipline', label: 'Discipline', kind: 'discipline', width: 13,
        vendorEditable: false, logged: false,
        patterns: [/DISCIPLINE|DISIPLIN|BIDANG/],
      },
      {
        key: 'qty', label: 'Quantity', kind: 'qty', width: 6.5,
        vendorEditable: false, logged: true,
        patterns: [/\bQTY\b|QUANTITY|JUMLAH|VOLUME/],
      },
      {
        key: 'unit', label: 'Unit', kind: 'text', width: 7.5,
        vendorEditable: false, logged: false,
        patterns: [/\bUNIT\b|SATUAN|\bUOM\b/],
      },
    ],
  },
  {
    label: 'Vendor', colour: CYAN, fields: [
      {
        key: 'vendor', label: 'Supplier / vendor', kind: 'text', width: 22,
        vendorEditable: false, logged: false,
        patterns: [/VENDOR|SUPPLIER|PABRIKAN|PEMASOK/],
      },
      {
        key: 'vendorPic', label: 'PIC', kind: 'text', width: 20,
        vendorEditable: true, logged: true,
        patterns: [/\bPIC\b|CONTACT\s*PERSON|PENANGGUNG\s*JAWAB/],
      },
      {
        // Text, not a number: a leading zero or +62 must survive the round trip.
        key: 'vendorPhone', label: 'PIC Number', kind: 'text', width: 20,
        vendorEditable: true, logged: true,
        patterns: [/PIC\s*(NO|NUMBER|PHONE)|\bWA\b|WHATSAPP|TELEPON|\bHP\b/],
      },
      {
        key: 'brand', label: 'Brand', kind: 'text', width: 14,
        vendorEditable: true, logged: true,
        patterns: [/BRAND|MEREK|MERK|MANUFACTURER/],
      },
      {
        key: 'delivery', label: 'Delivery term', kind: 'text', width: 13,
        vendorEditable: false, logged: false,
        patterns: [/DELIVERY\s*TERM|INCOTERM|\bTERM\s*OF\s*DELIV/],
      },
    ],
  },
  {
    label: 'PO & Documents', colour: GREEN, fields: [
      {
        key: 'poNo', label: 'PO no.', kind: 'text', width: 15,
        vendorEditable: false, logged: false,
        patterns: [/\bPO\b.*\b(NO|NUMBER|NOMOR)\b/, /^PO\s*NO/],
      },
      {
        key: 'poDate', label: 'PO date', kind: 'date', width: 11.5,
        vendorEditable: false, logged: false,
        patterns: [/\bPO\s*(DATE|TGL|TANGGAL)\b/],
      },
      {
        key: 'doNo', label: 'No. DO', kind: 'text', width: 18,
        vendorEditable: true, logged: true,
        patterns: [/\bDO\b\s*(NO|NUMBER|NOMOR)?\.?$/, /DELIVERY\s*ORDER|SURAT\s*JALAN/],
      },
      {
        key: 'readinessDoc', label: 'Doc. readiness', kind: 'percent', width: 11.5,
        vendorEditable: true, logged: true,
        patterns: [/READINESS|KELENGKAPAN\s*DOK|DOC.*READY/],
      },
      {
        key: 'termOfPayment', label: 'Term of payment', kind: 'longtext', width: 24,
        vendorEditable: false, logged: false,
        patterns: [/TERM.*PAYMENT|PAYMENT.*TERM|TERMIN/],
      },
    ],
  },
  {
    label: 'MFG — Manufacturing / Fabrication', colour: PEACH, fields: [
      {
        key: 'mfg.plan', label: 'MFG Plan %', short: 'Plan %', kind: 'percent', width: 11.5,
        vendorEditable: false, logged: true,
      },
      {
        key: 'mfg.actual', label: 'MFG Actual %', short: 'Actual %', kind: 'percent', width: 11.5,
        vendorEditable: true, logged: true,
      },
      {
        key: 'mfg.note', label: 'MFG Note', short: 'Note', kind: 'longtext', width: 26,
        vendorEditable: true, logged: false,
      },
    ],
  },
  milestoneGroup('fat', 'FAT — Factory Acceptance Test'),
  milestoneGroup('rts', 'RTS — Ready To Ship'),
  milestoneGroup('mos', 'MOS — Material On Site'),
  {
    label: 'Catatan', colour: YELLOW, fields: [
      {
        key: 'statusNote', label: 'Status note', kind: 'longtext', width: 32,
        vendorEditable: true, logged: false,
        patterns: [/KETERANGAN|REMARK|CATATAN|NOTE|STATUS$/],
      },
      {
        key: 'changeReason', label: 'Alasan perubahan', kind: 'longtext', width: 30,
        vendorEditable: true, logged: false,
        patterns: [/ALASAN|REASON|PENYEBAB/],
      },
    ],
  },
];

/** Every sheet column, left to right. */
export const SHEET_FIELDS: FieldDef[] = FIELD_GROUPS.flatMap(g => g.fields);

export const FIELD_BY_KEY: Record<SheetFieldKey, FieldDef> =
  Object.fromEntries(SHEET_FIELDS.map(f => [f.key, f])) as Record<SheetFieldKey, FieldDef>;

/**
 * Fields a vendor may change — the import's allow-list.
 * `status` and `progress` are absent on purpose: both are derived from the
 * milestones by `deriveStatus`, and a progress figure typed by the vendor
 * cannot be audited against anything.
 */
export const VENDOR_FIELDS: ItemFieldKey[] = SHEET_FIELDS
  .filter(f => f.vendorEditable && f.key !== 'changeReason')
  .map(f => f.key as ItemFieldKey);

/** Fields whose changes earn a line in the update log. */
export const LOGGED_FIELDS: ItemFieldKey[] = SHEET_FIELDS
  .filter(f => f.logged)
  .map(f => f.key as ItemFieldKey);

/** Manufacturing keeps numbers where the milestones keep dates. */
export function isManufacturingField(key: string): boolean {
  return key === 'mfg.plan' || key === 'mfg.actual' || key === 'mfg.note';
}

export function isMilestoneField(key: string): key is MilestoneField {
  return /^(fat|rts|mos)\.(plan|forecast|actual|note)$/.test(key);
}

/** Read a field off an item by key, milestone paths included. */
export function readField(item: ProcurementItem, key: ItemFieldKey): string | number {
  if (isManufacturingField(key)) {
    const part = key.split('.')[1] as 'plan' | 'actual' | 'note';
    return item.mfg?.[part] ?? (part === 'note' ? '' : 0);
  }
  if (isMilestoneField(key)) {
    const [stage, part] = key.split('.') as [MilestoneKey, keyof MilestoneEntry];
    return item[stage]?.[part] ?? '';
  }
  const value = item[key as keyof ProcurementItem];
  if (typeof value === 'number') return value;
  return typeof value === 'string' ? value : '';
}

/** Write a field onto a draft item, replacing the milestone rather than mutating it. */
export function writeField(
  draft: ProcurementItem, key: ItemFieldKey, value: string | number,
): void {
  if (isManufacturingField(key)) {
    const part = key.split('.')[1] as 'plan' | 'actual' | 'note';
    const base = draft.mfg ?? { plan: 0, actual: 0, note: '' };
    draft.mfg = part === 'note'
      ? { ...base, note: String(value) }
      : { ...base, [part]: Number(value) || 0 };
    return;
  }
  if (isMilestoneField(key)) {
    const [stage, part] = key.split('.') as [MilestoneKey, keyof MilestoneEntry];
    draft[stage] = { ...draft[stage], [part]: String(value) };
    return;
  }
  if (key === 'qty' || key === 'readinessDoc') {
    draft[key] = Number(value) || 0;
    return;
  }
  (draft as unknown as Record<string, unknown>)[key] = String(value);
}

/** The name a field goes by in an update-log line. */
export function fieldLabel(key: SheetFieldKey): string {
  return FIELD_BY_KEY[key]?.label ?? key;
}
