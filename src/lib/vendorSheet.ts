import ExcelJS from 'exceljs';
import type { ProcurementItem, Project } from '@/types';
import {
  BLACK, CREAM, DATE_FMT, FONT, GREY, INPUT, LEFT, LOCKED, PCT_FMT,
  body, fill, rule, sheetOptions, shortDate,
} from './excelTheme';
import { downloadWorkbook } from './download';
import { FIELD_BY_KEY, type FieldDef, type ItemFieldKey, readField } from './fields';
import { today } from './procurement';

/* ═══════════════════════════════════════════════════════════
   The sheet a vendor fills in, drawn like the Summary page of
   the project workbook: same Calibri 10, same cream section
   bands, same grey heads and black rules.

   Fields run down the sheet and each item takes one column, so a
   vendor reads one item top to bottom instead of tracking a row
   across thirty columns.

   Their cells are tinted; ours are grey and locked. Nothing else
   is on the sheet — the colours carry the instructions. Adding
   equipment is our job in the app, so there is nowhere here to do
   it: this file is for reporting progress on what we already sent.
   ═══════════════════════════════════════════════════════════ */

/** Stamped on the workbook so the importer knows it is reading its own file. */
export const VENDOR_TEMPLATE_MARKER = 'figtries-vendor-template';

export const VENDOR_SHEET = 'Progress Update';

/**
 * Whether the form covers everything one vendor supplies, or the single item
 * whose detail screen it was cut from. The sheet is identical either way; the
 * importer reads this to know what it is allowed to land.
 */
export type FormScope = 'vendor' | 'item';

const META_SHEET = '_meta';

const LABEL_COL = 1;
const COLON_COL = 2;
const FIRST_ITEM_COL = 3;
/** Two caption lines and a thin gap sit above the first section band. */
const FIRST_BODY_ROW = 4;

interface Block {
  /** Named only inside Milestone Schedule, where three stages share a section. */
  label?: string;
  keys: ItemFieldKey[];
}

interface Section {
  heading: string;
  blocks: Block[];
}

/**
 * What the vendor is asked for.
 *
 * Discipline and payment terms are ours to set in the app, so they are not
 * here — a vendor guessing at either only makes work.
 */
const LAYOUT: Section[] = [
  {
    heading: 'Equipment',
    blocks: [{ keys: ['desc', 'qty', 'unit'] }],
  },
  {
    heading: 'Vendor',
    blocks: [{ keys: ['vendor', 'vendorPic', 'vendorPhone', 'brand', 'delivery'] }],
  },
  {
    heading: 'PO & Documents',
    blocks: [{ keys: ['poNo', 'poDate', 'readinessDoc', 'doNo', 'statusNote'] }],
  },
  {
    heading: 'MFG — Manufacturing / Fabrication',
    blocks: [{ keys: ['mfg.plan', 'mfg.actual', 'mfg.note'] }],
  },
  {
    heading: 'Milestone Schedule',
    blocks: [
      { label: 'FAT — Factory Acceptance Test', keys: ['fat.plan', 'fat.forecast', 'fat.actual', 'fat.note'] },
      { label: 'RTS — Ready To Ship', keys: ['rts.plan', 'rts.forecast', 'rts.actual', 'rts.note'] },
      { label: 'MOS — Material On Site', keys: ['mos.plan', 'mos.forecast', 'mos.actual', 'mos.note'] },
    ],
  },
];

/** Row labels: the milestone rows say "Plan", the section says which stage. */
function rowLabel(field: FieldDef): string {
  return field.short ?? field.label;
}

/** Value for a cell, typed so the vendor's Excel treats a date as a date. */
function cellValue(item: ProcurementItem, field: FieldDef): string | number | Date | null {
  const raw = readField(item, field.key as ItemFieldKey);
  if (field.kind === 'date') {
    const iso = String(raw);
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d, 12) : null;
  }
  if (field.kind === 'percent' || field.kind === 'qty') return Number(raw) || 0;
  return String(raw ?? '');
}

