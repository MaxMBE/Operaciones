"use client";

import { useRef, useState } from "react";
import { FileText, FileSpreadsheet, RotateCcw, CheckCircle, AlertCircle } from "lucide-react";
import { useData } from "@/lib/data-context";
import { ExcelMapper } from "@/components/excel-mapper";
import { useT } from "@/lib/i18n";

/**
 * Renders CSV/Excel upload actions as dropdown menu items.
 * Meant to be placed inside an existing dropdown/actions menu.
 * onClose: called after a successful action so the parent can close the menu.
 */
export function CsvUploadMenuItems({ onClose }: { onClose?: () => void }) {
  const { loadFromCSV, resetToDefault, isDefaultData } = useData();
  const t = useT();
  const csvRef  = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error,  setError]  = useState("");

  const [excelBuffer,   setExcelBuffer]   = useState<ArrayBuffer | null>(null);
  const [excelFileName, setExcelFileName] = useState("");

  function handleCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStatus("error"); setError("El archivo debe ser .csv"); return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const result = loadFromCSV(e.target?.result as string, file.name);
      if (result.success) { setStatus("success"); setError(""); onClose?.(); }
      else                { setStatus("error");   setError(result.error ?? "Error desconocido"); }
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleExcelFile(file: File) {
    const n = file.name.toLowerCase();
    if (!n.endsWith(".xlsx") && !n.endsWith(".xlsm") && !n.endsWith(".xls")) {
      setStatus("error"); setError("Formato no soportado"); return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setExcelBuffer(e.target?.result as ArrayBuffer);
      setExcelFileName(file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFile(file: File) {
    const n = file.name.toLowerCase();
    if (n.endsWith(".csv")) handleCsvFile(file);
    else handleExcelFile(file);
  }

  return (
    <>
      <div className="border-t border-border">
        <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Cargar datos
        </p>

        <button
          onClick={() => csvRef.current?.click()}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-foreground hover:bg-muted/40 transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          Cargar CSV
        </button>

        <button
          onClick={() => xlsxRef.current?.click()}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-foreground hover:bg-muted/40 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
          Cargar Excel
        </button>

        {!isDefaultData && (
          <button
            onClick={() => { resetToDefault(); setStatus("idle"); onClose?.(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t.csv_reset}
          </button>
        )}

        {status === "success" && (
          <div className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] text-emerald-600">
            <CheckCircle className="w-3 h-3" />{t.csv_success}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-start gap-1.5 px-4 py-1.5 text-[10px] text-red-600">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}
      </div>

      <input ref={csvRef}  type="file" accept=".csv"             className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <input ref={xlsxRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {excelBuffer && (
        <ExcelMapper
          buffer={excelBuffer}
          fileName={excelFileName}
          onClose={() => { setExcelBuffer(null); setExcelFileName(""); }}
          onSuccess={() => { setExcelBuffer(null); setExcelFileName(""); onClose?.(); }}
        />
      )}
    </>
  );
}
