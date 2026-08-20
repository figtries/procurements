import type ExcelJS from 'exceljs';
import type { ItemStatus } from '@/types';
import { today } from './procurement';

/* ═══════════════════════════════════════════════════════════
   Shared look for every workbook this app writes.

   The styling follows the client's own Procurement Monitoring
   Dashboard: Calibri 10 in black, a grey header band split into
   colour-coded column groups, medium black rules around each
   block and thin ones inside, dd/mm/yy dates, and A3 landscape
   at 80% zoom. Colour marks a group or a status, nothing else.

   Kept here rather than in one exporter so the project workbook
   and the per-vendor sheets cannot drift apart — a vendor opening
   our template should feel the same file they already receive.
   ═══════════════════════════════════════════════════════════ */

/* Standard-palette colours, straight off Excel's own picker — the
   same ones the client's sheet uses. */
export const GREY   = 'FFD9D9D9'; // header base
export const CYAN   = 'FF00B0F0'; // vendor group
export const GREEN  = 'FF92D050'; // purchase order group
export const YELLOW = 'FFFFFF00'; // progress group
export const PEACH  = 'FFF8CBAD'; // milestone group
export const ORANGE = 'FFF4B183'; // section banner
export const CREAM  = 'FFFFF2CC'; // sub-band and soft highlight
export const BLACK  = 'FF000000';
export const WHITE  = 'FFFFFFFF';
export const BAND   = 'FFF2F2F2'; // totals strip

/** Fill marking a cell the vendor is meant to type into. */
export const INPUT  = 'FFFFF9D6'; // soft yellow — "isi di sini"
/**
 * Fill marking a cell we own: the vendor may still type in it — nothing in
 * the sheet is bolted down — but what they put there is read as a question
 * rather than an answer.
 */
export const LOCKED = 'FFF2F2F2';

export const FONT = 'Calibri';
export const SIZE = 10;

/** Status colours, in the same register the client codes cells with. */
export const STATUS_FILL: Record<ItemStatus, string | null> = {
  onsite:   'FFA9D08E',
  ontrack:  'FF9DC3E6',
  atrisk:   'FFFFE699',
  late:     'FFFF0000',
  planning: null,
};
export const STATUS_INK: Record<ItemStatus, string> = {
  onsite:   BLACK,
  ontrack:  BLACK,
  atrisk:   BLACK,
  late:     WHITE,
  planning: 'FF595959',
};

/** Indonesian short date, the format the client's columns are set to. */
export const DATE_FMT = '[$-13809]dd/mm/yy;@';
export const PCT_FMT = '0.00%';

export type Align = Partial<ExcelJS.Alignment>;

export const LEFT: Align   = { vertical: 'middle', horizontal: 'left',   wrapText: true };
export const CENTER: Align = { vertical: 'middle', horizontal: 'center', wrapText: true };
export const RIGHT: Align  = { vertical: 'middle', horizontal: 'right' };

export type Weight = 'thin' | 'medium';

export function body(opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: FONT, size: SIZE, color: { argb: BLACK }, ...opts };
}

/** Black rules, thin inside a block and medium around it. */
export function rule(
  top: Weight = 'thin', left: Weight = 'thin', bottom: Weight = 'thin', right: Weight = 'thin',
): Partial<ExcelJS.Borders> {
  const s = (style: Weight) => ({ style, color: { argb: BLACK } });
  return { top: s(top), left: s(left), bottom: s(bottom), right: s(right) };
}

export function fill(cell: ExcelJS.Cell, argb: string | null): void {
  if (!argb) return;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/** Real dates, so the client can sort and filter the column. */
export function toDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12);
}

