import type ExcelJS from 'exceljs';
import type { ItemEvent, ProcurementItem } from '@/types';
import { FIELD_BY_KEY, type ItemFieldKey, VENDOR_FIELDS, readField, writeField } from './fields';
import { type FormScope, VENDOR_SHEET, VENDOR_TEMPLATE_MARKER } from './vendorSheet';
import { deriveStatus } from './procurement';
import { loadExcelJS, newWorkbook } from './exceljs';
import { blockers, validateItem } from './rules';
import { appendEvents, createdEvent, diffItem } from './itemLog';

/* ═══════════════════════════════════════════════════════════
   Reading a returned vendor form.

   The sheet was written by us, so nothing here guesses: the
   hidden `_meta` sheet says which row holds which field and which
   item each column was cut from, and the workbook is refused
   outright if it belongs to another project.

   Only the fields the vendor was allowed to edit are read back.
   A blank cell means "no news", never "delete what you had" —
   that distinction is the difference between an update and a
   quiet loss of everything we knew.
   ═══════════════════════════════════════════════════════════ */

export type ChangeKind = 'slip' | 'gain' | 'milestone' | 'new-info' | 'edit';

export interface FieldChange {
  key: ItemFieldKey;
  /** Row label as it appears in the sheet, e.g. "Forecast". */
  label: string;
  /** Stage prefix for milestone fields, e.g. "MOS". */
  stage: string;
  from: string;
  to: string;
  kind: ChangeKind;
}

export interface VendorColumn {
  /** Applied unless the user unticks it. */
  include: boolean;
  /**
   * The changes would leave the item breaking a procurement rule, so it cannot
   * be applied until the vendor sends a corrected form.
   */
  blocked?: boolean;
  /**
   * Something here has to be settled with the vendor: a cell of ours they
   * typed over, or a value nobody can read. It does not stop the rest of the
   * column landing — but a form holding nothing else is refused outright,
   * rather than shown as a card with nothing to tick.
   */
  queried?: boolean;
  /**
   * The item is gone from the project and the form still carries every field
   * the app printed into it, so it can be put back rather than typed in again.
   * Ticking the column re-creates this record instead of updating one.
   */
  restore?: ProcurementItem;
  itemId: string;
  /** Description as we hold it, for the preview header. */
  desc: string;
  changes: FieldChange[];
  warnings: string[];
}

export interface VendorImportResult {
  /**
   * True once the workbook is recognised as one of our vendor forms. The
   * import dialog reads this to decide which reader owns the file, rather
   * than matching on the wording of an error.
   */
  isVendorForm: boolean;
  /** Whether the form was cut for a whole vendor or for a single item. */
  scope: FormScope;
  vendor: string;
  projectId: string;
  projectName: string;
  /** When the form was generated, so a stale one can be spotted. */
  generatedAt: string;
  columns: VendorColumn[];
  /** Blocking problems: wrong project, missing sheet, unreadable file. */
  errors: string[];
}

/** ExcelJS cells hold rich text, formulas and hyperlinks — flatten them all. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return isoOf(value);
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return v.richText.map(t => (t as { text?: string }).text ?? '').join('').trim();
    }
    if ('result' in v) return cellText(v.result);
    if ('text' in v) return cellText(v.text);
    if ('hyperlink' in v) return cellText(v.text ?? v.hyperlink);
  }
  return String(value).trim();
}

function isoOf(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** The one date shape the sheet asks for is validated, so this stays small. */
function readDate(raw: unknown): string | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) return isoOf(raw);

  const text = cellText(raw);
  if (!text) return '';
  // A literal dash is how the sheet says "clear the date we sent".
  if (/^[-–—]$/.test(text)) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  // Excel serial, in case a cell lost its date format on the way back.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const d = new Date((Number(text) - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

