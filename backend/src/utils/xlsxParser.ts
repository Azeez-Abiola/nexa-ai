import * as XLSX from "xlsx";

/**
 * Extract text content from an Excel workbook (.xlsx) buffer.
 * Each sheet is rendered as a labelled block of tab-separated rows so the
 * chunking service can split on natural sentence/paragraph boundaries.
 */
export function extractTextFromXlsx(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: ""
    }) as string[][];

    if (rows.length === 0) continue;

    const lines = rows
      .map((row) => row.map((cell) => String(cell ?? "").trim()).join("\t"))
      .filter((line) => line.replace(/\t/g, "").trim().length > 0);

    if (lines.length === 0) continue;

    sections.push(`Sheet: ${sheetName}\n${lines.join("\n")}`);
  }

  if (sections.length === 0) {
    throw new Error("No readable content found in Excel file");
  }

  return sections.join("\n\n");
}
