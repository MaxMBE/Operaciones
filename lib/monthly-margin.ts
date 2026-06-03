import type { Project } from "@/types";

interface ActividadMesLite { mes: string; produccion: number; margen: number; }

export interface MonthlyWeighted {
  totalRevenue: number;
  totalCost: number;
  weightedPct: number;
  hasData: boolean;
}

// Single source of truth for weighted monthly margin.
// Used by:
//   - MarginBandsChart (per-month bars + badges)
//   - Portfolio Gross Margin card (active month)
//
// Two-mode rule:
//   A) Snapshot has any project with revenue → use ONLY snapshot
//      revenueMonthly / costMonthly. No actMap fallback.
//   B) Snapshot has zero recorded revenue (incomplete save) → fall back
//      to actMap[ifsCode][mes] (Margin Calculator) per project.
export function computeMonthlyWeighted(
  snapshotProjects: Project[],
  actMap: Record<string, ActividadMesLite[]>,
  mes: string,
): MonthlyWeighted {
  let totalRevenue = 0;
  let totalCost = 0;
  const snapHasRevenue = snapshotProjects.some(sp => (sp.revenueMonthly || 0) > 0);

  for (const sp of snapshotProjects) {
    let rev: number;
    let cost: number;

    if (snapHasRevenue) {
      rev  = sp.revenueMonthly || 0;
      cost = sp.costMonthly    || 0;
    } else if (sp.ifsCode) {
      const entry = actMap[sp.ifsCode]?.find(mm => mm.mes === mes);
      if (!entry || entry.produccion <= 0) continue;
      rev  = entry.produccion;
      cost = entry.produccion - entry.margen;
    } else {
      continue;
    }

    if (rev <= 0) continue;
    totalRevenue += rev;
    totalCost    += cost;
  }

  const weightedPct = totalRevenue > 0
    ? ((totalRevenue - totalCost) / totalRevenue) * 100
    : 0;

  return { totalRevenue, totalCost, weightedPct, hasData: totalRevenue > 0 };
}
