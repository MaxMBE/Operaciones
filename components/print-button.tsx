"use client";

import { FileDown } from "lucide-react";

export function PrintButton({ label = "Exportar PDF", asMenuItem = false }: { label?: string; asMenuItem?: boolean }) {
  if (asMenuItem) {
    return (
      <button
        className="print:hidden w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-foreground hover:bg-muted/40 transition-colors"
        onClick={() => window.print()}
      >
        <FileDown className="w-3.5 h-3.5 text-indigo-500" />
        {label}
      </button>
    );
  }
  return (
    <button
      className="print:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg border border-border transition-colors font-medium"
      onClick={() => window.print()}
    >
      <FileDown className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
