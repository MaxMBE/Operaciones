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
