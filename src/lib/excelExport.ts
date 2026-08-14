import ExcelJS from 'exceljs';
import type { Anomaly, ItemStatus, MilestoneEntry, ProcurementItem, Project } from '@/types';
import {
  STATUS_LABELS, computeDeviation, computeOverallProgress, detectAnomalies,
  disciplineBreakdown, fmtDate, milestoneStats, today, vendorStats,
} from './procurement';

/* ═══════════════════════════════════════════════════════════
   Export the whole project as a workbook the client can send on
   without reformatting: a summary, the monitoring table in the
   layout their own sheets use, milestone detail, vendors, and
   the anomalies the app detected.
   ═══════════════════════════════════════════════════════════ */

const INK        = 'FF1D1D1F';
const INK_SOFT   = 'FF6E6E73';
const RULE       = 'FFD8D8DC';
const HEAD_BG    = 'FF1D1D1F';
const HEAD_INK   = 'FFFFFFFF';
const SECTION_BG = 'FFEDEDF0';

const STATUS_FILL: Record<ItemStatus, string> = {
  onsite:   'FFE8F1FF',
  ontrack:  'FFE8F8EC',
  atrisk:   'FFFFF6E5',
  late:     'FFFCEDEB',
  planning: 'FFF2F2F5',
};
const STATUS_INK: Record<ItemStatus, string> = {
  onsite:   'FF0059B8',
  ontrack:  'FF1E7A33',
  atrisk:   'FFB36900',
  late:     'FFC73E3A',
  planning: 'FF6E6E73',
};

type Align = Partial<ExcelJS.Alignment>;

const LEFT: Align   = { vertical: 'middle', horizontal: 'left',   wrapText: true };
const CENTER: Align = { vertical: 'middle', horizontal: 'center', wrapText: true };
const RIGHT: Align  = { vertical: 'middle', horizontal: 'right' };

function thinBorder(color = RULE): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

function fill(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/** Style a row as a table header: dark ground, white bold text, centred. */
function styleHeaderRow(row: ExcelJS.Row, height = 30): void {
  row.height = height;
  row.eachCell({ includeEmpty: true }, cell => {
    fill(cell, HEAD_BG);
    cell.font = { bold: true, size: 9, color: { argb: HEAD_INK }, name: 'Calibri' };
    cell.alignment = CENTER;
    cell.border = thinBorder('FF3A3A3C');
  });
}

/** Title block shown at the top of every sheet. */
function writeTitle(
  sheet: ExcelJS.Worksheet,
  span: number,
  title: string,
  subtitle: string,
  revision: number,
): void {
  sheet.mergeCells(1, 1, 1, span);
  const t = sheet.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: INK }, name: 'Calibri' };
  t.alignment = CENTER;
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, span);
  const s = sheet.getCell(2, 1);
  s.value = subtitle;
  s.font = { size: 9, color: { argb: INK_SOFT }, italic: true, name: 'Calibri' };
  s.alignment = CENTER;

  sheet.mergeCells(3, 1, 3, span);
  const r = sheet.getCell(3, 1);
  r.value = `rev.${revision}  ·  printed ${fmtDate(today())}`;
  r.font = { size: 9, bold: true, color: { argb: INK_SOFT }, name: 'Calibri' };
  r.alignment = RIGHT;
}

/* ─────────────── Sheet 1 · Summary ─────────────── */

