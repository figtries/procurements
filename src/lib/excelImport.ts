import ExcelJS from 'exceljs';
import type { ImportResult, MilestoneEntry, ProcurementItem } from '@/types';
import { EXPORT_MARKER, PRIMARY_SHEET } from './excelExport';
import { DISCIPLINES } from './procurement';

/* ═══════════════════════════════════════════════════════════
   Reading the spreadsheets procurement teams actually keep.
   Column order, header wording and date formatting all drift
   between revisions, so every step here is tolerant and records
   a warning instead of throwing.
   ═══════════════════════════════════════════════════════════ */

type Field =
  | 'no' | 'desc' | 'vendor' | 'brand' | 'poNo' | 'poDate' | 'qty' | 'unit'
  | 'readinessDoc' | 'fatDate' | 'fatStatus' | 'termOfPayment'
  | 'mosPlan' | 'mosActual' | 'rtsPlan' | 'rtsActual'
  | 'doNo' | 'delivery' | 'statusNote';

/** Header keywords, longest-first so "PO DATE" wins over "PO". */
const HEADER_PATTERNS: Array<[Field, RegExp]> = [
  ['poDate',        /\bPO\s*(DATE|TGL|TANGGAL)\b/],
  ['poNo',          /\bPO\b.*\b(NO|NUMBER|NOMOR)\b|^PO\s*NO/],
  ['readinessDoc',  /READINESS|KELENGKAPAN\s*DOK|DOC.*READY/],
  ['fatStatus',     /FAT\s*STATUS|STATUS\s*FAT/],
  ['fatDate',       /FAT|INSPEK|INSPECT/],
  ['termOfPayment', /TERM.*PAYMENT|PAYMENT.*TERM|TERMIN/],
  ['mosPlan',       /PLAN\w*\s*DELIV|DELIVERY\s*TO\s*SITE|RENCANA\s*KIRIM|ETA\s*SITE/],
  ['mosActual',     /ACTUAL\s*(DELIV|ON\s*SITE)|MATERIAL\s*ON\s*SITE|TIBA\s*DI\s*SITE|\bMOS\b\s*ACTUAL/],
  ['rtsActual',     /ACTUAL\s*(RTS|READY)|\bRTS\b\s*ACTUAL/],
  ['rtsPlan',       /READY\s*TO\s*SHIP|\bRTS\b/],
  ['doNo',          /\bDO\b\s*(NO|NUMBER|NOMOR)?\.?$|DELIVERY\s*ORDER|SURAT\s*JALAN/],
  ['delivery',      /DELIVERY\s*TERM|INCOTERM|\bTERM\s*OF\s*DELIV/],
  ['statusNote',    /KETERANGAN|REMARK|CATATAN|NOTE|STATUS$/],
  ['desc',          /EQUIPMENT|MATERIAL|DESCRIPTION|DESKRIPSI|URAIAN|NAMA\s*BARANG/],
  ['vendor',        /VENDOR|SUPPLIER|PABRIKAN|PEMASOK/],
  ['brand',         /BRAND|MEREK|MERK|MANUFACTURER/],
  ['qty',           /\bQTY\b|QUANTITY|JUMLAH|VOLUME/],
  ['unit',          /\bUNIT\b|SATUAN|\bUOM\b/],
  ['no',            /^NO\.?$|^ITEM\s*NO|^#$/],
];

/** Sheet-name shorthands EPC teams use for disciplines. */
const SHEET_DISCIPLINE: Array<[RegExp, string]> = [
  [/^ELE|ELECTRIC|LISTRIK/i, 'Electrical'],
  [/^INS|INSTRUMENT/i,       'Instrument'],
  [/^MEC|MECH|MESIN/i,       'Mechanical'],
  [/^PIP|PIPING/i,           'Piping'],
  [/^CIV|CIVIL|SIPIL/i,      'Civil'],
  [/^STR|STRUCT/i,           'Structural'],
  [/^PRO|PROCESS/i,          'Process'],
  [/^HSE|SAFETY|K3/i,        'HSE'],
];

function normHeader(v: unknown): string {
  return String(cellText(v) ?? '')
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** ExcelJS cells can hold rich text, formula results or hyperlinks — flatten them all. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return v.richText.map(t => (t as { text?: string }).text ?? '').join('').trim();
    }
    if ('result' in v)    return cellText(v.result);
    if ('text' in v)      return cellText(v.text);
    if ('hyperlink' in v) return cellText(v.text ?? v.hyperlink);
  }
  return String(value).trim();
}

const MONTH_WORDS: Record<string, number> = {
  jan: 0, feb: 1, peb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5,
  jul: 6, aug: 7, agu: 7, agt: 7, sep: 8, oct: 9, okt: 9,
  nov: 10, dec: 11, des: 11,
};

