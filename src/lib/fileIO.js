
/**
 * Reading and writing spreadsheet files in the browser.
 *
 * `xlsx` is pinned to the SheetJS CDN build rather than the npm registry copy:
 * npm's newest published version (0.18.5) carries two unfixed high-severity
 * advisories (prototype pollution and ReDoS), and this code parses files
 * uploaded by users. See the `xlsx` entry in package.json.
 *
 * Both libraries are imported dynamically. Together they are ~900 kB, and
 * bundling them statically made simply *opening* the import/export page pay
 * that cost — now it is paid only when a file is actually read or written.
 */

const loadPapa = () => import('papaparse').then((m) => m.default ?? m);
const loadXLSX = () => import('xlsx');

const MAX_BYTES = 10 * 1024 * 1024;

/** Rows as plain objects keyed by header, plus the header list. */
export async function parseSpreadsheet(file) {
  if (file.size > MAX_BYTES) {
    throw new Error(`That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`);
  }

  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const Papa = await loadPapa();
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        // Left off deliberately: Papa's type inference turns a phone number
        // like "03001234567" into 3001234567 and drops the leading zero. Each
        // field's own transform does the conversion instead.
        dynamicTyping: false,
        complete: (result) => {
          const rows = result.data.filter((r) => Object.values(r).some((v) => String(v ?? '').trim()));
          resolve({ rows, headers: result.meta.fields || [] });
        },
        error: (err) => reject(new Error(err.message || 'Could not read that CSV.')),
      });
    });
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await loadXLSX();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('That workbook has no sheets.');

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
    const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 })[0] || [];

    return {
      rows: rows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim())),
      headers: headerRow.map(String).filter(Boolean),
      sheetName,
    };
  }

  throw new Error('Upload a .csv, .xlsx or .xls file.');
}

/** Trigger a browser download for a Blob. */
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Export rows to CSV.
 *
 * `columns` is [{ key, label }]; anything not listed is omitted, so an export
 * never leaks internal fields like gym_id or password hashes.
 */
export async function exportCSV(rows, columns, filename) {
  const Papa = await loadPapa();
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((c) => [c.label, c.format ? c.format(row) : row[c.key] ?? '']))
  );
  const csv = Papa.unparse(data, { columns: columns.map((c) => c.label) });
  // The BOM makes Excel open UTF-8 correctly; without it, accented names and
  // non-Latin scripts render as mojibake.
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}-${stamp()}.csv`);
}

export async function exportXLSX(rows, columns, filename, sheetName = 'Data') {
  const XLSX = await loadXLSX();
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((c) => [c.label, c.format ? c.format(row) : row[c.key] ?? '']))
  );
  const sheet = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) });

  // Size columns to their content, capped so one long note does not push the
  // rest off screen.
  sheet['!cols'] = columns.map((c) => ({
    wch: Math.min(
      40,
      Math.max(c.label.length + 2, ...data.map((d) => String(d[c.label] ?? '').length + 2), 10)
    ),
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, `${filename}-${stamp()}.xlsx`);
}

/** Blank file with just the header row, for users starting from scratch. */
export async function downloadTemplate(headers, filename) {
  const Papa = await loadPapa();
  const csv = Papa.unparse([headers.reduce((a, h) => ({ ...a, [h]: '' }), {})], { columns: headers });
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}-template.csv`);
}