/** Validation that stops a vendor typing something the importer cannot read. */
function applyValidation(cell: ExcelJS.Cell, field: FieldDef): void {
  if (field.kind === 'date') {
    cell.dataValidation = {
      type: 'date',
      operator: 'between',
      allowBlank: true,
      showErrorMessage: true,
      formulae: [new Date(2000, 0, 1), new Date(2100, 0, 1)],
      errorStyle: 'warning',
      errorTitle: 'Tanggal tidak dikenali',
      error: 'Tulis tanggal dalam format dd/mm/yyyy, misalnya 04/09/2026.',
    };
    return;
  }
  if (field.kind === 'percent') {
    cell.dataValidation = {
      type: 'decimal',
      operator: 'between',
      allowBlank: true,
      showErrorMessage: true,
      formulae: [0, 1],
      errorStyle: 'warning',
      errorTitle: 'Di luar rentang',
      error: 'Isi antara 0% dan 100%.',
    };
  }
}

/* ─────────────── The sheet ─────────────── */

/**
 * Caption: the title on its own line, then a cream band carrying the project
 * name with the date at its right end.
 *
 * The title used to be merged across the label column only, which is narrower
 * than the words are — Excel clipped it and wrapped it over the project name.
 * It now spans the whole table and never wraps, and the project name sits in a
 * band of its own so it reads as the heading it is.
 */
function writeCaption(
  sheet: ExcelJS.Worksheet, span: number, project: Project | null,
): void {
  /** The caption lines must not wrap: they are headings, not cells of text. */
  const flush = { vertical: 'middle' as const, horizontal: 'left' as const, indent: 1 };

  sheet.mergeCells(1, LABEL_COL, 1, span);
  const title = sheet.getCell(1, LABEL_COL);
  title.value = 'PROGRESS UPDATE VENDORS';
  title.font = { name: FONT, size: 13, bold: true, color: { argb: BLACK } };
  title.alignment = flush;
  sheet.getRow(1).height = 21;

  const nameTo = Math.max(LABEL_COL, span - 1);
  if (nameTo > LABEL_COL) sheet.mergeCells(2, LABEL_COL, 2, nameTo);
  const name = sheet.getCell(2, LABEL_COL);
  name.value = project?.name ?? 'All projects';
  name.font = body({ bold: true, size: 12 });
  name.alignment = flush;

  const stamp = sheet.getCell(2, span);
  stamp.value = shortDate(today());
  stamp.font = body({ bold: true, size: 10 });
  stamp.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

  /* One band across both, so the name and the date read as a single header.
     Only the master cell of a merged run may be styled: writing to a slave
     overwrites the master, and the run loses the edge it was given. */
  fill(name, CREAM);
  name.border = rule('medium', 'medium', 'medium', 'thin');
  fill(stamp, CREAM);
  stamp.border = rule('medium', 'thin', 'medium', 'medium');
  sheet.getRow(2).height = 20;

  sheet.getRow(3).height = 6;
}

interface Layout {
  /** Sheet row holding each field, for the importer to find them again. */
  rowOf: Map<ItemFieldKey, number>;
  lastRow: number;
}