function iso(y: number, m: number, d: number): string {
  if (m < 0 || m > 11 || d < 1 || d > 31) return '';
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

/**
 * Parse the many date shapes found in these sheets.
 * Ranges ("05-07 May 2026", "13-14-Apr-2026") resolve to their first day.
 * Anything unparseable comes back empty and the caller keeps the raw text.
 */
export function parseLooseDate(raw: unknown): string {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);

  const s = cellText(raw);
  if (!s) return '';

  // Excel serial number (days since 1899-12-30)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const ms = (Number(s) - 25569) * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const lower = s.toLowerCase();
  const monthKeys = Object.keys(MONTH_WORDS).join('|');

  // "05-07 May 2026" / "13-14-Apr-2026" / "29 - 30 May 2026" / "13-Apr-2026"
  const named = lower.match(
    new RegExp(`(\\d{1,2})\\s*(?:[-–—/]\\s*\\d{1,2}\\s*)?[-–—\\s]\\s*(${monthKeys})\\w*[-–—\\s,]*\\s*(\\d{2,4})`),
  );
  if (named) {
    const day = Number(named[1]);
    const mon = MONTH_WORDS[named[2]];
    let year = Number(named[3]);
    if (year < 100) year += 2000;
    const out = iso(year, mon, day);
    if (out) return out;
  }

  // "12/05/2026" or "12-05-2026" — day first, as used across Indonesian sheets
  const numeric = lower.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (numeric) {
    let day = Number(numeric[1]);
    let mon = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    // Swap only when the first number cannot be a day-of-month.
    if (mon > 12 && day <= 12) { const t = day; day = mon; mon = t; }
    const out = iso(year, mon - 1, day);
    if (out) return out;
  }

  return '';
}

/** Readiness arrives as 0–1, as a percentage, or as "N/A". */
function parseReadiness(raw: unknown): number {
  const s = cellText(raw);
  if (!s || /^(N\/?A|TBA|-)$/i.test(s)) return 0;
  const n = Number(s.replace(/[%\s]/g, '').replace(',', '.'));
  if (isNaN(n)) return 0;
  if (n > 1) return Math.min(1, n / 100);
  return Math.max(0, Math.min(1, n));
}

/** Does the FAT status column say the inspection actually happened? */
function fatIsDone(statusText: string): boolean {
  const s = statusText.toUpperCase();
  if (/\b(ESTIMAT|ESTIMASI|TBA|TBD|ON\s*PROGRESS|BELUM|WAITING|MENUNGGU\s*FAT)\b/.test(s)) return false;
  return /\b(DONE|SELESAI|COMPLETE|COMPLETED|FINISH|CLOSED|OK)\b/.test(s);
}

/**
 * Reduce a FAT status cell to the part worth keeping as a note.
 * The verdict itself ("FAT - Done", "Estimated") is already captured by which
 * milestone field the date landed in, so storing it again would duplicate it
 * on the next export. Qualifiers — defect details, "Ready at Narogong" — stay.
 */
function distillFatNote(statusText: string): string {
  let s = statusText.trim();
  if (!s) return '';

  // Drop a leading verdict, with or without the "FAT" prefix.
  s = s.replace(
    /^(?:FAT\s*)?[-–—]?\s*(?:DONE|SELESAI|COMPLETED?|CLOSED|FINISHED?|OK)\b/i, '',
  );
  s = s.replace(
    /^(?:ESTIMASI\s*FAT|ESTIMATED?|TBA|TBD|ON\s*PROGRESS)\b/i, '',
  );
  // Tidy up separators left behind by the removal.
  s = s.replace(/^[\s,.:;·—–-]+/, '').trim();

  // A bare "FAT" left on its own carries nothing.
  if (/^FAT$/i.test(s)) return '';
  return s;
}

/** Strip a leading "A." / "B)" / "1." label from a section banner. */
function stripSectionMarker(text: string): string {
  return text.replace(/^\s*(?:[A-Z]|[IVX]+|\d+)\s*[.)\-–]\s+/i, '').trim();
}

/**
 * Rows shaped like ("A", "ELECTRICAL", …) split the sheet into disciplines.
 * Our own exports write that banner as a single merged cell, in which case
 * every column of the row reports the same text.
 */
