import { Response } from 'express';
import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function sendCsv(res: Response, filename: string, columns: ExportColumn[], rows: Record<string, unknown>[]) {
  const header = columns.map((c) => toCsvValue(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => toCsvValue(row[c.key])).join(','));
  const csv = [header, ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
  res.send(csv);
}

export async function sendExcel(
  res: Response,
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  title = 'AR Medical'
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AR Medical';
  const sheet = workbook.addWorksheet(title.slice(0, 30));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  rows.forEach((row) => sheet.addRow(row));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function respondWithExport(
  res: Response,
  format: string | undefined,
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
) {
  if (format === 'csv') return sendCsv(res, filename, columns, rows);
  if (format === 'excel' || format === 'xlsx') return sendExcel(res, filename, columns, rows);
  res.json({ success: true, data: rows });
}
