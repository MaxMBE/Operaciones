"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell,
} from "recharts";
import type { Project, ProjectReport } from "@/types";

interface SnapshotMeta { id: string; snapshot_date: string; week_label: string; }
interface SnapshotFull {
  id: string;
  snapshot_date: string;
  projects: Project[];
  report_data: Record<string, ProjectReport>;
}

type BandKey = "critical" | "low" | "belowTarget" | "target" | "high";

const BANDS: { key: BandKey; label: string; color: string; min: number; max: number }[] = [
  { key: "critical",    label: "< 0% (loss)",     color: "#111827", min: -Infinity, max: 0    },
  { key: "low",         label: "0–17%",            color: "#ef4444", min: 0,         max: 17   },
  { key: "belowTarget", label: "17–34% (below)",   color: "#f97316", min: 17,        max: 34   },
  { key: "target",      label: "34–45% (target)",  color: "#a3e635", min: 34,        max: 45   },
  { key: "high",        label: "≥ 45% (high)",     color: "#16a34a", min: 45,        max: Infinity },
];

function pickBand(margin: number): BandKey {
  for (const b of BANDS) if (margin >= b.min && margin < b.max) return b.key;
  return "high";
}

function parsePct(s?: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace("%", "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function computeMargin(p: Project, rep?: ProjectReport): number | null {
  if (p.revenueMonthly && p.revenueMonthly > 0) {
    return Math.round((p.revenueMonthly - (p.costMonthly || 0)) / p.revenueMonthly * 100);
  }
  return parsePct(rep?.marginYTD);
}

function monthLabel(d: string): string {
  const [y, m] = d.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function MarginBandsChart() {
  const [data, setData] = useState<SnapshotFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list: SnapshotMeta[] = await fetch("/api/snapshots").then(r => r.json());
        const sorted = [...list].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)).slice(-12);
        const full = await Promise.all(
          sorted.map(s => fetch(`/api/snapshots/${s.id}`).then(r => r.json()))
        );
        if (!cancelled) setData(full);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const chartData = useMemo(() => {
    return data.map(snap => {
      const counts: Record<BandKey, number> = { critical: 0, low: 0, belowTarget: 0, target: 0, high: 0 };
      const clients: Record<BandKey, string[]> = { critical: [], low: [], belowTarget: [], target: [], high: [] };
      for (const p of snap.projects) {
        if (p.status === "completed" || p.status === "terminated") continue;
        const m = computeMargin(p, snap.report_data[p.id]);
        if (m === null) continue;
        const band = pickBand(m);
        counts[band] += 1;
        clients[band].push(`${p.client || p.name} (${m}%)`);
      }
      return {
        month: monthLabel(snap.snapshot_date),
        snapshot_date: snap.snapshot_date,
        ...counts,
        _clients: clients,
      };
    });
  }, [data]);

  if (loading) return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4 text-xs text-muted-foreground">
      Loading margin bands…
    </div>
  );

  if (chartData.length === 0) return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4 text-xs text-muted-foreground">
      No saved monthly snapshots yet.
    </div>
  );

  const totals = chartData.map(r => BANDS.reduce((s, b) => s + (r[b.key] as number), 0));

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold">Margin Bands Evolution</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Active services distributed by gross margin band (target 34%)</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {BANDS.map(b => (
            <span key={b.key} className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: b.color }} />
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "currentColor" }} />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor" }}
            allowDecimals={false}
            label={{ value: "Services", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "currentColor" } }}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
            formatter={(v: number, name: string) => {
              const b = BANDS.find(x => x.key === name);
              return [`${v} services`, b?.label ?? name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {BANDS.map(b => (
            <Bar key={b.key} dataKey={b.key} name={b.label} stackId="margin" fill={b.color}>
              {chartData.map((row, i) => {
                const count = row[b.key] as number;
                const total = totals[i] || 1;
                const pct = ((count / total) * 100).toFixed(1);
                return (
                  <Cell key={i} fill={b.color}>
                    {count > 0 && (
                      <title>{`${b.label}: ${count} (${pct}%)`}</title>
                    )}
                  </Cell>
                );
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
