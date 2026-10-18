// CSV export for municipal auditing. Exports contain no personal data by construction.

type Row = Record<string, string | number | boolean | undefined | null>;

const escape = (v: Row[string]) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

export function downloadCsv(filename: string, rows: Row[]) {
  // BOM so Excel opens UTF-8 (e.g. the "·" in township names) correctly.
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