function buildSummary(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  anomalies: Anomaly[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('SUMMARY', {
    properties: { defaultRowHeight: 16 },
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [
    { width: 3 }, { width: 26 }, { width: 16 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 22 },
  ];

  writeTitle(sheet, 7, 'PROCUREMENT SUMMARY', project?.name ?? 'All projects', revision);

  let r = 5;

  /** Small two-column key/value block. */
  const kv = (label: string, value: string | number, bold = false) => {
    const l = sheet.getCell(r, 2);
    l.value = label;
    l.font = { size: 10, color: { argb: INK_SOFT }, name: 'Calibri' };
    const v = sheet.getCell(r, 3);
    v.value = value;
    v.font = { size: 10, bold, color: { argb: INK }, name: 'Calibri' };
    v.alignment = LEFT;
    sheet.mergeCells(r, 3, r, 4);
    r++;
  };

  const sectionHead = (text: string) => {
    r++;
    sheet.mergeCells(r, 2, r, 7);
    const c = sheet.getCell(r, 2);
    c.value = text;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    fill(c, HEAD_BG);
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(r).height = 20;
    r += 1;
  };

  sectionHead('PROJECT DETAILS');
  kv('Project name', project?.name ?? '—', true);
  kv('Client', project?.client ?? '—');
  kv('Location', project?.location ?? '—');
  kv('PIC', project?.pic ?? '—');
  kv('Contract no.', project?.contractNo ?? '—');
  kv('Handover target', project?.handover ? fmtDate(project.handover) : '—');

  const dev = computeDeviation(items, project);

  sectionHead('POSITION AGAINST PLAN');
  kv('Planned progress', `${dev.planPct}%`);
  kv('Actual progress', `${dev.actualPct}%`, true);
  const devRow = r;
  kv('Deviation', `${dev.deviation > 0 ? '+' : ''}${dev.deviation}%`, true);
  const devCell = sheet.getCell(devRow, 3);
  devCell.font = {
    size: 10, bold: true, name: 'Calibri',
    color: { argb: dev.deviation < 0 ? 'FFC73E3A' : 'FF1E7A33' },
  };
  if (dev.slipDays > 0) kv('Estimated delay', `${dev.slipDays} days`);

  sectionHead('ITEM STATUS');
  const statusCounts = (Object.keys(STATUS_LABELS) as ItemStatus[]).map(s => ({
    status: s,
    label: STATUS_LABELS[s],
    n: items.filter(i => i.status === s).length,
  }));
  const statusHeadRow = r;
  ['Status', 'Count', 'Share'].forEach((h, i) => {
    const c = sheet.getCell(statusHeadRow, 2 + i);
    c.value = h;
  });
  styleHeaderRow(sheet.getRow(statusHeadRow), 20);
  r++;
  for (const s of statusCounts) {
    const label = sheet.getCell(r, 2);
    label.value = s.label;
    label.font = { size: 10, bold: true, color: { argb: STATUS_INK[s.status] }, name: 'Calibri' };
    fill(label, STATUS_FILL[s.status]);
    label.border = thinBorder();

    const n = sheet.getCell(r, 3);
    n.value = s.n;
    n.alignment = CENTER;
    n.border = thinBorder();
    n.font = { size: 10, name: 'Calibri' };

    const pct = sheet.getCell(r, 4);
    pct.value = items.length ? s.n / items.length : 0;
    pct.numFmt = '0%';
    pct.alignment = CENTER;
    pct.border = thinBorder();
    pct.font = { size: 10, name: 'Calibri' };
    r++;
  }
  const totalRow = sheet.getCell(r, 2);
  totalRow.value = 'TOTAL';
  totalRow.font = { size: 10, bold: true, name: 'Calibri' };
  totalRow.border = thinBorder();
  const totalN = sheet.getCell(r, 3);
  totalN.value = items.length;
  totalN.alignment = CENTER;
  totalN.font = { size: 10, bold: true, name: 'Calibri' };
  totalN.border = thinBorder();
  r += 1;

  sectionHead('MILESTONE POSITION');
  const msHeadRow = r;
  ['Milestone', 'Done', 'Scheduled', 'Overdue', 'Not scheduled'].forEach((h, i) => {
    sheet.getCell(msHeadRow, 2 + i).value = h;
  });
  styleHeaderRow(sheet.getRow(msHeadRow), 20);
  r++;
  for (const ms of milestoneStats(items)) {
    const cells = [`${ms.label} — ${ms.name}`, ms.done, ms.scheduled, ms.overdue, ms.unplanned];
    cells.forEach((v, i) => {
      const c = sheet.getCell(r, 2 + i);
      c.value = v;
      c.alignment = i === 0 ? LEFT : CENTER;
      c.font = { size: 10, bold: i === 0, name: 'Calibri' };
      c.border = thinBorder();
      if (i === 3 && ms.overdue > 0) {
        fill(c, STATUS_FILL.late);
        c.font = { size: 10, bold: true, color: { argb: STATUS_INK.late }, name: 'Calibri' };
      }
    });
    r++;
  }

  sectionHead('BREAKDOWN BY DISCIPLINE');
  const discHeadRow = r;
  ['Discipline', 'Total', 'On Site', 'On Track', 'At Risk', 'Late'].forEach((h, i) => {
    sheet.getCell(discHeadRow, 2 + i).value = h;
  });
  styleHeaderRow(sheet.getRow(discHeadRow), 20);
  r++;
  for (const d of disciplineBreakdown(items)) {
    const cells = [d.discipline, d.total, d.counts.onsite, d.counts.ontrack, d.counts.atrisk, d.counts.late];
    cells.forEach((v, i) => {
      const c = sheet.getCell(r, 2 + i);
      c.value = v;
      c.alignment = i === 0 ? LEFT : CENTER;
      c.font = { size: 10, bold: i === 0, name: 'Calibri' };
      c.border = thinBorder();
    });
    r++;
  }

  if (anomalies.length) {
    sectionHead('DETECTED ANOMALIES');
    sheet.mergeCells(r, 2, r, 7);
    const note = sheet.getCell(r, 2);
    note.value = `${anomalies.length} findings — see the ANOMALIES sheet for detail.`;
    note.font = { size: 10, italic: true, color: { argb: STATUS_INK.late }, name: 'Calibri' };
    r++;
  }
}

/* ─────────────── Sheet 2 · Monitoring ─────────────── */

interface Column {
  header: string;
  width: number;
  align: Align;
  value: (item: ProcurementItem) => string | number | null;
  numFmt?: string;
}

const MONITORING_COLUMNS: Column[] = [
  { header: 'No', width: 5, align: CENTER, value: () => null },
  { header: 'EQUIPMENT / MATERIAL', width: 34, align: LEFT, value: i => i.desc },
  { header: 'QTY', width: 6, align: CENTER, value: i => i.qty },
  { header: 'UNIT', width: 8, align: CENTER, value: i => i.unit },
  { header: 'VENDOR', width: 26, align: LEFT, value: i => i.vendor },
  { header: 'BRAND', width: 16, align: LEFT, value: i => i.brand },
  { header: 'PO NO', width: 16, align: LEFT, value: i => i.poNo },
  { header: 'PO DATE', width: 12, align: CENTER, value: i => (i.poDate ? fmtDate(i.poDate) : '') },
  { header: 'READINESS DOC', width: 11, align: CENTER, value: i => i.readinessDoc, numFmt: '0%' },
  { header: 'FAT / INSPEKSI', width: 13, align: CENTER, value: i => fmtDate(i.fat.actual || i.fat.forecast || i.fat.plan) },
  { header: 'STATUS FAT', width: 20, align: LEFT, value: i => fatStatusText(i) },
  { header: 'READY TO SHIP', width: 13, align: CENTER, value: i => fmtDate(i.rts.forecast || i.rts.plan) },
  { header: 'ACTUAL RTS', width: 13, align: CENTER, value: i => fmtDate(i.rts.actual) },
  { header: 'PLANNING DELIVERY TO SITE', width: 14, align: CENTER, value: i => fmtDate(i.mos.forecast || i.mos.plan) },
  { header: 'ACTUAL ON SITE', width: 13, align: CENTER, value: i => fmtDate(i.mos.actual) },
  { header: 'DO NO.', width: 22, align: LEFT, value: i => i.doNo },
  { header: 'TERM OF PAYMENT', width: 26, align: LEFT, value: i => i.termOfPayment },
  { header: 'PROGRESS', width: 10, align: CENTER, value: i => i.progress / 100, numFmt: '0%' },
  { header: 'STATUS', width: 11, align: CENTER, value: i => STATUS_LABELS[i.status] },
  { header: 'KETERANGAN', width: 34, align: LEFT, value: i => i.statusNote },
];

/** The wording the client's own sheets use in the FAT status column. */
function fatStatusText(item: ProcurementItem): string {
  if (item.fat.actual) return item.fat.note ? `FAT - Done · ${item.fat.note}` : 'FAT - Done';
  const due = item.fat.forecast || item.fat.plan;
  if (!due) return item.fat.note || 'TBA';
  const overdue = due < today();
  const base = overdue ? 'Estimated — overdue' : 'Estimated';
  return item.fat.note ? `${base} · ${item.fat.note}` : base;
}

function buildMonitoring(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('MONITORING', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
    pageSetup: {
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      paperSize: 9, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.columns = MONITORING_COLUMNS.map(c => ({ width: c.width }));

  writeTitle(
    sheet, MONITORING_COLUMNS.length,
    'PROCUREMENT MONITORING STATUS',
    [project?.name, project?.client].filter(Boolean).join('  ·  ') || 'All projects',
    revision,
  );

  const headRow = sheet.getRow(5);
  MONITORING_COLUMNS.forEach((c, i) => { headRow.getCell(i + 1).value = c.header; });
  styleHeaderRow(headRow, 32);

  let r = 6;
  const groups = disciplineBreakdown(items);
  const sectionLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  groups.forEach((group, gi) => {
    /* Discipline banner, matching the A / B / C sections in the client's sheets. */
    sheet.mergeCells(r, 1, r, MONITORING_COLUMNS.length);
    const banner = sheet.getCell(r, 1);
    banner.value = `${sectionLetters[gi] ?? gi + 1}.  ${group.discipline.toUpperCase()}`;
    banner.font = { bold: true, size: 10, color: { argb: INK }, name: 'Calibri' };
    fill(banner, SECTION_BG);
    banner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    banner.border = thinBorder();
    sheet.getRow(r).height = 20;
    r++;

    const groupItems = items
      .filter(i => (i.discipline || 'Uncategorised') === group.discipline)
      .sort((a, b) => a.desc.localeCompare(b.desc));

    groupItems.forEach((item, idx) => {
      const row = sheet.getRow(r);
      MONITORING_COLUMNS.forEach((col, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = ci === 0 ? idx + 1 : col.value(item);
        cell.alignment = col.align;
        cell.font = { size: 9, name: 'Calibri', color: { argb: INK } };
        cell.border = thinBorder();
        if (col.numFmt) cell.numFmt = col.numFmt;
      });

      // Colour the status cell, and tint the whole row when it needs attention.
      const statusCell = row.getCell(MONITORING_COLUMNS.findIndex(c => c.header === 'STATUS') + 1);
      fill(statusCell, STATUS_FILL[item.status]);
      statusCell.font = { size: 9, bold: true, name: 'Calibri', color: { argb: STATUS_INK[item.status] } };

      if (item.status === 'late' || item.status === 'atrisk') {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber !== MONITORING_COLUMNS.findIndex(c => c.header === 'STATUS') + 1) {
            fill(cell, item.status === 'late' ? 'FFFDF5F4' : 'FFFFFBF2');
          }
        });
      }

      row.height = 26;
      r++;
    });

    if (!groupItems.length) {
      sheet.mergeCells(r, 1, r, MONITORING_COLUMNS.length);
      const empty = sheet.getCell(r, 1);
      empty.value = 'No items yet.';
      empty.font = { size: 9, italic: true, color: { argb: INK_SOFT }, name: 'Calibri' };
      empty.alignment = CENTER;
      empty.border = thinBorder();
      r++;
    }
  });

  /* Totals strip. */
  const totalRow = sheet.getRow(r);
  totalRow.getCell(1).value = '';
  totalRow.getCell(2).value = `TOTAL ${items.length} ITEMS`;
  const progIdx = MONITORING_COLUMNS.findIndex(c => c.header === 'PROGRESS') + 1;
  totalRow.getCell(progIdx).value = computeOverallProgress(items) / 100;
  totalRow.getCell(progIdx).numFmt = '0%';
  totalRow.eachCell({ includeEmpty: true }, cell => {
    fill(cell, SECTION_BG);
    cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: INK } };
    cell.border = thinBorder();
    cell.alignment = CENTER;
  });
  totalRow.getCell(2).alignment = LEFT;
  totalRow.height = 22;

  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: MONITORING_COLUMNS.length } };
}