function readPercent(raw: unknown): number | null {
  const text = cellText(raw);
  if (!text) return null;
  const n = Number(text.replace(/[%\s]/g, '').replace(',', '.'));
  if (isNaN(n)) return null;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

/** Read the hidden sheet the exporter wrote. */
function readMeta(wb: ExcelJS.Workbook): Map<string, string> {
  const meta = new Map<string, string>();
  const sheet = wb.getWorksheet('_meta');
  if (!sheet) return meta;
  sheet.eachRow(row => {
    const key = cellText(row.getCell(1).value);
    if (key) meta.set(key, cellText(row.getCell(2).value));
  });
  return meta;
}

/** How a change should read: a slipped forecast is what the user is scanning for. */
function classify(key: ItemFieldKey, from: string, to: string): ChangeKind {
  if (/\.actual$/.test(key) && !from) return 'milestone';
  if (/\.forecast$/.test(key) && from && to) return to > from ? 'slip' : 'gain';
  if (!from) return 'new-info';
  return 'edit';
}

const STAGE_NAMES: Record<string, string> = { mfg: 'MFG', fat: 'FAT', rts: 'RTS', mos: 'MOS' };

/**
 * Read a returned form and work out what changed.
 *
 * Nothing is written here: the caller shows the changes for review and applies
 * them separately, so an import can be read before it lands.
 */
export async function readVendorWorkbook(
  file: File,
  items: ProcurementItem[],
  projectId: string,
  expectItem?: ProcurementItem | null,
): Promise<VendorImportResult> {
  const result: VendorImportResult = {
    isVendorForm: false, scope: 'vendor',
    vendor: '', projectId: '', projectName: '', generatedAt: '', columns: [], errors: [],
  };

  await loadExcelJS();
  const wb = newWorkbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    result.errors.push('Could not read the file. Make sure it is .xlsx, not .xls or .csv.');
    return result;
  }

  const meta = readMeta(wb);
  if (wb.category !== VENDOR_TEMPLATE_MARKER || meta.get('marker') !== VENDOR_TEMPLATE_MARKER) {
    return result;
  }
  result.isVendorForm = true;

  result.vendor = meta.get('vendor') ?? '';
  result.scope = meta.get('scope') === 'item' ? 'item' : 'vendor';
  result.projectId = meta.get('projectId') ?? '';
  result.projectName = meta.get('projectName') ?? '';
  result.generatedAt = meta.get('generatedAt') ?? '';

  if (projectId && result.projectId && result.projectId !== projectId) {
    result.errors.push(
      `This form belongs to "${result.projectName || 'another project'}". `
      + 'Switch to that project before importing it.',
    );
    return result;
  }

  /* Read from one item's screen, the file has one item to be about. A form for
     someone else's equipment is refused outright rather than half-applied: the
     vendor is asked again, which is cheaper than a date landing on the wrong
     item and nobody noticing until the truck arrives.

     An item with no vendor recorded is a gap on our side, not the vendor's, so
     it is left to the column check below — which proves identity outright. */
  if (expectItem && result.vendor && expectItem.vendor && !sameName(result.vendor, expectItem.vendor)) {
    result.errors.push(
      `This form was issued to "${result.vendor}", but "${expectItem.desc}" is supplied by `
      + `"${expectItem.vendor || '—'}". Check you opened the right item, or ask the vendor to `
      + 'send back the form for this one.',
    );
    return result;
  }

  const sheet = wb.getWorksheet(VENDOR_SHEET);
  if (!sheet) {
    result.errors.push(`The "${VENDOR_SHEET}" sheet is missing from this file.`);
    return result;
  }

  /* Row per field, straight from the file rather than recomputed — a sheet
     whose rows shifted still reads correctly. */
  const rowOf = new Map<ItemFieldKey, number>();
  for (const [key, value] of meta) {
    if (key.startsWith('row.')) rowOf.set(key.slice(4) as ItemFieldKey, Number(value));
  }

  const byId = new Map(items.map(i => [i.id, i]));

  for (const [key, value] of meta) {
    if (!key.startsWith('col.')) continue;
    const col = Number(key.slice(4));
    const [itemId, poNo, desc] = value.split(' | ');

    /* PO number and description are a second opinion on which item this column
       is. Nothing in the sheet is locked, so one of them coming back changed is
       a vendor correcting us, and it is read as such further down. Both changed
       is a column that is no longer the column it was cut as — a rebuilt file,
       or one whose columns were shuffled — and nothing read out of it can be
       trusted, so that is settled before the item is even looked up. */
    const sheetPo = cellText(sheet.getCell(rowOf.get('poNo') ?? 0, col).value);
    const sheetDesc = cellText(sheet.getCell(rowOf.get('desc') ?? 0, col).value);
    if (sheetPo !== poNo && sheetDesc !== desc) {
      result.columns.push({
        include: false, itemId, desc: desc ?? '', changes: [], blocked: true,
        warnings: [
          'Neither the PO number nor the description in this column matches the '
          + 'item it was cut for, so there is no telling which equipment it is '
          + 'about. Ask the vendor to fill in the form as it was sent.',
        ],
      });
      continue;
    }

    /* The item may have been deleted, or deleted and typed in again — in which
       case it is here under a new id, and the two locked cells have just proved
       which one it is. Re-linking beats adding a second copy of equipment
       already on the schedule. */
    const item = byId.get(itemId) ?? items.find(i => sameItem(i, poNo, desc));

    /* Still nothing, so the item really is gone. The form carries every field
       the app printed into it, so it is offered back whole — unticked, because
       deleting was deliberate and undoing it should be too. */
    if (!item) {
      const draft = restoreFrom(sheet, rowOf, col, itemId, projectId || result.projectId);
      const broken = blockers(validateItem(draft));
      result.columns.push({
        include: false,
        itemId,
        desc: draft.desc || desc || '',
        changes: [],
        restore: broken.length ? undefined : draft,
        blocked: broken.length > 0,
        warnings: broken.length
          ? broken.map(v => v.message)
          : ['This item is no longer in the project. Tick it to put it back from this form.'],
      });
      continue;
    }

    const warnings: string[] = [];
    let unreadable = false;
    if (item.id !== itemId) {
      warnings.push(
        'This item was deleted and added again since the form went out; it was matched '
        + 'back by PO number and description.',
      );
    }

    /* The cells we own are tinted grey rather than bolted shut, so a vendor who
       spots a wrong quantity can say so. What comes back is reported, never
       applied: these are contractual, and a PO number is not settled by
       whoever typed last. The two can also disagree because we changed
       something after the form went out, which is why it is put as a
       disagreement rather than as a complaint. */
    const disputed: string[] = [];
    for (const [fieldKey, row] of rowOf) {
      const def = FIELD_BY_KEY[fieldKey];
      if (!def || def.vendorEditable) continue;

      const raw = sheet.getCell(row, col).value;
      // A cleared cell is a cell nobody filled in, not a correction to nothing.
      if (cellText(raw) === '') continue;

      let theirs: string;
      if (def.kind === 'date') {
        const date = readDate(raw);
        if (!date) continue;
        theirs = date;
      } else if (def.kind === 'percent') {
        const pct = readPercent(raw);
        if (pct === null) continue;
        theirs = String(pct);
      } else {
        theirs = cellText(raw);
      }

      const ours = String(readField(item, fieldKey) ?? '');
      if (theirs === ours) continue;
      disputed.push(`${labelOf(fieldKey)}: form says “${theirs}”, we hold “${ours || '—'}”`);
    }
    if (disputed.length) {
      warnings.push(
        `${disputed.join('; ')}. Those are ours to set, so nothing was applied for `
        + 'them — settle which side is right, then send the vendor a fresh form.',
      );
    }

    const changes: FieldChange[] = [];

    for (const fieldKey of VENDOR_FIELDS) {
      const row = rowOf.get(fieldKey);
      if (!row) continue;

      const def = FIELD_BY_KEY[fieldKey];
      const raw = sheet.getCell(row, col).value;
      const before = String(readField(item, fieldKey) ?? '');

      let next: string | null;
      if (def.kind === 'date') {
        next = readDate(raw);
        if (next === null) {
          warnings.push(`${labelOf(fieldKey)}: "${cellText(raw)}" is not a date we can read.`);
          unreadable = true;
          continue;
        }
      } else if (def.kind === 'percent') {
        const pct = readPercent(raw);
        next = pct === null ? '' : String(pct);
      } else {
        next = cellText(raw);
      }

      // An empty cell is no news. Clearing a value takes a literal dash, which
      // `readDate` turns into an empty string of its own accord.
      const blank = cellText(raw) === '';
      if (blank && before) continue;
      if (String(next) === before) continue;

      changes.push({
        key: fieldKey,
        label: def.short ?? def.label,
        stage: STAGE_NAMES[fieldKey.split('.')[0]] ?? '',
        from: before,
        to: String(next),
        kind: classify(fieldKey, before, String(next)),
      });
    }

    /* Judge the item the change would produce, not the change on its own: a
       vendor reporting FAT while manufacturing sits at 80% is only visible once
       both values are read together. A breach holds the column back rather than
       silently landing a record the form itself would have refused. */
    const projected: ProcurementItem = { ...item };
    for (const change of changes) writeField(projected, change.key, change.to);
    const broken = blockers(validateItem(projected));
    for (const violation of broken) warnings.push(violation.message);

    result.columns.push({
      include: changes.length > 0 && broken.length === 0,
      itemId: item.id,
      desc: item.desc,
      changes,
      warnings,
      blocked: broken.length > 0,
      queried: disputed.length > 0 || unreadable,
    });
  }

  if (!result.columns.length) {
    result.errors.push('No item columns were found in this form.');
    return result;
  }

  if (expectItem) {
    const mine = result.columns.find(c => c.itemId === expectItem.id);
    if (!mine) {
      result.errors.push(
        `This form does not cover "${expectItem.desc}". It covers `
        + `${describe(result.columns)}. Ask the vendor to send back the progress form `
        + 'issued for this item.',
      );
      return result;
    }

    const others = result.columns.length - 1;
    result.columns = [mine];

    /* Identity failed, or the item is gone: nothing here can be applied, so it
       is stated as an error rather than shown as a card the user cannot tick.
       Only the reasons it failed are promoted — the note about the rest of the
       form is an aside, and there is no rest of the form to go back to. */
    if (mine.blocked && !mine.changes.length) {
      result.errors.push(...mine.warnings);
      return result;
    }

    /* A form cut for the whole vendor still reads here — only the column for
       this item is kept, and the others are left for the overview import. */
    if (others > 0) {
      mine.warnings = [
        ...mine.warnings,
        `The form also covers ${others} other item${others === 1 ? '' : 's'}; `
        + 'import it from the Overview to review those too.',
      ];
    }
  }

  /* Nothing came back that can be looked at, and something is wrong with the
     form: refuse it once, with the reason, rather than leaving a grey "nothing
     to apply" sitting over a stack of red cards nobody can tick. Two readings
     of the same file leave the reader deciding which one to believe.

     A column held back over a rule keeps its card — the dates the vendor
     reported are the whole point of opening the file. */
  const readable = result.columns.some(c => c.changes.length || c.restore);
  const stopped = result.columns.filter(c => c.blocked || c.queried);
  if (!readable && stopped.length) {
    for (const column of stopped) {
      for (const warning of column.warnings) {
        result.errors.push(column.desc ? `${column.desc} — ${warning}` : warning);
      }
    }
  }

  return result;
}

