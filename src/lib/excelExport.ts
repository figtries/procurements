import ExcelJS from 'exceljs';
import type { Anomaly, ItemStatus, MilestoneEntry, ProcurementItem, Project } from '@/types';
import {
  STATUS_LABELS, computeDeviation, computeOverallProgress, detectAnomalies,
  disciplineBreakdown, milestoneStats, today, vendorStats,
} from './procurement';
import {
  Align, BAND, BLACK, CENTER, CREAM, CYAN, DATE_FMT, GREEN, GREY, LEFT, ORANGE,
  PCT_FMT, PEACH, STATUS_FILL, STATUS_INK, YELLOW,
  body, fill, groupSides, printSetup, rule, sheetOptions, shortDate, styleHead, toDate,
  writeCaption,
} from './excelTheme';

/* ═══════════════════════════════════════════════════════════
   Export the whole project as a workbook the client can send on
   without reformatting: a summary, the monitoring table in the
   layout their own sheets use, milestone detail, vendors, and
   the findings the app detected.

   Palette, rules, date formats and page setup come from
   `excelTheme` — that file records what the styling follows.
   ═══════════════════════════════════════════════════════════ */

/** Short document number, e.g. PRC-MON/PGB/03. */
function docNumber(project: Project | null, revision: number): string {
  const initials = (project?.name ?? 'GEN')
    .replace(/[^A-Za-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3) || 'GEN';
  return `PRC-MON/${initials}/${String(revision).padStart(2, '0')}`;
}

/* ─────────────── Sheet 1 · Summary ─────────────── */

function buildSummary(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  anomalies: Anomaly[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('Summary', {
    ...sheetOptions(),
    pageSetup: { ...sheetOptions().pageSetup, paperSize: 9, orientation: 'portrait' },
  });
  /* Column B is the colon gutter; labels sit in A:B, values from C on. */
  sheet.columns = [
    { width: 24 }, { width: 2 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 16 },
  ];
  const span = 7;

  writeCaption(
    sheet, span,
    'Procurement Monitoring Summary',
    project?.name ?? 'All projects',
    docNumber(project, revision), revision,
  );

  let r = 4;

  const kv = (label: string, value: string | number, bold = false) => {
    const l = sheet.getCell(r, 1);
    l.value = label;
    l.font = body();
    const colon = sheet.getCell(r, 2);
    colon.value = ':';
    colon.font = body();
    sheet.mergeCells(r, 3, r, span);
    const v = sheet.getCell(r, 3);
    v.value = value;
    v.font = body({ bold });
    v.alignment = { vertical: 'middle', horizontal: 'left' };
    r++;
    return v;
  };

  /* Cream sub-band, the way the client marks a section inside a table. */
  const heading = (text: string) => {
    r++;
    sheet.mergeCells(r, 1, r, span);
    const c = sheet.getCell(r, 1);
    c.value = text.toUpperCase();
    c.font = body({ bold: true });
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    fill(c, CREAM);
    for (let col = 1; col <= span; col++) {
      sheet.getCell(r, col).border = rule('medium', col === 1 ? 'medium' : 'thin', 'medium', col === span ? 'medium' : 'thin');
    }
    sheet.getRow(r).height = 18;
    r++;
  };

  heading('Project');
  kv('Project name', project?.name || '', true);
  kv('Client', project?.client || '');
  kv('Location', project?.location || '');
  kv('PIC', project?.pic || '');
  kv('Contract no.', project?.contractNo || '');
  kv('Handover target', project?.handover ? shortDate(project.handover) : '');

  const dev = computeDeviation(items, project);

  heading('Progress against plan');
  kv('Plan', dev.planPct / 100).numFmt = PCT_FMT;
  kv('Actual', dev.actualPct / 100, true).numFmt = PCT_FMT;
  kv('Deviation', dev.deviation / 100, true).numFmt = '+0.00%;-0.00%;0.00%';
  if (dev.slipDays > 0) kv('Behind by', `${dev.slipDays} days`);

  /** Sheet column for the n-th table column: the label spans the colon gutter. */
  const at = (i: number) => (i === 0 ? 1 : i + 2);

  const table = (
    headers: string[],
    rows: Array<Array<string | number>>,
    decorate?: (row: ExcelJS.Row, index: number) => void,
  ) => {
    const last = at(headers.length - 1);
    sheet.mergeCells(r, 1, r, 2);
    const headRow = sheet.getRow(r);
    headers.forEach((h, i) => { headRow.getCell(at(i)).value = h; });
    styleHead(headRow, last, 20, () => GREY);
    r++;
    rows.forEach((cells, idx) => {
      const row = sheet.getRow(r);
      sheet.mergeCells(r, 1, r, 2);
      cells.forEach((v, i) => {
        const c = row.getCell(at(i));
        if (v !== '') c.value = v;
        c.alignment = i === 0 ? LEFT : CENTER;
        c.font = body();
        const col = at(i);
        c.border = rule(
          'thin',
          col === 1 ? 'medium' : 'thin',
          idx === rows.length - 1 ? 'medium' : 'thin',
          col === last ? 'medium' : 'thin',
        );
      });
      // The merged label still needs its right-hand half ruled.
      row.getCell(2).border = row.getCell(1).border;
      decorate?.(row, idx);
      r++;
    });
  };

  heading('Items by status');
  const statuses = Object.keys(STATUS_LABELS) as ItemStatus[];
  const statusRows: Array<Array<string | number>> = statuses.map(s => {
    const n = items.filter(i => i.status === s).length;
    return [STATUS_LABELS[s], n, items.length ? n / items.length : 0];
  });
  statusRows.push(['TOTAL', items.length, items.length ? 1 : 0]);
  table(['Status', 'Items', 'Share'], statusRows, (row, idx) => {
    row.getCell(at(2)).numFmt = PCT_FMT;
    if (idx === statusRows.length - 1) {
      for (let c = 1; c <= at(2); c++) {
        row.getCell(c).font = body({ bold: true });
        fill(row.getCell(c), BAND);
      }
      return;
    }
    const s = statuses[idx];
    const label = row.getCell(1);
    fill(label, STATUS_FILL[s]);
    label.font = body({ bold: true, color: { argb: STATUS_INK[s] } });
  });

  heading('Milestones');
  const ms = milestoneStats(items);
  table(
    ['Milestone', 'Done', 'Scheduled', 'Overdue', 'Not scheduled'],
    ms.map(m => [`${m.label} - ${m.name}`, m.done, m.scheduled, m.overdue, m.unplanned]),
    (row, idx) => {
      row.getCell(1).font = body({ bold: true });
      if (ms[idx].overdue > 0) {
        const c = row.getCell(at(3));
        fill(c, STATUS_FILL.late);
        c.font = body({ bold: true, color: { argb: STATUS_INK.late } });
      }
    },
  );

  heading('By discipline');
  table(
    ['Discipline', 'Items', 'On Site', 'On Track', 'At Risk', 'Late'],
    disciplineBreakdown(items).map(d => [
      d.discipline, d.total, d.counts.onsite, d.counts.ontrack, d.counts.atrisk, d.counts.late,
    ]),
    row => {
      row.getCell(1).font = body({ bold: true });
      const late = row.getCell(at(5));
      if (Number(late.value) > 0) late.font = body({ bold: true });
    },
  );

  if (anomalies.length) {
    r++;
    sheet.mergeCells(r, 1, r, span);
    const crit = anomalies.filter(a => a.severity === 'crit').length;
    const note = sheet.getCell(r, 1);
    note.value = crit
      ? `${anomalies.length} findings open, ${crit} of them critical. Detail on the Findings sheet.`
      : `${anomalies.length} findings open. Detail on the Findings sheet.`;
    note.font = body();
    r += 1;
  }

  /* Sign-off strip, left blank for wet signatures. */
  r += 2;
  const roles = ['Prepared by', 'Checked by', 'Approved by'];
  const cols = [1, 3, 5];
  roles.forEach((role, i) => {
    const c = sheet.getCell(r, cols[i]);
    c.value = role;
    c.font = body();
  });
  const signRow = r + 4;
  roles.forEach((_, i) => {
    const c = sheet.getCell(signRow, cols[i]);
    if (i === 0 && project?.pic) c.value = project.pic;
    c.font = body({ bold: true });
    c.border = { top: { style: 'thin', color: { argb: BLACK } } };
    sheet.getCell(signRow, cols[i] + 1).border = { top: { style: 'thin', color: { argb: BLACK } } };
  });

  printSetup(sheet, 1, `${project?.name ?? 'Procurement'} | summary`);
}

/* ─────────────── Sheet 2 · Monitoring ─────────────── */

interface Column {
  header: string;
  width: number;
  align: Align;
  /** Returned strings land as text; dates and numbers keep their type. */
  value: (item: ProcurementItem) => string | number | Date | null;
  numFmt?: string;
}

/** Column groups, in the client's own order and colours. */
interface Group {
  label: string;
  colour: string;
  columns: Column[];
}

const GROUPS: Group[] = [
  {
    label: 'Material / Equipment', colour: GREY, columns: [
      { header: 'No', width: 6.5, align: CENTER, value: () => null },
      { header: 'Equipment / Material', width: 30, align: LEFT, value: i => i.desc },
      { header: 'Qty', width: 6.5, align: CENTER, value: i => i.qty },
      { header: 'Unit', width: 7.5, align: CENTER, value: i => i.unit },
    ],
  },
  {
    label: 'Vendor', colour: CYAN, columns: [
      { header: 'Supplier / Vendor Name', width: 22, align: LEFT, value: i => i.vendor },
      { header: 'Brand', width: 14, align: LEFT, value: i => i.brand },
    ],
  },
  {
    label: 'Purchase Order', colour: GREEN, columns: [
      { header: 'PO No.', width: 15, align: CENTER, value: i => i.poNo },
      { header: 'PO Date', width: 11.5, align: CENTER, value: i => toDate(i.poDate), numFmt: DATE_FMT },
      { header: 'DO No.', width: 18, align: LEFT, value: i => i.doNo },
      { header: 'Term of Payment', width: 24, align: LEFT, value: i => i.termOfPayment },
      { header: 'Doc. Readiness', width: 11.5, align: CENTER, value: i => i.readinessDoc, numFmt: PCT_FMT },
    ],
  },
  {
    label: 'Milestone', colour: PEACH, columns: [
      { header: 'FAT / Inspeksi', width: 11.5, align: CENTER, value: i => toDate(i.fat.actual || i.fat.forecast || i.fat.plan), numFmt: DATE_FMT },
      { header: 'FAT Status', width: 20, align: LEFT, value: i => fatStatusText(i) },
      { header: 'Ready to Ship', width: 11.5, align: CENTER, value: i => toDate(i.rts.forecast || i.rts.plan), numFmt: DATE_FMT },
      { header: 'Actual RTS', width: 11.5, align: CENTER, value: i => toDate(i.rts.actual), numFmt: DATE_FMT },
      { header: 'Plan Delivery to Site', width: 13, align: CENTER, value: i => toDate(i.mos.forecast || i.mos.plan), numFmt: DATE_FMT },
      { header: 'Actual on Site', width: 11.5, align: CENTER, value: i => toDate(i.mos.actual), numFmt: DATE_FMT },
    ],
  },
  {
    label: 'Progress Status', colour: YELLOW, columns: [
      { header: '% Progress', width: 11.5, align: CENTER, value: i => i.progress / 100, numFmt: PCT_FMT },
      { header: 'Status', width: 11, align: CENTER, value: i => STATUS_LABELS[i.status] },
      { header: 'Keterangan', width: 32, align: LEFT, value: i => i.statusNote },
    ],
  },
];

const MONITORING_COLUMNS: Column[] = GROUPS.flatMap(g => g.columns);
const SPAN = MONITORING_COLUMNS.length;
const STATUS_COL = MONITORING_COLUMNS.findIndex(c => c.header === 'Status') + 1;
const PROGRESS_COL = MONITORING_COLUMNS.findIndex(c => c.header === '% Progress') + 1;

/** Colour of the group a column belongs to. */
const COLUMN_COLOUR: string[] = GROUPS.flatMap(g => g.columns.map(() => g.colour));

/** The wording the client's own sheets use in the FAT status column. */
function fatStatusText(item: ProcurementItem): string {
  if (item.fat.actual) return item.fat.note ? `FAT - Done. ${item.fat.note}` : 'FAT - Done';
  const due = item.fat.forecast || item.fat.plan;
  if (!due) return item.fat.note || 'TBA';
  const base = due < today() ? 'Estimated - overdue' : 'Estimated';
  return item.fat.note ? `${base}. ${item.fat.note}` : base;
}

function buildMonitoring(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('Monitoring', sheetOptions({ x: 2, y: 5 }));
  sheet.columns = MONITORING_COLUMNS.map(c => ({ width: c.width }));

  writeCaption(
    sheet, SPAN,
    'Procurement Monitoring Dashboard',
    [project?.name, project?.client].filter(Boolean).join(' - ') || 'All projects',
    docNumber(project, revision), revision,
  );

  /* Two-tier header: group band over the column names. */
  const bandRow = sheet.getRow(4);
  const bounds: Array<[number, number]> = [];
  let col = 1;
  for (const group of GROUPS) {
    const to = col + group.columns.length - 1;
    if (to > col) sheet.mergeCells(4, col, 4, to);
    bandRow.getCell(col).value = group.label.toUpperCase();
    bounds.push([col, to]);
    col = to + 1;
  }
  styleHead(bandRow, SPAN, 20, c => COLUMN_COLOUR[c - 1], {
    top: 'medium', bottom: 'thin', sides: groupSides(bounds, SPAN),
  });

  const headRow = sheet.getRow(5);
  MONITORING_COLUMNS.forEach((c, i) => { headRow.getCell(i + 1).value = c.header; });
  // Tall enough for the longest header to wrap onto two lines.
  styleHead(headRow, SPAN, 34, c => COLUMN_COLOUR[c - 1], { top: 'thin', bottom: 'medium' });

  let r = 6;
  const groups = disciplineBreakdown(items);

  groups.forEach((group, gi) => {
    /* Discipline banner, numbered the way the client's WBS column runs. */
    sheet.mergeCells(r, 2, r, SPAN);
    sheet.getCell(r, 1).value = gi + 1;
    const banner = sheet.getCell(r, 2);
    banner.value = group.discipline.toUpperCase();
    for (let c = 1; c <= SPAN; c++) {
      const cell = sheet.getCell(r, c);
      fill(cell, ORANGE);
      cell.font = body({ bold: true });
      cell.alignment = c === 1 ? CENTER : { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = rule('thin', c === 1 ? 'medium' : 'thin', 'thin', c === SPAN ? 'medium' : 'thin');
    }
    sheet.getRow(r).height = 18;
    r++;

    const groupItems = items
      .filter(i => (i.discipline || 'Uncategorised') === group.discipline)
      .sort((a, b) => a.desc.localeCompare(b.desc));

    groupItems.forEach((item, idx) => {
      const row = sheet.getRow(r);
      MONITORING_COLUMNS.forEach((cfg, ci) => {
        const cell = row.getCell(ci + 1);
        const value = ci === 0 ? `${gi + 1}.${idx + 1}` : cfg.value(item);
        // Leave blanks blank; a placeholder glyph only gets in the way of filters.
        if (value !== null && value !== '') cell.value = value;
        cell.alignment = cfg.align;
        cell.font = body();
        cell.border = rule('thin', ci === 0 ? 'medium' : 'thin', 'thin', ci === SPAN - 1 ? 'medium' : 'thin');
        if (cfg.numFmt) cell.numFmt = cfg.numFmt;
      });

      const statusCell = row.getCell(STATUS_COL);
      fill(statusCell, STATUS_FILL[item.status]);
      statusCell.font = body({ bold: true, color: { argb: STATUS_INK[item.status] } });

      r++;
    });

    if (!groupItems.length) {
      sheet.mergeCells(r, 1, r, SPAN);
      const empty = sheet.getCell(r, 1);
      empty.value = 'No items recorded.';
      empty.font = body({ italic: true });
      empty.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
      for (let c = 1; c <= SPAN; c++) {
        sheet.getCell(r, c).border = rule('thin', c === 1 ? 'medium' : 'thin', 'thin', c === SPAN ? 'medium' : 'thin');
      }
      r++;
    }
  });

  /* Totals strip. */
  const totalRow = sheet.getRow(r);
  totalRow.getCell(2).value = `TOTAL ${items.length} ITEMS`;
  totalRow.getCell(PROGRESS_COL).value = computeOverallProgress(items) / 100;
  totalRow.getCell(PROGRESS_COL).numFmt = PCT_FMT;
  for (let c = 1; c <= SPAN; c++) {
    const cell = totalRow.getCell(c);
    fill(cell, BAND);
    cell.font = body({ bold: true });
    cell.alignment = c === 2 ? LEFT : CENTER;
    cell.border = rule('medium', c === 1 ? 'medium' : 'thin', 'medium', c === SPAN ? 'medium' : 'thin');
  }
  totalRow.height = 18;

  printSetup(sheet, 5, `${project?.name ?? 'Procurement'} | monitoring`);
}

/* ─────────────── Sheet 3 · Milestone ─────────────── */

function buildMilestones(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('Milestone', sheetOptions({ x: 1, y: 5 }));

  const widths = [30, 22, 9.7, 9.7, 9.7, 9.7, 9.7, 9.7, 9.7, 9.7, 9.7, 9.2, 26];
  sheet.columns = widths.map(w => ({ width: w }));
  const span = widths.length;

  /* Grey for the identity and tail columns, peach over the milestone trios. */
  const colour = (c: number) => (c >= 3 && c <= 11 ? PEACH : GREY);

  writeCaption(
    sheet, span,
    'Milestone Schedule',
    'FAT, RTS and MOS - plan, forecast and actual',
    docNumber(project, revision), revision,
  );

  const bandRow = sheet.getRow(4);
  sheet.mergeCells(4, 1, 5, 1);   bandRow.getCell(1).value = 'Equipment / Material';
  sheet.mergeCells(4, 2, 5, 2);   bandRow.getCell(2).value = 'Vendor';
  sheet.mergeCells(4, 3, 4, 5);   bandRow.getCell(3).value = 'FAT - Factory Acceptance Test';
  sheet.mergeCells(4, 6, 4, 8);   bandRow.getCell(6).value = 'RTS - Ready to Ship';
  sheet.mergeCells(4, 9, 4, 11);  bandRow.getCell(9).value = 'MOS - Material on Site';
  sheet.mergeCells(4, 12, 5, 12); bandRow.getCell(12).value = '% Progress';
  sheet.mergeCells(4, 13, 5, 13); bandRow.getCell(13).value = 'Notes';
  const bounds: Array<[number, number]> = [[1, 1], [2, 2], [3, 5], [6, 8], [9, 11], [12, 12], [13, 13]];
  styleHead(bandRow, span, 22, colour, { top: 'medium', bottom: 'thin', sides: groupSides(bounds, span) });

  const headRow = sheet.getRow(5);
  ['', '', 'Plan', 'Forecast', 'Actual', 'Plan', 'Forecast', 'Actual', 'Plan', 'Forecast', 'Actual', '', '']
    .forEach((v, i) => { if (v) headRow.getCell(i + 1).value = v; });
  styleHead(headRow, span, 18, colour, { top: 'thin', bottom: 'medium' });

  /* The four cells merged down both tiers own the full-height rule. */
  for (const c of [1, 2, 12, 13]) {
    sheet.getCell(4, c).border = rule('medium', c === 1 ? 'medium' : 'thin', 'medium', c === span ? 'medium' : 'thin');
  }

  let r = 6;
  const todayStr = today();
  const sorted = [...items].sort(
    (a, b) => a.discipline.localeCompare(b.discipline) || a.desc.localeCompare(b.desc),
  );

  for (const item of sorted) {
    const row = sheet.getRow(r);
    row.getCell(1).value = item.desc;
    row.getCell(2).value = item.vendor;

    const trio = (entry: MilestoneEntry, startCol: number) => {
      const dates: Array<[number, string]> = [
        [startCol,     entry.plan],
        [startCol + 1, entry.forecast],
        [startCol + 2, entry.actual],
      ];
      for (const [c, iso] of dates) {
        const cell = row.getCell(c);
        const d = toDate(iso);
        if (d) { cell.value = d; cell.numFmt = DATE_FMT; }
        cell.alignment = CENTER;
      }
      // Green once it is done; red when the due date passed with nothing recorded.
      const actualCell = row.getCell(startCol + 2);
      if (entry.actual) {
        fill(actualCell, STATUS_FILL.onsite);
        actualCell.font = body({ bold: true });
      } else {
        const due = entry.forecast || entry.plan;
        if (due && due < todayStr) {
          fill(actualCell, STATUS_FILL.late);
          actualCell.font = body({ bold: true, color: { argb: STATUS_INK.late } });
        }
      }
      // A forecast that moved past the plan is worth flagging on its own.
      if (!entry.actual && entry.plan && entry.forecast && entry.forecast > entry.plan) {
        const fc = row.getCell(startCol + 1);
        fill(fc, STATUS_FILL.atrisk);
        fc.font = body({ bold: true });
      }
    };

    trio(item.fat, 3);
    trio(item.rts, 6);
    trio(item.mos, 9);

    const prog = row.getCell(12);
    prog.value = item.progress / 100;
    prog.numFmt = PCT_FMT;
    prog.alignment = CENTER;

    const notes = [item.fat.note, item.rts.note, item.mos.note].filter(Boolean).join('; ');
    if (notes) row.getCell(13).value = notes;

    for (let c = 1; c <= span; c++) {
      const cell = row.getCell(c);
      cell.border = rule('thin', c === 1 ? 'medium' : 'thin', 'thin', c === span ? 'medium' : 'thin');
      if (!cell.font?.bold) cell.font = body();
      if (!cell.alignment) cell.alignment = LEFT;
    }
    row.getCell(1).alignment = LEFT;
    row.getCell(2).alignment = LEFT;
    row.getCell(13).alignment = LEFT;
    r++;
  }

  /* Close the table off with a medium rule. */
  for (let c = 1; c <= span; c++) {
    const cell = sheet.getCell(r - 1, c);
    cell.border = { ...cell.border, bottom: { style: 'medium', color: { argb: BLACK } } };
  }

  printSetup(sheet, 5, `${project?.name ?? 'Procurement'} | milestone`);
}

/* ─────────────── Sheet 4 · Vendor ─────────────── */

function buildVendors(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('Vendor', sheetOptions({ y: 4 }));
  const widths = [28, 7, 13, 13, 12, 44];
  sheet.columns = widths.map(w => ({ width: w }));
  const span = widths.length;

  writeCaption(
    sheet, span,
    'Vendor Recap',
    'Sorted by impact on the schedule, worst first',
    docNumber(project, revision), revision,
  );

  const head = sheet.getRow(4);
  ['Supplier / Vendor Name', 'Items', 'Avg. Readiness', 'Avg. Slip (days)', 'Worst Status', 'Items Held']
    .forEach((h, i) => { head.getCell(i + 1).value = h; });
  styleHead(head, span, 26, c => (c <= 2 ? GREY : c === 5 ? YELLOW : CYAN));

  let r = 5;
  const stats = vendorStats(items);
  for (const v of stats) {
    const row = sheet.getRow(r);
    row.getCell(1).value = v.vendor;
    row.getCell(2).value = v.items;
    row.getCell(3).value = v.avgReadiness;
    row.getCell(3).numFmt = PCT_FMT;
    row.getCell(4).value = v.avgSlipDays;
    row.getCell(5).value = STATUS_LABELS[v.worstStatus];
    row.getCell(6).value = v.itemNames.join(', ');

    for (let c = 1; c <= span; c++) {
      const cell = row.getCell(c);
      cell.border = rule(
        'thin', c === 1 ? 'medium' : 'thin',
        r === stats.length + 4 ? 'medium' : 'thin',
        c === span ? 'medium' : 'thin',
      );
      cell.font = body();
      cell.alignment = CENTER;
    }
    row.getCell(1).alignment = LEFT;
    row.getCell(1).font = body({ bold: true });
    row.getCell(6).alignment = LEFT;

    const statusCell = row.getCell(5);
    fill(statusCell, STATUS_FILL[v.worstStatus]);
    statusCell.font = body({ bold: true, color: { argb: STATUS_INK[v.worstStatus] } });

    if (v.avgSlipDays > 0) row.getCell(4).font = body({ bold: true });
    if (v.avgReadiness < 0.9) fill(row.getCell(3), CREAM);
    r++;
  }

  printSetup(sheet, 4, `${project?.name ?? 'Procurement'} | vendor`);
}

/* ─────────────── Sheet 5 · Findings ─────────────── */

function buildFindings(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  anomalies: Anomaly[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('Findings', sheetOptions({ y: 4 }));
  const widths = [6, 11, 28, 22, 15, 22, 50];
  sheet.columns = widths.map(w => ({ width: w }));
  const span = widths.length;

  writeCaption(
    sheet, span,
    'Open Findings',
    'Read off the milestone dates, document readiness and PO status',
    docNumber(project, revision), revision,
  );

  const head = sheet.getRow(4);
  ['No', 'Severity', 'Equipment / Material', 'Supplier / Vendor Name', 'PO No.', 'Finding', 'Detail']
    .forEach((h, i) => { head.getCell(i + 1).value = h; });
  styleHead(head, span, 22, c => (c === 2 ? YELLOW : GREY));

  if (!anomalies.length) {
    sheet.mergeCells(5, 1, 5, span);
    const c = sheet.getCell(5, 1);
    c.value = 'Nothing outstanding at this revision.';
    c.font = body();
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let i = 1; i <= span; i++) {
      sheet.getCell(5, i).border = rule('thin', i === 1 ? 'medium' : 'thin', 'medium', i === span ? 'medium' : 'thin');
    }
    sheet.getRow(5).height = 18;
    printSetup(sheet, 4, `${project?.name ?? 'Procurement'} | findings`);
    return;
  }

  const byId = new Map(items.map(i => [i.id, i]));
  let r = 5;
  anomalies.forEach((a, idx) => {
    const item = byId.get(a.itemId);
    const row = sheet.getRow(r);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = a.severity === 'crit' ? 'CRITICAL' : 'Attention';
    if (item?.desc) row.getCell(3).value = item.desc;
    if (item?.vendor) row.getCell(4).value = item.vendor;
    if (item?.poNo) row.getCell(5).value = item.poNo;
    row.getCell(6).value = a.title;
    row.getCell(7).value = a.detail;

    for (let c = 1; c <= span; c++) {
      const cell = row.getCell(c);
      cell.border = rule(
        'thin', c === 1 ? 'medium' : 'thin',
        idx === anomalies.length - 1 ? 'medium' : 'thin',
        c === span ? 'medium' : 'thin',
      );
      cell.font = body();
      cell.alignment = LEFT;
    }
    row.getCell(1).alignment = CENTER;

    const sev = row.getCell(2);
    sev.alignment = CENTER;
    fill(sev, a.severity === 'crit' ? STATUS_FILL.late : STATUS_FILL.atrisk);
    sev.font = body({
      bold: true,
      color: { argb: a.severity === 'crit' ? STATUS_INK.late : BLACK },
    });
    row.getCell(3).font = body({ bold: true });
    r++;
  });

  printSetup(sheet, 4, `${project?.name ?? 'Procurement'} | findings`);
}

/* ─────────────── Entry point ─────────────── */

function safeFileName(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Procurement';
}

export interface ExportResult {
  fileName: string;
  revision: number;
}

/**
 * Stamped on workbooks this app writes. The importer reads it so a re-import
 * takes items from Monitoring only, instead of also scraping the Milestone and
 * Findings sheets — which list the same equipment and would arrive as junk rows.
 */
export const EXPORT_MARKER = 'figtries-procurement-export';

/** Sheet holding the authoritative item rows in our own exports. */
export const PRIMARY_SHEET = 'Monitoring';

/** Assemble the workbook. Kept free of browser APIs so it can run anywhere. */
export function buildWorkbook(
  project: Project | null,
  items: ProcurementItem[],
  revision: number,
): ExcelJS.Workbook {
  const anomalies = detectAnomalies(items);

  const wb = new ExcelJS.Workbook();
  wb.creator = project?.pic || 'Procurement';
  wb.company = project?.client || '';
  wb.lastModifiedBy = project?.pic || 'Procurement';
  wb.created = new Date();
  wb.title = `Procurement Monitoring Dashboard - ${project?.name ?? 'All projects'}`;
  wb.subject = docNumber(project, revision);
  wb.category = EXPORT_MARKER;

  buildSummary(wb, project, items, anomalies, revision);
  buildMonitoring(wb, project, items, revision);
  buildMilestones(wb, project, items, revision);
  buildVendors(wb, project, items, revision);
  buildFindings(wb, project, items, anomalies, revision);

  return wb;
}

export function exportFileName(project: Project | null, revision: number): string {
  const rev = String(revision).padStart(2, '0');
  const stamp = shortDate(today()).replace(/\//g, '');
  return `Procurement Monitoring Dashboard ${safeFileName(project?.name ?? 'All Projects')}_rev${rev}_${stamp}.xlsx`;
}

/**
 * Build and download the project workbook.
 * Returns the revision used so the caller can persist the bump.
 */
export async function exportWorkbook(
  project: Project | null,
  items: ProcurementItem[],
): Promise<ExportResult> {
  const revision = (project?.revision ?? 0) + 1;
  const wb = buildWorkbook(project, items, revision);
  const fileName = exportFileName(project, revision);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { fileName, revision };
}
