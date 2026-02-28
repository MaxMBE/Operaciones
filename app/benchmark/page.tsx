"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Tag,
  Users,
  Award,
  DollarSign,
  Target,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Smartphone,
  Store,
} from "lucide-react";

// ─── Brand Config ────────────────────────────────────────────────────────────

const BRANDS = ["Pepsi", "Coca-Cola", "Fanta/Mirinda", "7UP/Sprite", "Rappi", "Groupon"] as const;
type Brand = (typeof BRANDS)[number];

const BRAND_COLORS: Record<Brand, string> = {
  Pepsi: "#1d4ed8",
  "Coca-Cola": "#dc2626",
  "Fanta/Mirinda": "#ea580c",
  "7UP/Sprite": "#16a34a",
  Rappi: "#f97316",
  Groupon: "#15803d",
};

// ─── Demo Data ───────────────────────────────────────────────────────────────

const redemptionData = [
  { brand: "Pepsi",         digital: 25.2, fisico: 18.1, total: 22.5 },
  { brand: "Coca-Cola",     digital: 21.5, fisico: 17.2, total: 19.8 },
  { brand: "Fanta/Mirinda", digital: 19.1, fisico: 14.2, total: 17.3 },
  { brand: "7UP/Sprite",    digital: 18.4, fisico: 12.8, total: 16.1 },
  { brand: "Rappi",         digital: 29.8, fisico: 15.0, total: 28.4 },
  { brand: "Groupon",       digital: 36.0, fisico: 22.0, total: 35.2 },
];

const reachData = [
  { brand: "Pepsi",         alcance: 4200,  impresiones: 18400 },
  { brand: "Coca-Cola",     alcance: 5100,  impresiones: 22600 },
  { brand: "Fanta/Mirinda", alcance: 2800,  impresiones: 11200 },
  { brand: "7UP/Sprite",    alcance: 3100,  impresiones: 13800 },
  { brand: "Rappi",         alcance: 8500,  impresiones: 42000 },
  { brand: "Groupon",       alcance: 6200,  impresiones: 28500 },
];

const loyaltyData = [
  { brand: "Pepsi",         score: 7.8 },
  { brand: "Coca-Cola",     score: 7.2 },
  { brand: "Fanta/Mirinda", score: 6.5 },
  { brand: "7UP/Sprite",    score: 6.8 },
  { brand: "Rappi",         score: 5.2 },
  { brand: "Groupon",       score: 4.8 },
];

const costData = [
  { brand: "Pepsi",         costo: 12.50 },
  { brand: "Coca-Cola",     costo: 14.20 },
  { brand: "Fanta/Mirinda", costo: 11.80 },
  { brand: "7UP/Sprite",    costo: 13.10 },
  { brand: "Rappi",         costo: 8.50  },
  { brand: "Groupon",       costo: 6.20  },
];

const trendData = [
  { period: "Q1 2024", Pepsi: 18.2, "Coca-Cola": 17.5, "7UP/Sprite": 14.8 },
  { period: "Q2 2024", Pepsi: 19.5, "Coca-Cola": 18.2, "7UP/Sprite": 15.2 },
  { period: "Q3 2024", Pepsi: 21.8, "Coca-Cola": 19.0, "7UP/Sprite": 15.8 },
  { period: "Q4 2024", Pepsi: 22.5, "Coca-Cola": 19.8, "7UP/Sprite": 16.1 },
  { period: "Q1 2025", Pepsi: 23.1, "Coca-Cola": 20.1, "7UP/Sprite": 16.5 },
];

const radarData = [
  { metric: "Tasa de Canje", Pepsi: 85, "Coca-Cola": 72, "7UP/Sprite": 61, "Fanta/Mirinda": 65 },
  { metric: "Alcance",       Pepsi: 75, "Coca-Cola": 88, "7UP/Sprite": 68, "Fanta/Mirinda": 62 },
  { metric: "Lealtad",       Pepsi: 88, "Coca-Cola": 82, "7UP/Sprite": 74, "Fanta/Mirinda": 72 },
  { metric: "Recompra",      Pepsi: 78, "Coca-Cola": 71, "7UP/Sprite": 65, "Fanta/Mirinda": 61 },
  { metric: "NPS",           Pepsi: 82, "Coca-Cola": 76, "7UP/Sprite": 71, "Fanta/Mirinda": 68 },
];