export function shortDate(iso: string): string {
  const d = toDate(iso);
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

/** A3 landscape at 80%, the way these dashboards are set up for printing. */
export function sheetOptions(freeze?: { x?: number; y: number }): Partial<ExcelJS.AddWorksheetOptions> {
  return {
    properties: { defaultRowHeight: 13.8 },
    views: [{
      zoomScale: 80,
      ...(freeze ? { state: 'frozen' as const, xSplit: freeze.x ?? 0, ySplit: freeze.y } : {}),
    }],
    pageSetup: {
      // A3 (8) is missing from ExcelJS's PaperSize enum, so it goes in raw.
      paperSize: 8 as ExcelJS.PaperSize,
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  };
}

/* ─────────────── Shared sheet furniture ─────────────── */

/**
 * Header band: grey by default, or the group colour where one is given.
 * `edges` marks which sides of the band get the heavier rule.
 */
export function styleHead(
  row: ExcelJS.Row,
  span: number,
  height: number,
  colour: (col: number) => string,
  edges: { top?: Weight; bottom?: Weight; sides?: (col: number) => [Weight, Weight] } = {},
): void {
  // Every cell of a merged run must carry the same border, or the last one
  // written wins and the block loses its outer rule.
  const sides = edges.sides ?? ((c: number): [Weight, Weight] => [
    c === 1 ? 'medium' : 'thin',
    c === span ? 'medium' : 'thin',
  ]);
  row.height = height;
  for (let c = 1; c <= span; c++) {
    const cell = row.getCell(c);
    const [left, right] = sides(c);
    fill(cell, colour(c));
    cell.font = body({ bold: true });
    cell.alignment = CENTER;
    cell.border = rule(edges.top ?? 'medium', left, edges.bottom ?? 'medium', right);
  }
}

/** Outer rule for a column that belongs to a merged group spanning the row. */
export function groupSides(bounds: Array<[number, number]>, span: number) {
  return (col: number): [Weight, Weight] => {
    const group = bounds.find(([from, to]) => col >= from && col <= to);
    if (!group) return [col === 1 ? 'medium' : 'thin', col === span ? 'medium' : 'thin'];
    return [group[0] === 1 ? 'medium' : 'thin', group[1] === span ? 'medium' : 'thin'];
  };
}

/**
 * Caption block: title top-left, doc/rev stamp boxed on the right.
 * The table starts on row 4.
 */
export function writeStampedCaption(
  sheet: ExcelJS.Worksheet,
  span: number,
  title: string,
  subtitle: string,
  stamp: string[],
): void {
  const t = sheet.getCell(1, 1);
  t.value = title.toUpperCase();
  t.font = { name: FONT, size: 12, bold: true, color: { argb: BLACK } };
  t.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 18;

  const s = sheet.getCell(2, 1);
  s.value = subtitle;
  s.font = body();
  s.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 15;

  /* Stamp box, echoing the dated cell in the client's own header. */
  const from = Math.max(2, span - 2);
  stamp.forEach((text, i) => {
    const r = i + 1;
    if (span > 3) sheet.mergeCells(r, from, r, span);
    const c = sheet.getCell(r, span > 3 ? from : span);
    c.value = text;
    c.font = body({ bold: i === stamp.length - 1, size: 9 });
    c.alignment = RIGHT;
    fill(c, CREAM);
    c.border = rule(i === 0 ? 'thin' : 'thin', 'thin', 'thin', 'thin');
  });

  sheet.getRow(3).height = 6;
}

/** Repeat the header on every printed page and number the pages. */
export function printSetup(sheet: ExcelJS.Worksheet, headerRow: number, caption: string): void {
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  sheet.headerFooter = {
    oddFooter: `&L&"${FONT}"&8${caption}&R&"${FONT}"&8Page &P of &N`,
  };
}

/**
 * The caption every project sheet carries: title, project name, and a boxed
 * document-and-revision stamp on the right.
 */
export function writeCaption(
  sheet: ExcelJS.Worksheet,
  span: number,
  title: string,
  subtitle: string,
  docNo: string,
  revision: number,
): void {
  writeStampedCaption(sheet, span, title, subtitle, [
    `Doc. No.  ${docNo}`,
    `Rev. ${String(revision).padStart(2, '0')}    ${shortDate(today())}`,
  ]);
}