function writeBody(
  sheet: ExcelJS.Worksheet, items: ProcurementItem[], span: number,
): Layout {
  const rowOf = new Map<ItemFieldKey, number>();
  let r = FIRST_BODY_ROW;

  /* Cream section band, the way the Summary sheet marks a block. */
  const heading = (text: string) => {
    sheet.mergeCells(r, LABEL_COL, r, span);
    const cell = sheet.getCell(r, LABEL_COL);
    cell.value = text.toUpperCase();
    cell.font = body({ bold: true });
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    fill(cell, CREAM);
    // Merged across the whole width, so it carries the outer rule on both sides.
    cell.border = rule('medium', 'medium', 'medium', 'medium');
    sheet.getRow(r).height = 18;
    r += 1;
  };

  /* Grey strip naming one milestone stage inside the section above it. */
  const stage = (text: string) => {
    sheet.mergeCells(r, LABEL_COL, r, span);
    const cell = sheet.getCell(r, LABEL_COL);
    cell.value = text;
    cell.font = body({ bold: true, size: 9.5 });
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    fill(cell, GREY);
    cell.border = rule('thin', 'medium', 'thin', 'medium');
    sheet.getRow(r).height = 16;
    r += 1;
  };

  const field = (key: ItemFieldKey) => {
    const def = FIELD_BY_KEY[key];
    rowOf.set(key, r);

    // Every cell in the row is ruled, label and gutter included: a grid that
    // stops halfway across reads as a mistake, not as emphasis.
    const label = sheet.getCell(r, LABEL_COL);
    label.value = rowLabel(def);
    label.font = body();
    label.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    label.border = rule('thin', 'medium', 'thin', 'thin');

    const colon = sheet.getCell(r, COLON_COL);
    colon.value = ':';
    colon.font = body();
    colon.alignment = { vertical: 'middle', horizontal: 'center' };
    colon.border = rule('thin', 'thin', 'thin', 'medium');

    for (let c = FIRST_ITEM_COL; c <= span; c++) {
      const item = items[c - FIRST_ITEM_COL];
      const cell = sheet.getCell(r, c);
      if (item) cell.value = cellValue(item, def);

      // Everything reads down one column, so everything is aligned the same
      // way. Centring the dates and leaving the text ragged made the column
      // look like two columns.
      cell.font = body();
      cell.alignment = LEFT;
      if (def.kind === 'date') cell.numFmt = DATE_FMT;
      if (def.kind === 'percent') cell.numFmt = PCT_FMT;
      cell.border = rule(
        'thin', c === FIRST_ITEM_COL ? 'medium' : 'thin', 'thin', c === span ? 'medium' : 'thin',
      );
      cell.protection = { locked: !def.vendorEditable };
      fill(cell, def.vendorEditable ? INPUT : LOCKED);
      if (def.vendorEditable) applyValidation(cell, def);
    }
    r += 1;
  };

  for (const section of LAYOUT) {
    heading(section.heading);
    for (const block of section.blocks) {
      if (block.label) stage(block.label);
      block.keys.forEach(field);
    }
  }

  /* Close the block off, so the table ends on a rule rather than trailing away. */
  const lastRow = r - 1;
  for (let c = 1; c <= span; c++) {
    const cell = sheet.getCell(lastRow, c);
    cell.border = { ...cell.border, bottom: { style: 'medium', color: { argb: BLACK } } };
  }

  return { rowOf, lastRow };
}

/**
 * Who this file was cut for, and what each row and column holds.
 *
 * This is how the importer knows what it is reading. The project id stops a
 * sheet returned against the wrong project from landing junk in someone else's
 * schedule. The row map means a sheet that grew a row still reads back. The
 * column map ties a column to the item it was cut from, so nothing depends on
 * a code printed in the sheet — the vendor cannot break a link they cannot see.
 */
function buildMeta(
  wb: ExcelJS.Workbook, project: Project | null, vendor: string,
  items: ProcurementItem[], revision: number, layout: Layout, scope: FormScope,
): void {
  const sheet = wb.addWorksheet(META_SHEET);
  sheet.state = 'veryHidden';
  sheet.columns = [{ width: 20 }, { width: 46 }];

  const pairs: Array<[string, string]> = [
    ['marker', VENDOR_TEMPLATE_MARKER],
    ['scope', scope],
    ['projectId', project?.id ?? ''],
    ['projectName', project?.name ?? ''],
    ['vendor', vendor],
    ['revision', String(revision)],
    ['generatedAt', new Date().toISOString()],
    ['itemCount', String(items.length)],
    ['labelCol', String(LABEL_COL)],
    ['firstItemCol', String(FIRST_ITEM_COL)],
    ['firstBodyRow', String(FIRST_BODY_ROW)],
    ['lastRow', String(layout.lastRow)],
  ];
  pairs.forEach(([key, value], i) => {
    const row = sheet.getRow(i + 1);
    row.getCell(1).value = key;
    row.getCell(2).value = value;
  });

  let r = pairs.length + 2;

  /* Which row holds which field. */
  for (const [key, row] of layout.rowOf) {
    sheet.getRow(r).getCell(1).value = `row.${key}`;
    sheet.getRow(r).getCell(2).value = String(row);
    r += 1;
  }

  /* Which item each column was cut from. PO number and description ride along
     as a second opinion: both are locked in the sheet, so if they still match
     on the way back, the column is certainly the item we think it is. */
  items.forEach((item, i) => {
    const col = FIRST_ITEM_COL + i;
    sheet.getRow(r).getCell(1).value = `col.${col}`;
    sheet.getRow(r).getCell(2).value = [item.id, item.poNo, item.desc].join(' | ');
    r += 1;
  });
}

/* ─────────────── Entry point ─────────────── */