const campaignTypeData = [
  { brand: "Pepsi",         digital: 60, fisico: 40 },
  { brand: "Coca-Cola",     digital: 55, fisico: 45 },
  { brand: "Fanta/Mirinda", digital: 50, fisico: 50 },
  { brand: "7UP/Sprite",    digital: 45, fisico: 55 },
  { brand: "Rappi",         digital: 90, fisico: 10 },
  { brand: "Groupon",       digital: 95, fisico:  5 },
];

// Avg de marcas de refrescos propias (excl. plataformas)
const BENCHMARK_AVG: Record<string, number> = {
  todos:   19.6,
  digital: 21.5,
  fisico:  15.6,
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

type KpiColor = "blue" | "green" | "orange" | "purple";

function KpiCard({
  title,
  value,
  unit,
  change,
  changeLabel,
  icon: Icon,
  positive,
  color = "blue",
}: {
  title: string;
  value: string;
  unit?: string;
  change: string;
  changeLabel: string;
  icon: React.ElementType;
  positive: boolean;
  color?: KpiColor;
}) {
  const styles: Record<KpiColor, { bg: string; iconColor: string }> = {
    blue:   { bg: "bg-blue-50",   iconColor: "text-blue-600"   },
    green:  { bg: "bg-emerald-50", iconColor: "text-emerald-600" },
    orange: { bg: "bg-orange-50",  iconColor: "text-orange-600"  },
    purple: { bg: "bg-purple-50",  iconColor: "text-purple-600"  },
  };
  const s = styles[color];
  const badgeClass = positive
    ? "text-emerald-700 bg-emerald-50"
    : "text-red-600 bg-red-50";

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${s.bg}`}>
          <Icon className={`w-4 h-4 ${s.iconColor}`} />
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-base text-gray-500 mb-1">{unit}</span>}
      </div>
      <div
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full w-fit ${badgeClass}`}
      >
        {positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {change}&nbsp;<span className="font-normal opacity-80">{changeLabel}</span>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full inline-block flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-900">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type CampaignType = "todos" | "digital" | "fisico";

export default function BenchmarkPage() {
  const [selectedType, setSelectedType] = useState<CampaignType>("todos");

  const pepsiRow = redemptionData.find((d) => d.brand === "Pepsi")!;
  const pepsiRedemption =
    selectedType === "todos"
      ? pepsiRow.total
      : selectedType === "digital"
      ? pepsiRow.digital
      : pepsiRow.fisico;

  const benchmarkAvg = BENCHMARK_AVG[selectedType];
  const diffVsBenchmark = (pepsiRedemption - benchmarkAvg).toFixed(1);

  const dataKey =
    selectedType === "todos" ? "total" : selectedType;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Benchmark Cupones</h1>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full tracking-wide">
              PEPSI
            </span>
          </div>
          <p className="text-gray-500 text-sm ml-12">
            Análisis comparativo de campañas de cupones · Mercado bebidas 2024–2025
          </p>
        </div>

        {/* Filtro tipo campaña */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
          {(["todos", "digital", "fisico"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                selectedType === t
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "digital" && <Smartphone className="w-3.5 h-3.5" />}
              {t === "fisico" && <Store className="w-3.5 h-3.5" />}
              {t === "todos" && <TrendingUp className="w-3.5 h-3.5" />}
              {t === "todos" ? "Todos" : t === "digital" ? "Digital" : "Físico"}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards (Pepsi) ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Redemption Rate · Pepsi"
          value={`${pepsiRedemption}%`}
          change={`${Number(diffVsBenchmark) >= 0 ? "+" : ""}${diffVsBenchmark}pp`}
          changeLabel="vs benchmark promedio"
          icon={Tag}
          positive={Number(diffVsBenchmark) >= 0}
          color="blue"
        />
        <KpiCard
          title="Alcance Total"
          value="4.2M"
          unit="usuarios"
          change="+15%"
          changeLabel="vs Q anterior"
          icon={Users}
          positive={true}
          color="green"
        />
        <KpiCard
          title="Loyalty Score"
          value="7.8"
          unit="/10"
          change="#1"
          changeLabel="en categoría refrescos"
          icon={Award}
          positive={true}
          color="purple"
        />
        <KpiCard
          title="Costo por Canje"
          value="$12.50"
          unit="MXN"
          change="-12%"
          changeLabel="vs benchmark promedio"
          icon={DollarSign}
          positive={true}
          color="orange"
        />
      </div>

      {/* ── Fila de gráficos 1 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Redemption Rate comparativo */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Redemption Rate por Marca
            </h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
              {selectedType === "todos" ? "Total" : selectedType === "digital" ? "Digital" : "Físico"} (%)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={redemptionData} barSize={30} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="brand" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 42]} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={benchmarkAvg}
                stroke="#94a3b8"
                strokeDasharray="5 3"
                label={{
                  value: `Avg ${benchmarkAvg}%`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#94a3b8",
                }}
              />
              <Bar dataKey={dataKey} name="Redemption Rate" radius={[5, 5, 0, 0]}>
                {redemptionData.map((entry) => (
                  <Cell
                    key={entry.brand}
                    fill={BRAND_COLORS[entry.brand as Brand] ?? "#6366f1"}
                    opacity={entry.brand === "Pepsi" ? 1 : 0.55}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2">
            Línea punteada = promedio de marcas de refrescos (excl. plataformas).
          </p>
        </div>

        {/* Reach & Impressions */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Alcance e Impresiones
            </h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
              Miles de personas
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={reachData} barSize={14} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="brand" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="alcance" name="Alcance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="impresiones" name="Impresiones" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Fila de gráficos 2 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar multi-dimensional */}
        <div className="bg-white rounded-xl border p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Scorecard Multi-dimensional · Refrescos
          </h2>
          <ResponsiveContainer width="100%" height={290}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar
                name="Pepsi"
                dataKey="Pepsi"
                stroke="#1d4ed8"
                fill="#1d4ed8"
                fillOpacity={0.25}
                strokeWidth={2.5}
              />
              <Radar
                name="Coca-Cola"
                dataKey="Coca-Cola"
                stroke="#dc2626"
                fill="#dc2626"
                fillOpacity={0.1}
                strokeWidth={1.5}
              />
              <Radar
                name="7UP/Sprite"
                dataKey="7UP/Sprite"
                stroke="#16a34a"
                fill="#16a34a"
                fillOpacity={0.1}
                strokeWidth={1.5}
              />
              <Radar
                name="Fanta/Mirinda"
                dataKey="Fanta/Mirinda"
                stroke="#ea580c"
                fill="#ea580c"
                fillOpacity={0.1}
                strokeWidth={1.5}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Loyalty Score ranking */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">
            Loyalty Score — Ranking
          </h2>
          <div className="space-y-4">
            {[...loyaltyData]
              .sort((a, b) => b.score - a.score)
              .map((item, i) => {
                const isPepsi = item.brand === "Pepsi";
                return (
                  <div key={item.brand} className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold w-5 text-center ${
                        isPepsi ? "text-blue-600" : "text-gray-400"
                      }`}
                    >
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs truncate ${
                            isPepsi ? "font-semibold text-gray-900" : "text-gray-600"
                          }`}
                        >
                          {item.brand}
                          {isPepsi && (
                            <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                              TÚ
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-xs font-bold ml-2 flex-shrink-0 ${
                            item.score >= 7.5
                              ? "text-emerald-600"
                              : item.score >= 6.5
                              ? "text-amber-600"
                              : "text-red-500"
                          }`}
                        >
                          {item.score}
                        </span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(item.score / 10) * 100}%`,
                            background: BRAND_COLORS[item.brand as Brand],
                            opacity: isPepsi ? 1 : 0.45,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="text-xs text-gray-400 mt-5 leading-relaxed">
            Score de lealtad 0–10 basado en tasa de recompra, NPS y engagement de campaña.
          </p>
        </div>
      </div>

      {/* ── Tendencia temporal ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Evolución Redemption Rate · Q1 2024 – Q1 2025
          </h2>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
            Pepsi vs principales competidores (%)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[12, 26]} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="Pepsi"
              stroke="#1d4ed8"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#1d4ed8" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Coca-Cola"
              stroke="#dc2626"
              strokeWidth={1.5}
              dot={{ r: 3, fill: "#dc2626" }}
              strokeDasharray="5 3"
            />
            <Line
              type="monotone"
              dataKey="7UP/Sprite"
              stroke="#16a34a"
              strokeWidth={1.5}
              dot={{ r: 3, fill: "#16a34a" }}
              strokeDasharray="5 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Mix Digital vs Físico ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Mix de Canal · Digital vs Físico (% de cupones emitidos)
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={campaignTypeData} layout="vertical" barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="brand" tick={{ fontSize: 11 }} width={90} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="digital" name="Digital" stackId="a" fill="#3b82f6" radius={[4, 0, 0, 4]} />
            <Bar dataKey="fisico" name="Físico" stackId="a" fill="#bfdbfe" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tabla resumen ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Resumen Comparativo — Todas las Marcas
          </h2>
          <span className="text-xs text-gray-400">
            Campañas:{" "}
            {selectedType === "todos" ? "Todos los tipos" : selectedType === "digital" ? "Digital" : "Físico"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                <th className="text-left px-5 py-3">Marca</th>
                <th className="text-right px-4 py-3">Redemption Rate</th>
                <th className="text-right px-4 py-3">Alcance</th>
                <th className="text-right px-4 py-3">Impresiones</th>
                <th className="text-right px-4 py-3">Loyalty Score</th>
                <th className="text-right px-4 py-3">Costo/Canje</th>
                <th className="text-right px-4 py-3">% Digital</th>
              </tr>
            </thead>
            <tbody>
              {BRANDS.map((brand, i) => {
                const redemption = redemptionData.find((d) => d.brand === brand)!;
                const reach = reachData.find((d) => d.brand === brand)!;
                const loyalty = loyaltyData.find((d) => d.brand === brand)!;
                const cost = costData.find((d) => d.brand === brand)!;
                const ctype = campaignTypeData.find((d) => d.brand === brand)!;
                const isPepsi = brand === "Pepsi";
                const rateValue =
                  dataKey === "total"
                    ? redemption.total
                    : dataKey === "digital"
                    ? redemption.digital
                    : redemption.fisico;

                return (
                  <tr
                    key={brand}
                    className={`border-t transition-colors ${
                      isPepsi
                        ? "bg-blue-50"
                        : i % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: BRAND_COLORS[brand] }}
                        />
                        <span
                          className={`font-medium ${
                            isPepsi ? "text-blue-700" : "text-gray-700"
                          }`}
                        >
                          {brand}
                        </span>
                        {isPepsi && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                            TÚ
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="text-right px-4 py-3 font-semibold tabular-nums"
                      style={{ color: isPepsi ? "#1d4ed8" : "#374151" }}
                    >
                      {rateValue}%
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600 tabular-nums">
                      {(reach.alcance / 1000).toFixed(1)}M
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600 tabular-nums">
                      {(reach.impresiones / 1000).toFixed(1)}M
                    </td>
                    <td className="text-right px-4 py-3">
                      <span
                        className={`font-semibold ${
                          loyalty.score >= 7.5
                            ? "text-emerald-600"
                            : loyalty.score >= 6.5
                            ? "text-amber-600"
                            : "text-red-500"
                        }`}
                      >
                        {loyalty.score}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600 tabular-nums">
                      ${cost.costo.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${ctype.digital}%` }}
                          />
                        </div>
                        <span className="text-gray-600 text-xs tabular-nums w-8 text-right">
                          {ctype.digital}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Fila benchmark avg */}
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs text-gray-500">
                <td className="px-5 py-3 font-semibold">Benchmark promedio (refrescos)</td>
                <td className="text-right px-4 py-3 font-semibold text-gray-600">
                  {benchmarkAvg}%
                </td>
                <td className="text-right px-4 py-3">3.8M</td>
                <td className="text-right px-4 py-3">16.5M</td>
                <td className="text-right px-4 py-3">
                  <span className="text-amber-600 font-semibold">6.9</span>
                </td>
                <td className="text-right px-4 py-3">$13.15</td>
                <td className="text-right px-4 py-3">52%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Nota al pie ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-gray-400 text-center pb-2">
        Datos de referencia 2024–Q1 2025 · Mercado MX · Fuente: datos de demo internos.
        Benchmark promedio excluye plataformas (Rappi, Groupon).
      </p>
    </div>
  );
}
