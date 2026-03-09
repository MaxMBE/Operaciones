import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Tasa de conversión CLP → USD (1 USD ≈ 950 CLP) */
export const CLP_TO_USD_RATE = 950;

/**
 * Convierte un valor en CLP a USD y lo muestra con sufijo M/K.
 * Ej: 450_000_000 CLP → "USD 473K"  |  1_900_000_000 CLP → "USD 2.0M"
 */
export function formatClpToUsd(clpValue: number): string {
  if (!clpValue || isNaN(clpValue)) return "—";
  const usd = clpValue / CLP_TO_USD_RATE;
  if (Math.abs(usd) >= 1_000_000) return `USD ${(usd / 1_000_000).toFixed(1)}M`;
  if (Math.abs(usd) >= 1_000)     return `USD ${Math.round(usd / 1_000)}K`;
  return `USD ${Math.round(usd).toLocaleString("es-CL")}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function calcGrossMargin(revenue: number, directCosts: number): number {
  if (revenue === 0) return 0;
  return ((revenue - directCosts) / revenue) * 100;
}

export function calcNetMargin(revenue: number, directCosts: number, opex: number): number {
  if (revenue === 0) return 0;
  return ((revenue - directCosts - opex) / revenue) * 100;
}

/** Fiscal quarter: Q1=Apr–Jun, Q2=Jul–Sep, Q3=Oct–Dec, Q4=Jan–Mar. FY labeled by year of April start. */
export function getFiscalQuarter(date: Date = new Date()) {
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const fyYear = m >= 4 ? y : y - 1;
  const q = m >= 4 ? (m <= 6 ? 1 : m <= 9 ? 2 : 3) : 4;
  const ranges = [["Abr", "Jun"], ["Jul", "Sep"], ["Oct", "Dic"], ["Ene", "Mar"]];
  const [start, end] = ranges[q - 1];
  return { quarter: q, fyYear, label: `Q${q} · FY${fyYear}`, range: `${start}–${end}` };
}