/**
 * What a form turned out to be about, for an error the reader can act on.
 *
 * A vendor form can carry dozens of columns, and naming all of them buries the
 * sentence that matters in a list nobody reads to the end.
 */
function describe(columns: VendorColumn[]): string {
  const names = columns.map(c => c.desc).filter(Boolean);
  if (!names.length) return 'other equipment';
  const shown = names.slice(0, 3).join(', ');
  const rest = names.length - 3;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/** Vendor names travel through Excel and back; case and spacing drift, wording doesn't. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(a) === norm(b);
}

/**
 * The same equipment under a different id.
 *
 * Both halves have to agree: a PO number can cover several line items, and two
 * projects can carry the same description, so neither alone is proof.
 */
function sameItem(item: ProcurementItem, poNo: string, desc: string): boolean {
  return sameName(item.poNo, poNo ?? '') && sameName(item.desc, desc ?? '');
}

/**
 * Rebuild an item out of the form it was cut into.
 *
 * Every row the sheet holds is read, the locked ones included — what the vendor
 * may type is only part of what is printed there. Discipline and payment terms
 * are the two the form leaves out on purpose, so they come back empty and the
 * import dialog asks for the discipline before the item lands.
 */
function restoreFrom(
  sheet: ExcelJS.Worksheet,
  rowOf: Map<ItemFieldKey, number>,
  col: number,
  id: string,
  projectId: string,
): ProcurementItem {
  const milestone = () => ({ plan: '', forecast: '', actual: '', note: '' });
  const draft: ProcurementItem = {
    id, projectId,
    desc: '', discipline: '', qty: 0, unit: '',
    vendor: '', vendorPic: '', vendorPhone: '', brand: '', delivery: '',
    poNo: '', poDate: '', statusNote: '', readinessDoc: 0, doNo: '', termOfPayment: '',
    mfg: { plan: 0, actual: 0, note: '' },
    fat: milestone(), rts: milestone(), mos: milestone(),
    status: 'planning', progress: 0,
    createdAt: new Date().toISOString(),
    events: [],
  };

  for (const [key, row] of rowOf) {
    const def = FIELD_BY_KEY[key];
    if (!def) continue;
    const raw = sheet.getCell(row, col).value;

    if (def.kind === 'date') {
      const date = readDate(raw);
      if (date) writeField(draft, key, date);
    } else if (def.kind === 'percent') {
      const pct = readPercent(raw);
      if (pct !== null) writeField(draft, key, String(pct));
    } else {
      const text = cellText(raw);
      if (text) writeField(draft, key, text);
    }
  }

  Object.assign(draft, deriveStatus(draft));
  return draft;
}

function labelOf(key: ItemFieldKey): string {
  const def = FIELD_BY_KEY[key];
  const stage = STAGE_NAMES[key.split('.')[0]];
  return stage ? `${stage} ${def.short ?? def.label}` : def.label;
}

export interface ApplyResult {
  items: ProcurementItem[];
  updated: number;
  changed: number;
  /** Items put back because they were no longer in the project. */
  restored: number;
}

/**
 * Fold the reviewed changes into the items.
 *
 * Fields are merged one at a time rather than by replacing the milestone
 * objects wholesale, so a vendor reporting only an actual date cannot wipe the
 * forecast we were tracking. Status and progress are recomputed afterwards, and
 * every change lands in the item's log.
 */
export function applyVendorImport(
  items: ProcurementItem[],
  result: VendorImportResult,
  columns: VendorColumn[],
): ApplyResult {
  const at = new Date().toISOString();
  const byId = new Map(items.map(i => [i.id, i]));
  let updated = 0, changed = 0, restored = 0;

  for (const column of columns) {
    if (!column.include) continue;

    /* An item the project lost, put back as the form last saw it. It keeps the
       id the form was cut against, so the same file still reads next time. */
    if (column.restore) {
      byId.set(column.restore.id, {
        ...column.restore,
        events: [createdEvent({ source: 'vendor-import', actor: result.vendor || 'Vendor', at })],
      });
      restored += 1;
      continue;
    }

    if (!column.changes.length) continue;
    const before = byId.get(column.itemId);
    if (!before) continue;

    const draft: ProcurementItem = { ...before };
    for (const change of column.changes) writeField(draft, change.key, change.to);
    Object.assign(draft, deriveStatus(draft));

    const events: ItemEvent[] = diffItem(before, draft, {
      source: 'vendor-import',
      actor: result.vendor || 'Vendor',
      at,
    });
    draft.events = appendEvents(before, events);

    byId.set(draft.id, draft);
    updated += 1;
    changed += column.changes.length;
  }

  return { items: [...byId.values()], updated, changed, restored };
}
