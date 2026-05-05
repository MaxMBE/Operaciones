"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList,
} from "recharts";
import type { Project, ProjectReport } from "@/types";

interface ActividadMesLite { mes: string; produccion: number; margen: number; }

interface Props {
  projects: Project[];
  actMap: Record<string, ActividadMesLite[]>;
  reportData?: Record<string, ProjectReport>;
}

function parsePercent(s?: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace("%", "").replace(",", "."));
  return isNaN(n) ? null : n;
}

interface SnapshotMeta { id: string; snapshot_date: string; }
interface SnapshotFull { id: string; snapshot_date: string; projects: Project[]; }

const FY_MESES = [
  "2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
  "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03",
];

const MES_LABEL: Record<string, string> = {
  "2025-04":"abr 2025","2025-05":"may 2025","2025-06":"jun 2025","2025-07":"jul 2025",
  "2025-08":"ago 2025","2025-09":"sep 2025","2025-10":"oct 2025","2025-11":"nov 2025",
  "2025-12":"dic 2025","2026-01":"ene 2026","2026-02":"feb 2026","2026-03":"mar 2026",
};

interface Band { key: string; label: string; color: string; min: number; max: number; }

type ChartRow = { [k: string]: number | string | boolean };

const BANDS: Band[] = [
  { key: "b1", label: "1. < 25%",      color: "#111827", min: -Infinity, max: 25 },
  { key: "b2", label: "2. 25% - 28%",  color: "#dc2626", min: 25,  max: 28 },
  { key: "b3", label: "3. 28% - 30%",  color: "#f97316", min: 28,  max: 30 },
  { key: "b4", label: "4. 30% - 34%",  color: "#bef264", min: 30,  max: 34 },
  { key: "b5", label: "5. 34% - 36%",  color: "#84cc16", min: 34,  max: 36 },
  { key: "b6", label: "6. 36% - 40%",  color: "#22c55e", min: 36,  max: 40 },
  { key: "b7", label: "7. 40% - 50%",  color: "#16a34a", min: 40,  max: 50 },
  { key: "b8", label: "8. 50% and +",  color: "#14532d", min: 50,  max: Infinity },
];

function pickBand(pct: number): string | null {
  for (const b of BANDS) if (pct >= b.min && pct < b.max) return b.key;
  return BANDS[BANDS.length - 1].key;
}

function isActiveInMonth(p: Project, mes: string): boolean {
  if (p.status === "completed" || p.status === "terminated") return false;
  const [y, m] = mes.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);
  const start = p.startDate ? new Date(p.startDate + "T00:00:00") : null;
  const end   = p.endDate   ? new Date(p.endDate   + "T00:00:00") : null;
  return (!start || start <= lastDay) && (!end || end >= firstDay);
}