function readSectionHeader(noText: string, descText: string, vendorText: string): string | null {
  if (!descText) return null;

  /** "A", "1", "1.", "1.1" — the WBS label a banner row carries. */
  const marker = /^(?:[A-Z]|[IVX]+|\d+(?:\.\d+)*)\.?$/.test(noText.trim());
  const merged = descText === vendorText && descText === noText;
  // Banners are often merged across the data columns only, leaving the WBS
  // number in its own cell — that is how this app writes them.
  const mergedBody = !!vendorText && descText === vendorText;

  if (!merged && !(mergedBody && (!noText.trim() || marker))) {
    if (vendorText) return null;
    if (noText.trim() && !marker) return null;
  }

  return matchDiscipline(stripSectionMarker(descText));
}

/** Totals strips carry no item data and must not be imported as equipment. */
function isSummaryRow(descText: string, vendorText: string, poNo: string): boolean {
  if (vendorText || poNo) return false;
  return /^(TOTAL|JUMLAH|GRAND\s*TOTAL|SUBTOTAL)\b/i.test(descText.trim());
}

/** Map free text onto one of the app's fixed disciplines. */
function matchDiscipline(text: string): string | null {
  const s = text.trim().toUpperCase();
  if (!s) return null;
  for (const d of DISCIPLINES) {
    if (s === d.toUpperCase()) return d;
  }
  for (const [re, disc] of SHEET_DISCIPLINE) {
    if (re.test(s)) return disc;
  }
  return null;
}

function emptyMilestone(): MilestoneEntry {
  return { plan: '', forecast: '', actual: '', note: '' };
}

interface HeaderMap {
  /** 1-based column index per field. */
  cols: Partial<Record<Field, number>>;
  headerRow: number;
}

/** Find the header row and work out which column holds which field. */
function detectHeaders(sheet: ExcelJS.Worksheet): HeaderMap | null {
  const limit = Math.min(sheet.rowCount, 15);
  let best: HeaderMap | null = null;

  for (let r = 1; r <= limit; r++) {
    const row = sheet.getRow(r);
    const cols: Partial<Record<Field, number>> = {};
    const taken = new Set<Field>();

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = normHeader(cell.value);
      if (!text) return;
      for (const [field, re] of HEADER_PATTERNS) {
        if (taken.has(field)) continue;
        if (re.test(text)) { cols[field] = colNumber; taken.add(field); return; }
      }
    });

    // A real header row names the equipment and at least one more known field.
    const score = Object.keys(cols).length;
    if (cols.desc && score >= 3 && (!best || score > Object.keys(best.cols).length)) {
      best = { cols, headerRow: r };
    }
  }

  if (!best) return null;

  // "FAT/INSPEKSI" is usually merged across two columns: date, then status.
  if (best.cols.fatDate && !best.cols.fatStatus) {
    const next = best.cols.fatDate + 1;
    const claimed = Object.values(best.cols).includes(next);
    if (!claimed && next <= sheet.columnCount) best.cols.fatStatus = next;
  }
  return best;
}