/* ─────────────── Sheet 3 · Milestone ─────────────── */

function buildMilestones(
  wb: ExcelJS.Workbook,
  project: Project | null,
  items: ProcurementItem[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('MILESTONES', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const widths = [30, 20, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 24];
  sheet.columns = widths.map(w => ({ width: w }));

  writeTitle(sheet, widths.length, 'MILESTONE SCHEDULE', 'FAT → RTS → MOS · plan, forecast, actual', revision);

  /* Two-tier header: milestone group over plan/forecast/actual. */
  const groupRow = sheet.getRow(5);
  sheet.mergeCells(5, 1, 6, 1); groupRow.getCell(1).value = 'EQUIPMENT / MATERIAL';
  sheet.mergeCells(5, 2, 6, 2); groupRow.getCell(2).value = 'VENDOR';
  sheet.mergeCells(5, 3, 5, 5); groupRow.getCell(3).value = 'FAT — FACTORY ACCEPTANCE TEST';
  sheet.mergeCells(5, 6, 5, 8); groupRow.getCell(6).value = 'RTS — READY TO SHIP';
  sheet.mergeCells(5, 9, 5, 11); groupRow.getCell(9).value = 'MOS — MATERIAL ON SITE';
  sheet.mergeCells(5, 12, 6, 12); groupRow.getCell(12).value = 'PROGRESS';
  sheet.mergeCells(5, 13, 6, 13); groupRow.getCell(13).value = 'MILESTONE NOTES';
  styleHeaderRow(groupRow, 22);

  const subRow = sheet.getRow(6);
  ['', '', 'Plan', 'Forecast', 'Actual', 'Plan', 'Forecast', 'Actual', 'Plan', 'Forecast', 'Actual', '', '']
    .forEach((v, i) => { if (v) subRow.getCell(i + 1).value = v; });
  styleHeaderRow(subRow, 18);

  let r = 7;
  const todayStr = today();

  for (const item of [...items].sort((a, b) => a.discipline.localeCompare(b.discipline) || a.desc.localeCompare(b.desc))) {
    const row = sheet.getRow(r);
    row.getCell(1).value = item.desc;
    row.getCell(2).value = item.vendor;

    const trio = (ms: MilestoneEntry, startCol: number) => {
      const cells: Array<[number, string]> = [
        [startCol,     ms.plan],
        [startCol + 1, ms.forecast],
        [startCol + 2, ms.actual],
      ];
      for (const [col, date] of cells) {
        const cell = row.getCell(col);
        cell.value = date ? fmtDate(date) : '—';
        cell.alignment = CENTER;
      }
      // Green when done; red when the due date passed with nothing recorded.
      const actualCell = row.getCell(startCol + 2);
      if (ms.actual) {
        fill(actualCell, STATUS_FILL.ontrack);
        actualCell.font = { size: 9, bold: true, name: 'Calibri', color: { argb: STATUS_INK.ontrack } };
      } else {
        const due = ms.forecast || ms.plan;
        if (due && due < todayStr) {
          fill(actualCell, STATUS_FILL.late);
          actualCell.font = { size: 9, bold: true, name: 'Calibri', color: { argb: STATUS_INK.late } };
        }
      }
      // Flag a forecast that moved beyond the plan.
      if (!ms.actual && ms.plan && ms.forecast && ms.forecast > ms.plan) {
        const fc = row.getCell(startCol + 1);
        fill(fc, STATUS_FILL.atrisk);
        fc.font = { size: 9, bold: true, name: 'Calibri', color: { argb: STATUS_INK.atrisk } };
      }
    };

    trio(item.fat, 3);
    trio(item.rts, 6);
    trio(item.mos, 9);

    const prog = row.getCell(12);
    prog.value = item.progress / 100;
    prog.numFmt = '0%';
    prog.alignment = CENTER;

    row.getCell(13).value = [item.fat.note, item.rts.note, item.mos.note].filter(Boolean).join(' · ');

    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = thinBorder();
      if (!cell.font?.bold) cell.font = { size: 9, name: 'Calibri', color: { argb: INK } };
      if (!cell.alignment) cell.alignment = LEFT;
    });
    row.getCell(1).alignment = LEFT;
    row.getCell(2).alignment = LEFT;
    row.getCell(13).alignment = LEFT;
    row.height = 22;
    r++;
  }

  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: widths.length } };
}

