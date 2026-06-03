"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList, Cell,
} from "recharts";
import type { Project, ProjectReport } from "@/types";
import { computeMonthlyWeighted } from "@/lib/monthly-margin";

interface ActividadMesLite { mes: string; produccion: number; margen: number; }

interface Props {
  projects: Project[];
  actMap: Record<string, ActividadMesLite[]>;
  reportData?: Record<string, ProjectReport>;
  // Fired whenever the chart's per-month weighted % values are recomputed.
  // The Portfolio Gross Margin card reads from this so it shows the EXACT
  // same number the chart displays — no parallel calculation.
  onWeightedComputed?: (byMonth: Record<string, number>) => void;
}

interface SnapshotMeta { id: string; snapshot_date: string; created_at: string; }
interface SnapshotFull { id: string; snapshot_date: string; created_at: string; projects: Project[]; }

// A snapshot is "forecast" when it was created BEFORE its month started —
// i.e. the numbers were pre-loaded and aren't confirmed actuals yet.
function isForecastSnapshot(snapshotDate: string, createdAt: string): boolean {
  return new Date(createdAt) < new Date(snapshotDate + "T00:00:00Z");
}

function isActiveInMonth(p: Project, mes: string): boolean {
  const [y, m] = mes.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);
  const start = p.startDate ? new Date(p.startDate + "T00:00:00") : null;
  const end   = p.endDate   ? new Date(p.endDate   + "T00:00:00") : null;
  return (!start || start <= lastDay) && (!end || end >= firstDay);
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthRange(): string[] {
  // Year-to-date: January of the current year through the current month.
  const now = new Date();
  const year = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const out: string[] = [];
  for (let m = 1; m <= endMonth; m++) {
    out.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

const EN_MONTH_LABEL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${EN_MONTH_LABEL[m - 1]} ${y}`;
}

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

interface MonthSnap { projects: Project[]; forecast: boolean; }

export function MarginBandsChart({ projects, actMap, onWeightedComputed }: Props) {
  const [snapByMonth, setSnapByMonth] = useState<Record<string, MonthSnap>>({});
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
        // When several snapshots share a month (weekly + canonical monthly),
        // prefer the day-01 one — that's Portfolio's official record.
        const map: Record<string, MonthSnap> = {};
        const chosen: Record<string, string> = {};
        for (const s of fulls) {
          if (!s) continue;
          const ym = s.snapshot_date.slice(0, 7);
          const day = s.snapshot_date.slice(8, 10);
          const existing = chosen[ym];
          if (!existing || day === "01") {
            map[ym] = {
              projects: s.projects,
              forecast: isForecastSnapshot(s.snapshot_date, s.created_at),
            };
            chosen[ym] = day;
          }
        }
        setSnapByMonth(map);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const monthRange = useMemo(() => buildMonthRange(), []);

  const chartData = useMemo<ChartRow[]>(() => {
    const currentMes = currentMonthKey();

    const rows: ChartRow[] = monthRange.map(mes => {
      const counts: Record<string, number> = Object.fromEntries(BANDS.map(b => [b.key, 0]));
      let totalRevenue = 0, totalCost = 0;

      const snapEntry = snapByMonth[mes];
      let sourceProjects: Project[] | null = null;
      let isForecast = false;

      if (snapEntry) {
        sourceProjects = snapEntry.projects;
        isForecast = snapEntry.forecast;
      } else if (mes === currentMes) {
        // Current month with no snapshot yet → forecast from live projects
        // filtered by isActiveInMonth (matches Portfolio's "current month" view).
        sourceProjects = projects.filter(p => isActiveInMonth(p, mes));
        isForecast = true;
      }

      if (!sourceProjects) {
        return {
          mes,
          monthLabel: monthLabel(mes),
          ...counts,
          _weightedPct: 0,
          _hasData: false,
          _isForecast: false,
        };
      }

      // Aggregate weighted from the shared helper (single source of truth).
      const agg = computeMonthlyWeighted(sourceProjects, actMap, mes);
      totalRevenue = agg.totalRevenue;
      totalCost    = agg.totalCost;
      const weightedPct = Math.round(agg.weightedPct);

      // Per-band counts for the stacked bars (using identical cascade).
      const sourceHasRevenue = sourceProjects.some(sp => (sp.revenueMonthly || 0) > 0);
      for (const sp of sourceProjects) {
        let rev: number;
        let cost: number;
        if (sourceHasRevenue) {
          rev  = sp.revenueMonthly || 0;
          cost = sp.costMonthly    || 0;
        } else if (sp.ifsCode) {
          const entry = actMap[sp.ifsCode]?.find(mm => mm.mes === mes);
          if (!entry || entry.produccion <= 0) continue;
          rev  = entry.produccion;
          cost = entry.produccion - entry.margen;
        } else continue;
        if (rev <= 0) continue;
        const pct = ((rev - cost) / rev) * 100;
        const band = pickBand(pct);
        if (band) counts[band]++;
      }

      return {
        mes,
        monthLabel: monthLabel(mes),
        ...counts,
        _weightedPct: weightedPct,
        _hasData: agg.hasData,
        _isForecast: isForecast,
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
  }, [monthRange, snapByMonth, actMap, projects]);

  const hasAnyData = chartData.some(r => r._hasData as boolean);
  const totalActivities = chartData.reduce((max, r) => {
    const n = BANDS.reduce((s, b) => s + ((r[b.key] as number) || 0), 0);
    return Math.max(max, n);
  }, 0);

  // Publish per-month weighted values so the Portfolio Gross Margin card
  // reads the EXACT same number this chart displays.
  useEffect(() => {
    if (!onWeightedComputed) return;
    const byMonth: Record<string, number> = {};
    for (const row of chartData) {
      byMonth[row.mes as string] = (row._weightedPct as number) || 0;
    }
    onWeightedComputed(byMonth);
  }, [chartData, onWeightedComputed]);

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"/>
            Activities by Margin Range — Monthly Evolution
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Active COR services per month, grouped by margin band weighted by production
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
            Weighted Margin
          </span>
          <span className="flex items-center gap-1 text-[9px]" style={{ color: "#f59e0b" }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-500 opacity-45"/>
            Forecast (not confirmed)
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No data loaded yet. Save monthly snapshots in Portfolio to populate this chart.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={chartData} margin={{ top: 36, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false}/>
            <XAxis
              dataKey="monthLabel"
              interval={0}
              tick={(tickProps: { x: number; y: number; payload: { value: string; index: number } }) => {
                const row = chartData[tickProps.payload.index];
                const fc = !!row?._isForecast;
                return (
                  <g transform={`translate(${tickProps.x},${tickProps.y})`}>
                    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={10} fill="currentColor">
                      {tickProps.payload.value}
                    </text>
                    {fc && (
                      <text x={0} y={0} dy={24} textAnchor="middle" fontSize={8} fontWeight={600} fill="#f59e0b">
                        Forecast
                      </text>
                    )}
                  </g>
                );
              }}
              height={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "currentColor" }}
              allowDecimals={false}
              domain={[0, Math.max(10, Math.ceil(totalActivities * 1.15))]}
              label={{ value: "# Activities", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "currentColor" } }}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(v: number, name: string) => {
                const b = BANDS.find(x => x.label === name);
                return [`${v} services`, b?.label ?? name];
              }}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as { _weightedPct?: number } | undefined;
                if (!row || !row._weightedPct) return label;
                return `${label} · Weighted Margin: ${Math.round(row._weightedPct)}%`;
              }}
            />
            {BANDS.map((b, i) => (
              <Bar key={b.key} dataKey={b.key} name={b.label} stackId="margin" fill={b.color} isAnimationActive={false}>
                {chartData.map((row, idx) => (
                  <Cell key={idx} fillOpacity={row._isForecast ? 0.45 : 1}/>
                ))}
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
                      const lightBands = ["b3", "b4"];
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
