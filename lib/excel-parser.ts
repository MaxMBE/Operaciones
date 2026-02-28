import * as XLSX from "xlsx";
import type { FinancialData } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExcelPreview {
  sheetNames: string[];
  selectedSheet: string;
  columns: string[];
  rows: Record<string, string | number | null>[];  // first 5 rows for preview
  totalRows: number;
}

export interface ColumnMapping {
  serviceNameCol: string;    // column that identifies the project/service
  revenueCol: string;
  directCostsCol: string;
  opexCol: string;
  budgetCol: string;
  spentCol: string;
  grossMarginCol?: string;   // optional: pre-calculated margin
  netMarginCol?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Try to guess the column mapping from common Spanish/English names */
export function guessMapping(columns: string[]): Partial<ColumnMapping> {
  const lower = columns.map((c) => c.toLowerCase().trim());

  function find(...patterns: string[]): string {
    for (const p of patterns) {
      const i = lower.findIndex((c) => c.includes(p));
      if (i >= 0) return columns[i];
    }
    return "";
  }

  return {
    serviceNameCol: find("servicio", "proyecto", "nombre", "service", "project", "name", "título", "titulo"),
    revenueCol:     find("revenue", "ingreso", "venta", "facturac", "income"),
    directCostsCol: find("costo directo", "direct cost", "costo_directo", "costo dir"),
    opexCol:        find("opex", "gasto operac", "operacional", "overhead"),
    budgetCol:      find("presupuest", "budget", "bp "),
    spentCol:       find("gasto real", "ejecutado", "spend", "spent", "real usd", "real clp", "costo real"),
    grossMarginCol: find("margen bruto", "gross margin", "mb %", "mb%", "margen b"),
    netMarginCol:   find("margen neto", "net margin", "mn %", "mn%", "margen n"),
  };
}

// ─── Read Excel → Preview ────────────────────────────────────────────────────

export function readExcelPreview(buffer: ArrayBuffer, sheetName?: string): ExcelPreview {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames;
  const selected = sheetName ?? sheetNames[0];
  const sheet = workbook.Sheets[selected];

  if (!sheet) {
    return { sheetNames, selectedSheet: selected, columns: [], rows: [], totalRows: 0 };
  }

  // Convert to array of objects (header: value)
  const allRows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(sheet, {
    defval: null,
    raw: false,   // strings, so dates come as strings too
  });

  const columns = allRows.length > 0 ? Object.keys(allRows[0]) : [];
  const rows = allRows.slice(0, 5);
  const totalRows = allRows.length;

  return { sheetNames, selectedSheet: selected, columns, rows, totalRows };
}

// ─── Apply mapping → FinancialData ──────────────────────────────────────────

export function applyExcelMapping(
  buffer: ArrayBuffer,
  sheetName: string,
  mapping: ColumnMapping,
  existingProjects: { id: string; name: string }[],
): { financialData: FinancialData[]; unmapped: string[] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(sheet, {
    defval: null,
    raw: false,
  });

  const unmapped: string[] = [];
  const financialData: FinancialData[] = [];

  allRows.forEach((row) => {
    const rawName = String(row[mapping.serviceNameCol] ?? "").trim();
    if (!rawName) return;

    // Try to match with existing project by fuzzy name matching
    const match = existingProjects.find(
      (p) => p.name.toLowerCase().includes(rawName.toLowerCase()) ||
             rawName.toLowerCase().includes(p.name.toLowerCase().slice(0, 10))
    );

    const projectId = match?.id ?? `excel_${financialData.length + 1}`;
    if (!match) unmapped.push(rawName);

    const parse = (col: string): number => {
      if (!col || row[col] == null) return 0;
      const v = String(row[col]).replace(/[%,$\s.]/g, "").replace(",", ".");
      return parseFloat(v) || 0;
    };

    // If pre-calculated margins are provided, use them to back-calculate costs
    const revenue     = parse(mapping.revenueCol);
    const grossMargin = mapping.grossMarginCol ? parse(mapping.grossMarginCol) / 100 : null;
    const netMargin   = mapping.netMarginCol   ? parse(mapping.netMarginCol)   / 100 : null;

    let directCosts = parse(mapping.directCostsCol);
    let opex        = parse(mapping.opexCol);

    // Derive costs from margins if columns not mapped but margin is available
    if (revenue > 0 && grossMargin !== null && directCosts === 0) {
      directCosts = revenue * (1 - grossMargin);
    }
    if (revenue > 0 && netMargin !== null && opex === 0 && grossMargin !== null) {
      opex = revenue * (grossMargin - netMargin);
    }

    financialData.push({
      projectId,
      revenue,
      directCosts,
      operatingExpenses: opex,
      budget: parse(mapping.budgetCol),
      spent:  parse(mapping.spentCol),
    });
  });

  return { financialData, unmapped };
}