/* ─────────────── Sheet 4 · Vendor ─────────────── */

function buildVendors(
  wb: ExcelJS.Workbook,
  items: ProcurementItem[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('VENDORS', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths = [30, 8, 14, 14, 14, 42];
  sheet.columns = widths.map(w => ({ width: w }));

  writeTitle(sheet, widths.length, 'VENDOR SUMMARY', 'Ordered by impact on the schedule', revision);

  const head = sheet.getRow(5);
  ['VENDOR', 'ITEMS', 'AVG. READINESS', 'AVG. SLIP (DAYS)', 'WORST STATUS', 'ITEMS HELD']
    .forEach((h, i) => { head.getCell(i + 1).value = h; });
  styleHeaderRow(head, 28);

  let r = 6;
  for (const v of vendorStats(items)) {
    const row = sheet.getRow(r);
    row.getCell(1).value = v.vendor;
    row.getCell(2).value = v.items;
    row.getCell(3).value = v.avgReadiness;
    row.getCell(3).numFmt = '0%';
    row.getCell(4).value = v.avgSlipDays;
    row.getCell(5).value = STATUS_LABELS[v.worstStatus];
    row.getCell(6).value = v.itemNames.join(' · ');

    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = thinBorder();
      cell.font = { size: 9, name: 'Calibri', color: { argb: INK } };
      cell.alignment = CENTER;
    });
    row.getCell(1).alignment = LEFT;
    row.getCell(1).font = { size: 9, bold: true, name: 'Calibri', color: { argb: INK } };
    row.getCell(6).alignment = LEFT;

    const statusCell = row.getCell(5);
    fill(statusCell, STATUS_FILL[v.worstStatus]);
    statusCell.font = { size: 9, bold: true, name: 'Calibri', color: { argb: STATUS_INK[v.worstStatus] } };

    if (v.avgSlipDays > 0) {
      row.getCell(4).font = { size: 9, bold: true, name: 'Calibri', color: { argb: STATUS_INK.late } };
    }
    if (v.avgReadiness < 0.9) {
      row.getCell(3).font = { size: 9, bold: true, name: 'Calibri', color: { argb: STATUS_INK.atrisk } };
    }
    row.height = 20;
    r++;
  }

  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: widths.length } };
}

