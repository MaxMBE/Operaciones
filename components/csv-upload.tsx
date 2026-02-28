"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle, AlertCircle, RotateCcw, FileText, FileSpreadsheet } from "lucide-react";
import { useData } from "@/lib/data-context";
import { ExcelMapper } from "@/components/excel-mapper";
import { useT } from "@/lib/i18n";

export function CsvUpload() {
  const { loadFromCSV, resetToDefault, isDefaultData, csvFileName, rowCount } = useData();
  const t = useT();
  const csvRef   = useRef<HTMLInputElement>(null);
  const xlsxRef  = useRef<HTMLInputElement>(null);

  const [csvStatus, setCsvStatus] = useState<"idle" | "success" | "error">("idle");
  const [csvError,  setCsvError]  = useState("");

  // Excel mapper state
  const [excelBuffer,   setExcelBuffer]   = useState<ArrayBuffer | null>(null);
  const [excelFileName, setExcelFileName] = useState("");

  // ── CSV handler ───────────────────────────────────────────────────────────
  function handleCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvStatus("error"); setCsvError("El archivo debe ser .csv"); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = loadFromCSV(text, file.name);
      if (result.success) { setCsvStatus("success"); setCsvError(""); }
      else                { setCsvStatus("error");   setCsvError(result.error ?? "Error desconocido"); }
    };
    reader.readAsText(file, "UTF-8");
  }

  // ── Excel handler ─────────────────────────────────────────────────────────
  function handleExcelFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xlsm") && !name.endsWith(".xls")) {
      setCsvStatus("error"); setCsvError("El archivo debe ser .xlsx, .xlsm o .xls"); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      setExcelBuffer(buf);
      setExcelFileName(file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv"))                                                  handleCsvFile(file);
    else if (name.endsWith(".xlsx") || name.endsWith(".xlsm") || name.endsWith(".xls")) handleExcelFile(file);
    else { setCsvStatus("error"); setCsvError("Formato no soportado (.csv, .xlsx, .xlsm)"); }
  }

  return (
    <>
      <div className="px-3 py-3 border-t border-border space-y-2">
        {/* Estado actual */}
        {!isDefaultData && csvFileName ? (
          <div className="flex items-start gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-emerald-700 font-medium truncate">{csvFileName}</p>
              <p className="text-muted-foreground">{rowCount} {t.csv_services_loaded}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t.csv_active_data}</p>
        )}

        {/* Zona drag & drop */}
        <div
          className="border border-dashed border-border rounded-lg p-2.5 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">{t.csv_drop_here}</p>
          <p className="text-xs text-muted-foreground opacity-60">.csv · .xlsx · .xlsm</p>
        </div>

        {/* Botones separados */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => csvRef.current?.click()}
            className="flex items-center justify-center gap-1 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            CSV Lists
          </button>
          <button
            onClick={() => xlsxRef.current?.click()}
            className="flex items-center justify-center gap-1 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:border-emerald-500 hover:text-emerald-600 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
        </div>

        <input ref={csvRef}  type="file" accept=".csv"            className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f);   e.target.value = ""; }} />
        <input ref={xlsxRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcelFile(f); e.target.value = ""; }} />

        {/* Feedback CSV */}
        {csvStatus === "success" && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle className="w-3.5 h-3.5" /><span>{t.csv_success}</span>
          </div>
        )}
        {csvStatus === "error" && (
          <div className="flex items-start gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{csvError}</span>
          </div>
        )}

        {/* Reset */}
        {!isDefaultData && (
          <button
            onClick={() => { resetToDefault(); setCsvStatus("idle"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {t.csv_reset}
          </button>
        )}
      </div>

      {/* Modal Excel Mapper */}
      {excelBuffer && (
        <ExcelMapper
          buffer={excelBuffer}
          fileName={excelFileName}
          onClose={() => { setExcelBuffer(null); setExcelFileName(""); }}
          onSuccess={() => { setExcelBuffer(null); setExcelFileName(""); }}
        />
      )}
    </>
  );
}