function parseSheet(sheet: ExcelJS.Worksheet, result: ImportResult): void {
  const map = detectHeaders(sheet);
  if (!map) {
    result.errors.push(`Sheet "${sheet.name}": no header row found — skipped.`);
    return;
  }
  result.sheetsRead.push(sheet.name);

  const fallbackDiscipline =
    SHEET_DISCIPLINE.find(([re]) => re.test(sheet.name))?.[1] ?? '';
  let currentDiscipline = fallbackDiscipline;

  const get = (row: ExcelJS.Row, field: Field): string => {
    const col = map.cols[field];
    return col ? cellText(row.getCell(col).value) : '';
  };
  const getRaw = (row: ExcelJS.Row, field: Field): unknown => {
    const col = map.cols[field];
    return col ? row.getCell(col).value : null;
  };

  for (let r = map.headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);

    const noText     = get(row, 'no');
    const descText   = get(row, 'desc');
    const vendorText = get(row, 'vendor');

    const section = readSectionHeader(noText, descText, vendorText);
    if (section) { currentDiscipline = section; continue; }

    if (!descText) continue;
    if (isSummaryRow(descText, vendorText, get(row, 'poNo'))) continue;

    const warnings: string[] = [];

    /* ── FAT ── */
    const fatRaw    = getRaw(row, 'fatDate');
    const fatText   = get(row, 'fatDate');
    const fatStatus = get(row, 'fatStatus');
    const fatDate   = parseLooseDate(fatRaw);
    const fat = emptyMilestone();

    if (fatDate) {
      if (fatIsDone(fatStatus)) fat.actual = fatDate;
      else fat.plan = fatDate;
    } else if (fatText) {
      warnings.push(`FAT date "${fatText}" could not be parsed — kept as a note.`);
    }
    // Keep the original wording: "Online", "Ready at Narogong" and defect notes matter.
    fat.note = [distillFatNote(fatStatus), fatDate ? '' : fatText].filter(Boolean).join(' · ');

    /* ── RTS ── */
    const rts = emptyMilestone();
    const rtsPlan   = parseLooseDate(getRaw(row, 'rtsPlan'));
    const rtsActual = parseLooseDate(getRaw(row, 'rtsActual'));
    if (rtsPlan)   rts.plan = rtsPlan;
    if (rtsActual) rts.actual = rtsActual;

    /* ── MOS ── */
    const mos = emptyMilestone();
    const mosPlanText = get(row, 'mosPlan');
    const mosPlan     = parseLooseDate(getRaw(row, 'mosPlan'));
    const mosActual   = parseLooseDate(getRaw(row, 'mosActual'));
    if (mosPlan)   mos.plan = mosPlan;
    if (mosActual) mos.actual = mosActual;
    if (mosPlanText && !mosPlan) mos.note = mosPlanText;

    const statusNote = get(row, 'statusNote');
    const doNo       = get(row, 'doNo');

    // A DO number means the goods shipped; without an actual date, use the sheet's own signal.
    if (doNo && !mos.actual && /SUDAH|SDH|LENGKAP|ON\s*SITE|DITERIMA|RECEIVED/i.test(statusNote)) {
      mos.actual = mosPlan || '';
      if (!mos.actual) warnings.push('Remarks say the material is on site, but no date was given.');
    }

    const qtyText = get(row, 'qty');
    const qty = Number(qtyText.replace(',', '.'));

    if (!currentDiscipline) warnings.push('Discipline not detected — pick one before importing.');

    result.rows.push({
      include: true,
      desc: descText,
      discipline: currentDiscipline,
      qty: isNaN(qty) || qty <= 0 ? 1 : qty,
      unit: get(row, 'unit'),
      vendor: vendorText,
      brand: get(row, 'brand'),
      poNo: get(row, 'poNo'),
      poDate: parseLooseDate(getRaw(row, 'poDate')),
      readinessDoc: parseReadiness(getRaw(row, 'readinessDoc')),
      doNo,
      termOfPayment: get(row, 'termOfPayment'),
      delivery: get(row, 'delivery'),
      statusNote,
      fat, rts, mos,
      sourceSheet: sheet.name,
      sourceRow: r,
      warnings,
    });
  }
}

/** Normalised key for spotting the same equipment listed twice. */
function dupKey(row: { poNo: string; desc: string }): string {
  const po = row.poNo.replace(/[\s-]/g, '').toUpperCase();
  const desc = row.desc.replace(/[\s\-/&.]/g, '').toUpperCase();
  return po ? `PO:${po}|${desc}` : `D:${desc}`;
}

/**
 * Read an .xlsx file into rows ready for review.
 * Existing items are matched by PO + description so a re-import updates
 * them instead of creating duplicates.
 */
export async function importWorkbook(
  file: File,
  existingItems: ProcurementItem[],
): Promise<ImportResult> {
  const result: ImportResult = { rows: [], sheetsRead: [], errors: [] };

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    result.errors.push('Could not read the file. Make sure it is .xlsx, not .xls or .csv.');
    return result;
  }

  // Our own exports repeat the same equipment across several sheets, so read
  // only the authoritative one. Third-party files are scanned in full.
  const isOwnExport = workbook.category === EXPORT_MARKER;

  workbook.eachSheet(sheet => {
    if (sheet.state === 'hidden' || sheet.state === 'veryHidden') return;
    if (sheet.rowCount < 2) return;
    // Case-insensitive: older revisions of this app wrote the sheet as "MONITORING".
    if (isOwnExport && sheet.name.toUpperCase() !== PRIMARY_SHEET.toUpperCase()) return;
    try {
      parseSheet(sheet, result);
    } catch (err) {
      result.errors.push(`Sheet "${sheet.name}" failed to parse: ${(err as Error).message}`);
    }
  });

  if (!result.rows.length && !result.errors.length) {
    result.errors.push('No item rows were recognised in this file.');
  }

  /* Flag duplicates within the file — later revisions of a sheet usually win. */
  const seen = new Map<string, number>();
  result.rows.forEach((row, idx) => {
    const key = dupKey(row);
    if (seen.has(key)) {
      row.duplicateOf = seen.get(key);
      row.include = false;
      row.warnings.push(`Duplicate of ${result.rows[seen.get(key)!].sourceSheet} row ${result.rows[seen.get(key)!].sourceRow}.`);
    } else {
      seen.set(key, idx);
    }
  });

  /* Match against what is already in the project. */
  const existingByKey = new Map(existingItems.map(i => [dupKey(i), i.id]));
  for (const row of result.rows) {
    const id = existingByKey.get(dupKey(row));
    if (id) row.matchesItemId = id;
  }

  return result;
}
