/**
 * CSV for spreadsheets people pass around: quoted, Excel-safe, and opened as UTF-8.
 *
 * ⚠️ FORMULA INJECTION. A cell beginning with = + - @ (or a tab or carriage return) is run as a
 *    formula when the file is opened in Excel or Sheets. Descriptions and emails here are typed
 *    by the public, so every such cell is prefixed with an apostrophe, which the spreadsheet
 *    shows as plain text. Numbers we format ourselves are passed as numbers and left alone.
 */

export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * Save it in the browser. The byte-order mark is what makes Excel read it as UTF-8 rather than
 * mangling every accented name and description.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
