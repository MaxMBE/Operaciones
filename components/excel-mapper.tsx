"use client";

import { useState, useCallback } from "react";
import { X, FileSpreadsheet, CheckCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { readExcelPreview, guessMapping, applyExcelMapping } from "@/lib/excel-parser";
import type { ExcelPreview, ColumnMapping } from "@/lib/excel-parser";
import { useData } from "@/lib/data-context";

interface Props {
  buffer: ArrayBuffer;
  fileName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELD_LABELS: { key: keyof ColumnMapping; label: string; required: boolean; hint: string }[] = [
  { key: "serviceNameCol",  label: "Service name",         required: true,  hint: "Column that identifies the project" },
  { key: "revenueCol",      label: "Revenue",              required: false, hint: "Billed or projected value" },
  { key: "grossMarginCol",  label: "Gross Margin (%)",     required: false, hint: "Already calculated percentage (e.g. 35.2)" },
  { key: "netMarginCol",    label: "Net Margin (%)",       required: false, hint: "Already calculated percentage (e.g. 18.4)" },
  { key: "directCostsCol",  label: "Direct Costs",         required: false, hint: "Calculated from Gross Margin if not provided" },
  { key: "opexCol",         label: "OPEX / Operating Exp.", required: false, hint: "Calculated from Net Margin if not provided" },
  { key: "budgetCol",       label: "Budget",               required: false, hint: "Approved budget" },
  { key: "spentCol",        label: "Actual Spend",         required: false, hint: "Executed spend" },
];

function SelectCol({
  label, hint, value, columns, required, onChange,
}: {
  label: string; hint: string; value: string; columns: string[]; required: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pl-2.5 pr-7 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">— do not map —</option>
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
    </div>
  );
}

export function ExcelMapper({ buffer, fileName, onClose, onSuccess }: Props) {
  const { projects, updateFinancialData } = useData();

  const [preview, setPreview] = useState<ExcelPreview>(() =>
    readExcelPreview(buffer)
  );
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    const guessed = guessMapping(readExcelPreview(buffer).columns);
    return {
      serviceNameCol: guessed.serviceNameCol ?? "",
      revenueCol:     guessed.revenueCol     ?? "",
      directCostsCol: guessed.directCostsCol ?? "",
      opexCol:        guessed.opexCol        ?? "",
      budgetCol:      guessed.budgetCol      ?? "",
      spentCol:       guessed.spentCol       ?? "",
      grossMarginCol: guessed.grossMarginCol ?? "",
      netMarginCol:   guessed.netMarginCol   ?? "",
    };
  });
  const [result, setResult] = useState<{ unmapped: string[]; count: number } | null>(null);
  const [applied, setApplied] = useState(false);

  function changeSheet(name: string) {
    const p = readExcelPreview(buffer, name);
    setPreview(p);
    const guessed = guessMapping(p.columns);
    setMapping({
      serviceNameCol: guessed.serviceNameCol ?? "",
      revenueCol:     guessed.revenueCol     ?? "",
      directCostsCol: guessed.directCostsCol ?? "",
      opexCol:        guessed.opexCol        ?? "",
      budgetCol:      guessed.budgetCol      ?? "",
      spentCol:       guessed.spentCol       ?? "",
      grossMarginCol: guessed.grossMarginCol ?? "",
      netMarginCol:   guessed.netMarginCol   ?? "",
    });
    setResult(null);
  }

  function updateField(key: keyof ColumnMapping, value: string) {
    setMapping((m) => ({ ...m, [key]: value }));
    setResult(null);
  }

  function handleApply() {
    const { financialData, unmapped } = applyExcelMapping(
      buffer,
      preview.selectedSheet,
      mapping,
      projects.map((p) => ({ id: p.id, name: p.name })),
    );
    updateFinancialData(financialData);
    setResult({ unmapped, count: financialData.length });
    setApplied(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-semibold text-sm text-foreground">{fileName}</p>
              <p className="text-xs text-muted-foreground">{preview.totalRows} rows · {preview.sheetNames.length} sheet(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Selector de hoja */}
          {preview.sheetNames.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Excel Sheet</label>
              <div className="flex flex-wrap gap-2">
                {preview.sheetNames.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSheet(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      s === preview.selectedSheet
                        ? "bg-primary text-white border-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview de columnas */}
          {preview.columns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">
                Detected columns ({preview.columns.length}) — first rows:
              </p>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="text-xs w-max">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {preview.columns.map((c) => (
                        <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {preview.columns.map((c) => (
                          <td key={c} className="px-3 py-1.5 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                            {row[c] != null ? String(row[c]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mapeo de columnas */}
          <div>
            <p className="text-xs font-medium text-foreground mb-3">Map columns to financial fields</p>
            <div className="grid grid-cols-2 gap-3">
              {FIELD_LABELS.map(({ key, label, required, hint }) => (
                <SelectCol
                  key={key}
                  label={label}
                  hint={hint}
                  required={required}
                  value={mapping[key] ?? ""}
                  columns={preview.columns}
                  onChange={(v) => updateField(key, v)}
                />
              ))}
            </div>
          </div>

          {/* Resultado */}
          {result && (
            <div className={`rounded-xl p-4 ${result.unmapped.length === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-yellow-50 border border-yellow-200"}`}>
              <div className="flex items-start gap-2">
                {result.unmapped.length === 0
                  ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                }
                <div>
                  <p className="text-xs font-medium">
                    {result.count} rows imported successfully.
                  </p>
                  {result.unmapped.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No match found for: <strong>{result.unmapped.join(", ")}</strong>
                      . Added as new projects.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {!mapping.serviceNameCol ? "Select at least the service name column" : "Margins are calculated automatically if you provide Revenue + Costs"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              {applied ? "Close" : "Cancel"}
            </button>
            {!applied ? (
              <button
                onClick={handleApply}
                disabled={!mapping.serviceNameCol}
                className="px-4 py-2 text-xs rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import financial data
              </button>
            ) : (
              <button
                onClick={onSuccess}
                className="px-4 py-2 text-xs rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                View in Finance →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