export function MarginBandsChart({ projects, actMap, reportData }: Props) {
  // Load all monthly snapshots so we can use the same revenue/cost figures
  // the COR uses for each historical month, instead of the raw Excel totals.
  const [snapByMonth, setSnapByMonth] = useState<Record<string, Project[]>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list: SnapshotMeta[] = await fetch("/api/snapshots").then(r => r.json());
        if (!Array.isArray(list)) return;
        const fulls = await Promise.all(list.map(s =>
          fetch(`/api/snapshots/${s.id}`).then(r => r.json() as Promise<SnapshotFull>).catch(() => null)
        ));
        if (cancelled) return;
        const map: Record<string, Project[]> = {};
        for (const s of fulls) {
          if (!s) continue;
          map[s.snapshot_date.slice(0, 7)] = s.projects;
        }
        setSnapByMonth(map);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const chartData = useMemo<ChartRow[]>(() => {
    const rows: ChartRow[] = FY_MESES.map(mes => {
      const counts: Record<string, number> = Object.fromEntries(BANDS.map(b => [b.key, 0]));
      let totalRevenue = 0, totalCost = 0;
      let countedActivities = 0;

      // Match the COR table's per-project Monthly Margin formula exactly so
      // the chart counts the same activities the table shows. Per project,
      // try in order:
      //   1) revenueMonthly / costMonthly from snapshot or live project
      //   2) Margin Calculator data (actMap) for that month
      //   3) marginYTD from the report (only contributes a band, not the
      //      weighted total — there is no amount associated with it)
      // A project that yields N/A in all three is skipped, just like the
      // N/A rows in the table.
      const snapMap = new Map<string, Project>();
      const snapProjects = snapByMonth[mes];
      if (snapProjects) for (const sp of snapProjects) snapMap.set(sp.id, sp);

      for (const p of projects) {
        if (!isActiveInMonth(p, mes)) continue;
        const snap = snapMap.get(p.id);
        const rev  = (snap?.revenueMonthly ?? p.revenueMonthly) || 0;
        const cost = (snap?.costMonthly    ?? p.costMonthly)    || 0;

        let pct: number | null = null;

        if (rev > 0) {
          pct = ((rev - cost) / rev) * 100;
          totalRevenue += rev;
          totalCost    += cost;
          countedActivities++;
        } else if (p.ifsCode) {
          const data = actMap[p.ifsCode]?.find(a => a.mes === mes);
          if (data && data.produccion > 0) {
            pct = (data.margen / data.produccion) * 100;
            totalRevenue += data.produccion;
            totalCost    += data.produccion - data.margen;
            countedActivities++;
          }
        }

        // Last fallback: report's marginYTD. Counts the activity in its band
        // but cannot contribute to the weighted total.
        if (pct === null && reportData) {
          const reportPct = parsePercent(reportData[p.id]?.marginYTD);
          if (reportPct !== null) pct = reportPct;
        }

        if (pct === null) continue;
        const band = pickBand(pct);
        if (!band) continue;
        counts[band]++;
      }

      const weightedPct = totalRevenue > 0
        ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100)
        : 0;

      return {
        mes,
        monthLabel: MES_LABEL[mes] || mes,
        ...counts,
        _weightedPct: weightedPct,
        _hasData: totalRevenue > 0,
      };
    });
    return rows.map((row, idx) => {
      const prev = idx > 0 ? rows[idx - 1] : null;
      const deltas: Record<string, number> = {};
      for (const b of BANDS) {
        const cur  = (row[b.key]  as number) || 0;
        const prv  = prev ? ((prev[b.key] as number) || 0) : 0;
        deltas[`${b.key}_delta`] = prev ? cur - prv : 0;
      }
      return { ...row, ...deltas };
    });
  }, [projects, actMap, snapByMonth]);

  const hasAnyData = chartData.some(r => r._hasData as boolean);
  const totalActivities = chartData.reduce((max, r) => {
    const n = BANDS.reduce((s, b) => s + ((r[b.key] as number) || 0), 0);
    return Math.max(max, n);
  }, 0);

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"/>
            Actividades por Rango de Margen — Evolución Mensual
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Servicios activos del COR por mes, agrupados por banda de margen ponderado por producción
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {BANDS.map(b => (
            <span key={b.key} className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: b.color }}/>
              {b.label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="w-3 h-[2px] inline-block" style={{ background: "#16a34a" }}/>
            Margen Ponderado
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Aún no hay datos cargados. Promové meses oficiales en el Margin Calculator para ver el gráfico.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={chartData} margin={{ top: 36, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false}/>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "currentColor" }}/>
            <YAxis
              tick={{ fontSize: 10, fill: "currentColor" }}
              allowDecimals={false}
              domain={[0, Math.max(10, Math.ceil(totalActivities * 1.15))]}
              label={{ value: "# Actividades", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "currentColor" } }}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(v: number, name: string) => {
                const b = BANDS.find(x => x.label === name);
                return [`${v} servicios`, b?.label ?? name];
              }}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as { _weightedPct?: number } | undefined;
                if (!row || !row._weightedPct) return label;
                return `${label} · Margen Ponderado: ${Math.round(row._weightedPct)}%`;
              }}
            />
            {BANDS.map((b, i) => (
              <Bar key={b.key} dataKey={b.key} name={b.label} stackId="margin" fill={b.color} isAnimationActive={false}>
                <LabelList
                  dataKey={b.key}
                  content={((props: Record<string, unknown>) => {
                    const x = props.x as number | undefined;
                    const y = props.y as number | undefined;
                    const width = props.width as number | undefined;
                    const height = props.height as number | undefined;
                    const value = Number(props.value ?? 0);
                    const index = props.index as number | undefined;
                    if (!value || (typeof height === "number" && height < 14)) return null;
                    if (index == null) return null;
                    const row = chartData[index];
                    const delta = row ? (row[`${b.key}_delta`] as number) : 0;
                    const xn = Number(x) + Number(width) / 2;
                    const yn = Number(y) + Number(height) / 2;
                    const arrow = delta > 0 ? " ▲" : delta < 0 ? " ▼" : "";
                    const sign  = delta > 0 ? "+" : "";
                    const txt = delta !== 0 ? `${value} (${sign}${delta}${arrow})` : `${value}`;
                    const useDarkText = b.key === "b4";
                    return (
                      <text x={xn} y={yn} textAnchor="middle" dy=".35em" fontSize={9} fontWeight={600}
                        fill={useDarkText ? "#1f2937" : "#fff"}>
                        {txt}
                      </text>
                    );
                  }) as unknown as React.ComponentProps<typeof LabelList>["content"]}
                />
                {i === BANDS.length - 1 && (
                  <LabelList
                    dataKey="_weightedPct"
                    position="top"
                    content={((props: Record<string, unknown>) => {
                      const x = props.x as number | undefined;
                      const y = props.y as number | undefined;
                      const width = props.width as number | undefined;
                      const index = props.index as number | undefined;
                      if (index == null) return null;
                      const row = chartData[index];
                      if (!row || !row._hasData) return null;
                      const wpct = (row._weightedPct as number) || 0;
                      const bandKey = pickBand(wpct);
                      const band = BANDS.find(bb => bb.key === bandKey)!;
                      // Use white text on dark bands and lime band, dark text on light bands
                      const lightBands = ["b3", "b4"]; // naranja claro, lima
                      const txtColor = lightBands.includes(band.key) ? "#1f2937" : "#fff";
                      const xn = Number(x) + Number(width) / 2;
                      const yn = Number(y) - 6;
                      return (
                        <g>
                          <rect x={xn - 22} y={yn - 12} width={44} height={16} rx={3}
                            fill={band.color} stroke={band.color} strokeWidth={0.5}/>
                          <text x={xn} y={yn} textAnchor="middle" fontSize={10} fontWeight={700} fill={txtColor}>
                            {Math.round(wpct)}%
                          </text>
                        </g>
                      );
                    }) as unknown as React.ComponentProps<typeof LabelList>["content"]}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
