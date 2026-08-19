import type ExcelJS from 'exceljs';

/**
 * Hand a finished workbook to the browser as a download.
 *
 * The three exporters — project workbook, vendor form, single-item form — all
 * ended the same way, so the object URL and its revoke live here once. The
 * builders themselves stay free of browser APIs.
 */
export async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string): Promise<string> {
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

  return fileName;
}
