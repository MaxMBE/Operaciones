"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { projects } from "@/lib/data";
import type { FinancialData } from "@/types";

interface Props { data: FinancialData[] }

export function BudgetChart({ data }: Props) {
  const chartData = data.map((d) => {
    const proj = projects.find((p) => p.id === d.projectId);
    const shortName = proj?.name.split(" ").slice(0, 2).join(" ") ?? d.projectId;
    return {
      name: shortName,
      Presupuesto: d.budget,
      "Gasto real": d.spent,
      Revenue: d.revenue,
    };
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" }).format(v);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Presupuesto vs Gasto */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4">Presupuesto vs. Gasto Real</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Presupuesto" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gasto real"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue vs Costo total */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4">Revenue vs. Costo Total</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Revenue"    fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gasto real" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