/* ─────────────── Sheet 5 · Anomali ─────────────── */

function buildAnomalies(
  wb: ExcelJS.Workbook,
  items: ProcurementItem[],
  anomalies: Anomaly[],
  revision: number,
): void {
  const sheet = wb.addWorksheet('ANOMALIES', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths = [11, 30, 24, 16, 22, 56];
  sheet.columns = widths.map(w => ({ width: w }));

  writeTitle(sheet, widths.length, 'DETECTED ANOMALIES', 'Derived automatically from milestone dates, document readiness and PO status', revision);

  const head = sheet.getRow(5);
  ['SEVERITY', 'EQUIPMENT / MATERIAL', 'VENDOR', 'PO NO', 'FINDING', 'DETAIL']
    .forEach((h, i) => { head.getCell(i + 1).value = h; });
  styleHeaderRow(head, 24);

  if (!anomalies.length) {
    sheet.mergeCells(6, 1, 6, widths.length);
    const c = sheet.getCell(6, 1);
    c.value = 'No anomalies detected. Every item is on schedule.';
    c.font = { size: 10, bold: true, name: 'Calibri', color: { argb: STATUS_INK.ontrack } };
    fill(c, STATUS_FILL.ontrack);
    c.alignment = CENTER;
    c.border = thinBorder();
    sheet.getRow(6).height = 24;
    return;
  }

  const byId = new Map(items.map(i => [i.id, i]));
  let r = 6;
  for (const a of anomalies) {
    const item = byId.get(a.itemId);
    const row = sheet.getRow(r);
    row.getCell(1).value = a.severity === 'crit' ? 'CRITICAL' : 'ATTENTION';
    row.getCell(2).value = item?.desc ?? '—';
    row.getCell(3).value = item?.vendor ?? '—';
    row.getCell(4).value = item?.poNo || '—';
    row.getCell(5).value = a.title;
    row.getCell(6).value = a.detail;

    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = thinBorder();
      cell.font = { size: 9, name: 'Calibri', color: { argb: INK } };
      cell.alignment = LEFT;
    });

    const sev = row.getCell(1);
    sev.alignment = CENTER;
    fill(sev, a.severity === 'crit' ? STATUS_FILL.late : STATUS_FILL.atrisk);
    sev.font = {
      size: 9, bold: true, name: 'Calibri',
      color: { argb: a.severity === 'crit' ? STATUS_INK.late : STATUS_INK.atrisk },
    };
    row.getCell(2).font = { size: 9, bold: true, name: 'Calibri', color: { argb: INK } };
    row.height = 26;
    r++;
  }

  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: widths.length } };
}

