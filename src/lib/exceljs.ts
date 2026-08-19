import type ExcelJS from 'exceljs';

/**
 * ExcelJS, fetched the first time a workbook is actually read or written.
 *
 * The library and the zip encoder under it weigh about 1.3 MB — more than
 * everything else this app ships put together. Imported at the top of the
 * export and import modules it landed in the page's first chunk, so every
 * visit paid to download, parse and run it, on the phone as much as on the
 * desk, whether or not a spreadsheet was ever opened. Behind `import()` it
 * is a separate chunk that nothing but the Excel paths ever ask for.
 */
let lib: typeof ExcelJS | null = null;

/** Fetch the library. Every path that touches a workbook awaits this first. */
export async function loadExcelJS(): Promise<typeof ExcelJS> {
  lib ??= (await import('exceljs')).default;
  return lib;
}

/**
 * A blank workbook for the synchronous builders.
 *
 * They assemble a workbook without touching a browser API, which is worth
 * keeping — so rather than making each one async, they call this and the
 * async entry point above them has already awaited `loadExcelJS`.
 */
export function newWorkbook(): ExcelJS.Workbook {
  if (!lib) throw new Error('ExcelJS is not loaded yet — await loadExcelJS() first.');
  return new lib.Workbook();
}
