import { getFiscalQuarter } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

export function PrintHeader({ title, subtitle }: PrintHeaderProps) {
  const now = new Date();
  const { label, range, fyYear } = getFiscalQuarter(now);
  const dateStr = format(now, "dd/MM/yyyy", { locale: es });
  const yearLabel = `${range} ${fyYear}`;

  return (
    <div className="hidden print:flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-800">
      <div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">
          SII Group · Operaciones
        </div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="text-right">
        <div className="inline-block bg-gray-800 text-white text-sm font-bold px-3 py-1 rounded-md mb-1">
          {label}
        </div>
        <div className="text-xs text-gray-500">{yearLabel}</div>
        <div className="text-xs text-gray-400 mt-0.5">{dateStr}</div>
      </div>
    </div>
  );
}