/** One vendor's items, grouped by discipline so related equipment sits together. */
export function vendorItems(items: ProcurementItem[], vendor: string): ProcurementItem[] {
  return items
    .filter(i => i.vendor === vendor)
    .sort((a, b) => a.discipline.localeCompare(b.discipline) || a.desc.localeCompare(b.desc));
}

function buildForm(
  project: Project | null,
  vendor: string,
  rows: ProcurementItem[],
  revision: number,
  scope: FormScope,
): ExcelJS.Workbook {
  // One column per item, and at least one so an empty vendor still reads.
  const span = COLON_COL + Math.max(1, rows.length);

  const wb = new ExcelJS.Workbook();
  wb.creator = project?.pic || 'Procurement';
  wb.company = project?.client || '';
  wb.created = new Date();
  wb.title = `Progress Update Vendors — ${vendor}`;
  wb.subject = [project?.name, vendor, `rev ${revision}`].filter(Boolean).join(' · ');
  wb.category = VENDOR_TEMPLATE_MARKER;

  const sheet = wb.addWorksheet(VENDOR_SHEET, {
    ...sheetOptions({ x: COLON_COL, y: 3 }),
    pageSetup: { ...sheetOptions().pageSetup, paperSize: 9, orientation: 'portrait' },
  });
  /* Column B is the colon gutter, exactly as on the Summary sheet. */
  sheet.columns = [
    { width: 26 }, { width: 2 },
    ...Array.from({ length: span - COLON_COL }, () => ({ width: 38 })),
  ];

  writeCaption(sheet, span, project);
  const layout = writeBody(sheet, rows, span);

  sheet.pageSetup.printTitlesRow = '1:3';
  sheet.headerFooter = {
    oddFooter: `&L&"${FONT}"&8${project?.name ?? 'Procurement'} | ${vendor}`
      + `&R&"${FONT}"&8Page &P of &N`,
  };

  // No password: the lock guides rather than keeps anyone out, and a password
  // only earns a phone call. Sorting, filtering and inserting are all off —
  // the importer reads this sheet by position, and a shifted row or column is
  // how a date ends up recorded against the wrong item.
  void sheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: true,
    formatRows: false,
    insertRows: false,
    insertColumns: false,
    deleteRows: false,
    deleteColumns: false,
    sort: false,
    autoFilter: false,
  });

  buildMeta(wb, project, vendor, rows, revision, layout, scope);
  return wb;
}

/** Everything one vendor supplies on this project, one column per item. */
export function buildVendorWorkbook(
  project: Project | null,
  vendor: string,
  items: ProcurementItem[],
  revision: number,
): ExcelJS.Workbook {
  return buildForm(project, vendor, vendorItems(items, vendor), revision, 'vendor');
}

/**
 * One item, on its own sheet.
 *
 * Chasing a single piece of equipment is the common errand, and sending the
 * vendor their whole list to update one column invites edits nobody asked for.
 * The form is the same one, cut to a single column.
 */
export function buildItemWorkbook(
  project: Project | null,
  item: ProcurementItem,
  revision: number,
): ExcelJS.Workbook {
  return buildForm(project, item.vendor, [item], revision, 'item');
}

function safeName(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

export function vendorFileName(
  project: Project | null, vendor: string, revision: number,
): string {
  const rev = String(revision).padStart(2, '0');
  return `Progress Update ${safeName(vendor)} — ${safeName(project?.name ?? 'All Projects')} rev${rev}.xlsx`;
}

/** The item's own name leads: this file is about one piece of equipment. */
export function itemFormFileName(
  project: Project | null, item: ProcurementItem, revision: number,
): string {
  const rev = String(revision).padStart(2, '0');
  return `Progress Update ${safeName(item.desc)} — ${safeName(item.vendor || 'Vendor')} rev${rev}.xlsx`;
}

/** Build and download one vendor's workbook. */
export async function exportVendorWorkbook(
  project: Project | null,
  vendor: string,
  items: ProcurementItem[],
): Promise<string> {
  const revision = project?.revision ?? 1;
  return downloadWorkbook(
    buildVendorWorkbook(project, vendor, items, revision),
    vendorFileName(project, vendor, revision),
  );
}

/** Build and download the progress form for a single item. */
export async function exportItemForm(
  project: Project | null,
  item: ProcurementItem,
): Promise<string> {
  const revision = project?.revision ?? 1;
  return downloadWorkbook(
    buildItemWorkbook(project, item, revision),
    itemFormFileName(project, item, revision),
  );
}
