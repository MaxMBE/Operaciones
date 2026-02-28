"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useData } from "@/lib/data-context";
import { useT, useLang } from "@/lib/i18n";

function buildTimeline(
  projects: { startDate?: string; endDate?: string; status: string }[],
  locale: string
) {
  const now = new Date();
  const year = now.getFullYear();

  return Array.from({ length: 18 }, (_, i) => {
    const d = new Date(year, now.getMonth() - 6 + i, 1);
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const label    = d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
    const isToday  = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

    let active = 0, finalized = 0;

    projects.forEach(p => {
      const start = p.startDate ? new Date(p.startDate + "T00:00:00") : null;
      const end   = p.endDate   ? new Date(p.endDate   + "T00:00:00") : null;

      const started  = !start || start <= lastDay;
      const notEnded = !end   || end   >= firstDay;

      if (started && notEnded) {
        if (p.status === "completed" || p.status === "guarantee") {
          finalized++;
        } else {
          active++;
        }
      }
    });

    return { month: label, active, finalized, isToday };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, activeLabel, finalizedLabel }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: { dataKey: string; value: number; color: string }) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">
            {entry.dataKey === "active" ? activeLabel : finalizedLabel}:
          </span>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ServicesTimelineChart() {
  const { projects } = useData();
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "es-CL";

  const data = useMemo(() => buildTimeline(projects, locale), [projects, locale]);

  const todayIndex = data.findIndex(d => d.isToday);
  const todayLabel = todayIndex >= 0 ? data[todayIndex].month : undefined;

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-sm text-foreground">{t.timeline_chart_title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t.timeline_chart_sub}</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gradActivos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradFin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={1} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={
            <CustomTooltip
              activeLabel={t.chart_active}
              finalizedLabel={t.chart_finalized}
            />
          } />
          {todayLabel && (
            <ReferenceLine
              x={todayLabel}
              stroke="#94a3b8"
              strokeDasharray="4 3"
              label={{ value: t.today, position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }}
            />
          )}
          <Area
            type="monotone"
            dataKey="active"
            name={t.chart_active}
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#gradActivos)"
            dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="finalized"
            name={t.chart_finalized}
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradFin)"
            dot={{ r: 2.5, fill: "#10b981", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            strokeDasharray="5 3"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Mini legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-5 h-0.5 bg-indigo-500 inline-block rounded" />
          {t.chart_active}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-5 h-0.5 bg-emerald-500 inline-block rounded" style={{ backgroundImage: "repeating-linear-gradient(90deg,#10b981 0,#10b981 4px,transparent 4px,transparent 7px)" }} />
          {t.chart_finalized_legend}
        </span>
      </div>
    </div>
  );
}