/* ─────────────── Entry point ─────────────── */

function safeFileName(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60) || 'PROCUREMENT';
}

export interface ExportResult {
  fileName: string;
  revision: number;
}

/**
 * Stamped on workbooks this app writes. The importer reads it so a re-import
 * takes items from MONITORING only, instead of also scraping the MILESTONE and
 * ANOMALI sheets — which list the same equipment and would arrive as junk rows.
 */
export const EXPORT_MARKER = 'figtries-procurement-export';

/** Sheet holding the authoritative item rows in our own exports. */
export const PRIMARY_SHEET = 'MONITORING';

/** Assemble the workbook. Kept free of browser APIs so it can run anywhere. */
export function buildWorkbook(
  project: Project | null,
  items: ProcurementItem[],
  revision: number,
): ExcelJS.Workbook {
  const anomalies = detectAnomalies(items);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Figtries Procurement';
  wb.created = new Date();
  wb.title = `Procurement Monitoring — ${project?.name ?? 'All projects'}`;
  wb.category = EXPORT_MARKER;

  buildSummary(wb, project, items, anomalies, revision);
  buildMonitoring(wb, project, items, revision);
  buildMilestones(wb, project, items, revision);
  buildVendors(wb, items, revision);
  buildAnomalies(wb, items, anomalies, revision);

  return wb;
}

export function exportFileName(project: Project | null, revision: number): string {
  const stamp = today().replace(/-/g, '');
  return `PROCUREMENT_${safeFileName(project?.name ?? 'ALL')}_rev${revision}_${stamp}.xlsx`;
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
