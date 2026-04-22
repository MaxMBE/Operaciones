"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { useData } from "@/lib/data-context";
import { useT, useLang } from "@/lib/i18n";

const BENCH_STATUSES = new Set(["completed", "guarantee"]);

function generateBenchTimeline(
  teamMembers: { id: string; projectIds?: string[] }[],
  projects: { id: string; endDate?: string; status: string }[],
  locale: string
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today);
    d.setDate(1);
    d.setMonth(d.getMonth() + i);
    const label = d.toLocaleDateString(locale, { month: "short", year: "2-digit" });

    let bench = 0, critical = 0, medium = 0, low = 0;

    teamMembers.forEach(m => {
      const active = projects.filter(
        p => m.projectIds?.includes(p.id) && !BENCH_STATUSES.has(p.status)
      );
      const lastEndDate = active.reduce<string | null>((lat, p) => {
        if (!p.endDate) return lat;
        return !lat || p.endDate > lat ? p.endDate : lat;
      }, null);

      if (!lastEndDate) { bench++; return; }

      const endD = new Date(lastEndDate + "T00:00:00");
      const daysLeft = Math.ceil((endD.getTime() - d.getTime()) / 86_400_000);

      if (daysLeft < 0)        bench++;
      else if (daysLeft <= 30) critical++;
      else if (daysLeft <= 60) medium++;
      else                     low++;
    });

    return { month: label, low, medium, critical, bench };
  });
}

const COLORS = {
  low:      "#10b981",
  medium:   "#f59e0b",
  critical: "#ef4444",
  bench:    "#9ca3af",
};

export function BurndownChart() {
  const { teamMembers, projects } = useData();
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "es-CL";

  const data = useMemo(
    () => generateBenchTimeline(teamMembers, projects, locale),
    [teamMembers, projects, locale]
  );

  const total = teamMembers.length;
  const pluralS = total !== 1 ? t.bench_chart_plural_s : "";

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-sm text-foreground">{t.bench_chart_title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t.bench_chart_prefix} {total} {t.bench_chart_consultant}{pluralS}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            cursor={{ fill: "#f9fafb" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="low"      name={t.bench_no_risk}      stackId="a" fill={COLORS.low}      radius={[0, 0, 0, 0]} />
          <Bar dataKey="medium"   name={t.bench_medium_risk}  stackId="a" fill={COLORS.medium}   radius={[0, 0, 0, 0]} />
          <Bar dataKey="critical" name={t.bench_critical_risk} stackId="a" fill={COLORS.critical} radius={[0, 0, 0, 0]} />
          <Bar dataKey="bench"    name={t.bench_in_bench}     stackId="a" fill={COLORS.bench}    radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
