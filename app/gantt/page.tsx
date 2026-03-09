"use client";

import { useData } from "@/lib/data-context";
import { differenceInDays, parseISO, format, startOfMonth } from "date-fns";
import { es as esLocale, enUS as enLocale } from "date-fns/locale";
import type { ProjectStatus } from "@/types";
import { useT, useLang } from "@/lib/i18n";
import { PrintButton } from "@/components/print-button";
import { PrintHeader } from "@/components/print-header";

const statusColors: Record<ProjectStatus, string> = {
  "active":     "bg-blue-400",
  "at-risk":    "bg-red-400",
  "on-hold":    "bg-yellow-400",
  "completed":  "bg-emerald-400",
  "guarantee":  "bg-purple-400",
  "delayed":    "bg-orange-400",
  "terminated": "bg-slate-400",
};

const CHART_START = new Date("2025-01-01");
const CHART_END   = new Date("2027-01-01");
const TOTAL_DAYS  = differenceInDays(CHART_END, CHART_START);
const TODAY       = new Date("2026-02-18");

export default function GanttPage() {
  const { projects } = useData();
  const t = useT();
  const { lang } = useLang();
  const dateLocale = lang === "en" ? enLocale : esLocale;

  const statusLabel: Record<ProjectStatus, string> = {
    "active":     t.status_in_progress,
    "at-risk":    t.status_at_risk,
    "on-hold":    t.status_on_hold_alt,
    "completed":  t.status_completed,
    "guarantee":  t.status_guarantee,
    "delayed":    t.status_delayed,
    "terminated": t.status_terminated,
  };

  function getMonthHeaders() {
    const months: { label: string; left: number; width: number }[] = [];
    let cursor = startOfMonth(CHART_START);
    while (cursor < CHART_END) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const monthEnd  = nextMonth > CHART_END ? CHART_END : nextMonth;
      const from = cursor < CHART_START ? CHART_START : cursor;
      const to   = monthEnd;
      const left  = (differenceInDays(from, CHART_START) / TOTAL_DAYS) * 100;
      const width = (differenceInDays(to, from) / TOTAL_DAYS) * 100;
      months.push({ label: format(cursor, "MMM yy", { locale: dateLocale }), left, width });
      cursor = nextMonth;
    }
    return months;
  }

  const months    = getMonthHeaders();
  const todayLeft = (differenceInDays(TODAY, CHART_START) / TOTAL_DAYS) * 100;

  const counts = (["active", "at-risk", "on-hold", "completed"] as ProjectStatus[]).map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }));

  const validProjects = projects.filter((p) => p.startDate && p.endDate);

  return (
    <div className="space-y-6">
      <PrintHeader title="Gantt" subtitle={t.gantt_subtitle} />
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gantt</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.gantt_subtitle}</p>
        </div>
        <PrintButton />
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-3">
        {counts.map(({ status, count }) => (
          <div key={status} className="bg-white rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground mt-1">{statusLabel[status]}</p>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs">
        {(Object.entries(statusColors) as [ProjectStatus, string][]).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${c}`} />
            {statusLabel[s]}
          </span>
        ))}
      </div>

      {/* Gantt chart */}
      <div className="bg-white rounded-xl border border-border p-5 overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Encabezado meses */}
          <div className="flex ml-64 mb-2 relative h-6">
            {months.map((m) => (
              <div
                key={m.label}
                className="absolute text-xs text-muted-foreground border-l border-border pl-1 truncate"
                style={{ left: `${m.left}%`, width: `${m.width}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {validProjects.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t.gantt_no_services}
            </p>
          )}

          {validProjects.map((proj) => {
            const start = parseISO(proj.startDate);
            const end   = parseISO(proj.endDate);
            const left  = Math.max(0, (differenceInDays(start, CHART_START) / TOTAL_DAYS) * 100);
            const width = Math.max(0.5, (differenceInDays(end, start) / TOTAL_DAYS) * 100);
            const clamped = Math.min(width, 100 - left);

            return (
              <div key={proj.id} className="flex items-center mb-2 group">
                <div className="w-64 flex-shrink-0 pr-3">
                  <p className="text-xs font-medium text-foreground truncate">{proj.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{proj.client ?? proj.manager}</p>
                </div>

                <div className="flex-1 relative h-7">
                  {/* Línea de hoy */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-400 z-10 opacity-70"
                    style={{ left: `${todayLeft}%` }}
                  />
                  {/* Barra */}
                  <div
                    className={`absolute top-1 h-5 rounded ${statusColors[proj.status]} opacity-85 hover:opacity-100 transition-opacity cursor-default overflow-hidden flex items-center`}
                    style={{ left: `${left}%`, width: `${clamped}%` }}
                    title={`${proj.name} | ${proj.startDate} → ${proj.endDate} | ${proj.progress}%`}
                  >
                    <div className="h-full bg-white/30 rounded-l flex-shrink-0" style={{ width: `${proj.progress}%` }} />
                    <span className="absolute left-1.5 text-white text-xs font-medium whitespace-nowrap">
                      {proj.progress > 0 ? `${proj.progress}%` : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="ml-64 mt-1 relative h-4">
            <div
              className="absolute text-xs text-red-500 font-medium whitespace-nowrap"
              style={{ left: `${todayLeft}%`, transform: "translateX(-50%)" }}
            >
              {t.today}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
