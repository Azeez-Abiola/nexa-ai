import Papa from "papaparse";

/**
 * CSV export for the admin pages.
 *
 * Uses Papa rather than joining with commas, which is what the tenant page did before:
 * any value containing a comma, a quote or a newline (tenant labels and user names
 * regularly do) silently shifted every later column on that row, so the file opened
 * looking plausible and was wrong.
 */

/** A section of a CSV file: an optional title, a header row, and the rows themselves. */
export type CsvSection = {
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
};

function timestamp(): string {
  return new Date().toISOString().split("T")[0];
}

function triggerDownload(csv: string, filename: string) {
  // Excel assumes the system codepage unless a byte-order mark says otherwise, which
  // turns any non-ASCII character in a name into mojibake.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  // Firefox ignores a click on an element that is not in the document.
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download a single table. `name` is prefixed to a dated filename. */
export function exportCsv(
  name: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const csv = Papa.unparse({ fields: headers, data: rows.map((r) => r.map((c) => c ?? "")) });
  triggerDownload(csv, `nexa-${name}-${timestamp()}.csv`);
}

/**
 * Download several tables as one file, separated by a blank line and a title.
 *
 * A page like Analytics has no single table to export, and producing five files per
 * click is worse than one file someone can scroll. Spreadsheet apps handle the ragged
 * shape fine: each section keeps its own header row.
 */
export function exportCsvSections(name: string, sections: CsvSection[]): void {
  const blocks = sections
    .filter((s) => s.rows.length > 0)
    .map((section) => {
      const table = Papa.unparse({
        fields: section.headers,
        data: section.rows.map((r) => r.map((c) => c ?? "")),
      });
      return section.title ? `${Papa.unparse([[section.title]])}\n${table}` : table;
    });

  triggerDownload(blocks.join("\n\n"), `nexa-${name}-${timestamp()}.csv`);
}
