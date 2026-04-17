"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import React from "react";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface CalendarMonth { nombre: string; dias: number; habiles: number[]; }
interface MesData { profesionales: Record<string, Record<string, number[]>>; }
interface ImputState { profesionales: string[]; proyectos: string[]; meses: Record<number, MesData>; }
interface ResumenRow {
  prof: string; diasBillable: number; diasBench: number; diasVac: number;
  diasFNQ: number; diasREN: number; diasInterno: number; diasTotal: number;
  totalHab: number; activityRate: number;
  alerta: "bench" | "low_ar" | "incompleto" | "sin_data" | "ok";
}
interface CatColor { bg: string; text: string; }

// ─── CALENDARIO 2026 ──────────────────────────────────────────────────────────
const CALENDAR_2026: Record<number, CalendarMonth> = {
  1:  { nombre:"January",    dias:31, habiles:[2,5,6,7,8,9,12,13,14,15,16,19,20,21,22,23,26,27,28,29,30] },
  2:  { nombre:"February",   dias:28, habiles:[2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27] },
  3:  { nombre:"March",      dias:31, habiles:[2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27,30,31] },
  4:  { nombre:"April",      dias:30, habiles:[1,2,3,6,7,8,9,10,13,14,15,16,17,20,21,22,23,24,27,28,29,30] },
  5:  { nombre:"May",        dias:31, habiles:[4,5,6,7,8,11,12,13,14,15,18,19,20,21,22,25,26,27,28,29] },
  6:  { nombre:"June",       dias:30, habiles:[1,2,3,4,5,8,9,10,11,12,15,16,17,18,19,22,23,24,25,26,29,30] },
  7:  { nombre:"July",       dias:31, habiles:[1,2,3,6,7,8,9,10,13,14,15,16,17,20,21,22,23,24,27,28,29,30,31] },
  8:  { nombre:"August",     dias:31, habiles:[3,4,5,6,7,10,11,12,13,14,17,18,19,20,21,24,25,26,27,28,31] },
  9:  { nombre:"September",  dias:30, habiles:[1,2,3,4,7,8,9,10,11,14,15,16,17,18,21,22,23,24,25,28,29,30] },
  10: { nombre:"October",    dias:31, habiles:[1,2,5,6,7,8,9,12,13,14,15,16,19,20,21,22,23,26,27,28,29,30] },
  11: { nombre:"November",   dias:30, habiles:[2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27,30] },
  12: { nombre:"December",   dias:31, habiles:[1,2,3,4,7,8,9,10,11,14,15,16,17,18,21,22,23,28,29,30,31] },
};

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
const CATEGORIAS_ESPECIALES = ["Vacation", "Bench", "FNQ", "REN", "Sick Leave", "Leave"];
const CATEGORIAS_INTERNAS   = ["Internal Project"];

const esBillable = (proyecto: string) =>
  !CATEGORIAS_ESPECIALES.includes(proyecto) &&
  !CATEGORIAS_INTERNAS.includes(proyecto) &&
  proyecto !== "";

const categoriaColor = (proyecto: string): CatColor => {
  if (proyecto === "Bench")       return { bg:"#f44336", text:"#fff" };
  if (proyecto === "Vacation")    return { bg:"#ff9800", text:"#fff" };
  if (proyecto === "FNQ")         return { bg:"#9c27b0", text:"#fff" };
  if (proyecto === "REN")         return { bg:"#607d8b", text:"#fff" };
  if (proyecto === "Sick Leave" || proyecto === "Leave") return { bg:"#795548", text:"#fff" };
  if (CATEGORIAS_INTERNAS.includes(proyecto)) return { bg:"#78909c", text:"#fff" };
  return { bg:"#1565c0", text:"#fff" };
};

// ─── DATOS PRE-CARGADOS (Febrero 2026) ────────────────────────────────────────
const DATA_FEBRERO_2026 = {
  profesionales: [
    "Francisco Garcia","Brahin Cassis","Gabriel Parra","Claudio Cabrera",
    "Lucas Vergara","Marcelo Alarcon","Marco Gonzalez","Nohely Parra",
    "Alexis Sepulveda","Nicolas Coloma","Nicole Riova","Alejandra Chávez",
    "Jorge Salgado","Marco Villarroel","Cristian Puebla","Víctor Valenzuela",
    "Albert Uribe","Aaron Barra","Jason Fuentes","Natalia Martínez",
    "Gustavo Gonzalez","Alfonso Opazo","Noelia Sabando","Santiago Spencer",
    "Vicente Salfate","Bastian Rozas","Andres Barroso","Marco Vasquez",
    "Sebastian Vera","Mauricio Gallardo","Danny Friz","Luis Leiva","Juan Ramirez",
  ],
  proyectos: [
    "SGC0003225.01.P001-2025-2026 Soporte Productivo del producto QR Wallet Emisor",
    "SGC0003288.01.P001-Generadora-Parametrización Nuevas Secciones",
    "SGC0003288.01.P003 - Generadora - Costos Marginales",
    "SGC0003285.01.P001 - CÉLULA ELECNOR",
    "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES",
    "SGC0003277.01.P003 - Ecert - Perfilamiento Custodia",
    "SGC0003277.01.P004 - Ecert - App firma digital fase 2",
    "SGC0003298.01.P001 - Desarrollo POS Autoservicio",
    "SGC0003277.01.P004 - App Firma Digital Fase 2(NFC)",
    "SGC0003233.01.P001 - Servicios Integrados Android (SIA)",
    "SGC0003255.01.P001 - Célula Servicio SRE Cloud",
    "SGC0003291.01.P001 - Servicio de soporte de aplicaciones",
    "SGC0003300.01.P001 - Integración de Facturas Decathlon",
    "SGC0003274.01.P001 - 2025-2026 Soporte Statkraft",
    "SGC0003196.02.P001 - WOM - Release Management",
    "SGC0003103.05.P001 - Scotiabank - Fénix",
    "SGC0003260.01.P001 - 2025-2026 FLOW_ Horas Soporte y mantenimiento",
    "Migrador de Código - Proyecto Interno - SII Group CL",
  ],
  imputaciones: {
    "Francisco Garcia": {
      "SGC0003225.01.P001-2025-2026 Soporte Productivo del producto QR Wallet Emisor": [16,20,23,27],
      "SGC0003288.01.P001-Generadora-Parametrización Nuevas Secciones": [17,24],
      "SGC0003288.01.P003 - Generadora - Costos Marginales": [18,25],
      "SGC0003285.01.P001 - CÉLULA ELECNOR": [26],
      "Vacaciones": [2,3,4,5,6,9,10,11,12,13],
    },
    "Brahin Cassis": {
      "SGC0003225.01.P001-2025-2026 Soporte Productivo del producto QR Wallet Emisor": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Gabriel Parra": {
      "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Claudio Cabrera": {
      "SGC0003288.01.P003 - Generadora - Costos Marginales": [2,3,4,5,6,9,10,11,12,13],
      "Vacaciones": [16,17,18,19,20,23,24,25,26,27],
    },
    "Lucas Vergara": {
      "SGC0003225.01.P001-2025-2026 Soporte Productivo del producto QR Wallet Emisor": [2,3,4,5,6,9,16,20,27],
      "REN": [10,11,12,13,17,18,19,23,24,25,26],
    },
    "Marcelo Alarcon": {
      "Bench": [2,3,4,5,6,9,10,11,12,13],
      "REN": [16,17,18,19,20,23,24,25,26,27],
    },
    "Marco Gonzalez": {
      "SGC0003288.01.P001-Generadora-Parametrización Nuevas Secciones": [2,3,4,5,6,9,10],
      "FNQ": [11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Nohely Parra": {
      "Vacaciones": [2,3,4,5,6,9,10,11,12,13],
      "Bench": [16,17,18,19,20,23,24,25,26,27],
    },
    "Alexis Sepulveda": {
      "SGC0003277.01.P003 - Ecert - Perfilamiento Custodia": [2,3,4,5,6],
      "Vacaciones": [9,10,11,12,13,16,17,18],
      "Bench": [19,20,23,24,25,26,27],
    },
    "Nicolas Coloma": {
      "SGC0003277.01.P004 - Ecert - App firma digital fase 2": [2,3,4,5,6,9,10],
      "SGC0003298.01.P001 - Desarrollo POS Autoservicio": [11],
      "SGC0003288.01.P001-Generadora-Parametrización Nuevas Secciones": [12,13,16,17,18],
      "SGC0003288.01.P003 - Generadora - Costos Marginales": [19,20,23,24,25],
      "SGC0003277.01.P003 - Ecert - Perfilamiento Custodia": [26,27],
    },
    "Nicole Riova": {
      "SGC0003277.01.P004 - Ecert - App firma digital fase 2": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Alejandra Chávez": {
      "SGC0003277.01.P004 - App Firma Digital Fase 2(NFC)": [2,3,4,5],
      "SGC0003233.01.P001 - Servicios Integrados Android (SIA)": [6,9,10,11,12],
      "SGC0003255.01.P001 - Célula Servicio SRE Cloud": [13,16,17,18],
      "SGC0003298.01.P001 - Desarrollo POS Autoservicio": [19],
      "SGC0003277.01.P003 - Ecert - Perfilamiento Custodia": [20,23,24],
      "SGC0003291.01.P001 - Servicio de soporte de aplicaciones": [25,26,27],
    },
    "Jorge Salgado": {
      "SGC0003298.01.P001 - Desarrollo POS Autoservicio": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20],
      "Vacaciones": [23,24,25,26,27],
    },
    "Marco Villarroel": {
      "SGC0003298.01.P001 - Desarrollo POS Autoservicio": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26],
      "Vacaciones": [27],
    },
    "Cristian Puebla": {
      "SGC0003300.01.P001 - Integración de Facturas Decathlon": [2,3,4,5,6,9,16,17,18,19],
      "SGC0003274.01.P001 - 2025-2026 Soporte Statkraft": [10,11],
      "Bench": [12,13,20,23],
      "Vacaciones": [24,25,26,27],
    },
    "Víctor Valenzuela": {
      "SGC0003274.01.P001 - 2025-2026 Soporte Statkraft": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Albert Uribe": {
      "SGC0003196.02.P001 - WOM - Release Management": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Aaron Barra": {
      "SGC0003196.02.P001 - WOM - Release Management": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Jason Fuentes": {
      "SGC0003196.02.P001 - WOM - Release Management": [2,3,4,5,6,9,10,11,12,13],
      "Vacaciones": [16,17,18,19,20,23,24,25,26,27],
    },
    "Natalia Martínez": {
      "SGC0003196.02.P001 - WOM - Release Management": [2,3,4,5,6,9,10,11,12,13],
      "Vacaciones": [16,17,18,19,20,23,24,25,26,27],
    },
    "Gustavo Gonzalez": {
      "SGC0003103.05.P001 - Scotiabank - Fénix": [16,17,18,19,20,23,24,25,26,27],
      "Vacaciones": [2,3,4,5,6,9,10,11,12,13],
    },
    "Alfonso Opazo": {
      "SGC0003103.05.P001 - Scotiabank - Fénix": [16,17,18,19,20,23,24,25,26,27],
      "Vacaciones": [2,3,4,5,6,9,10,11,12,13],
    },
    "Noelia Sabando": {
      "SGC0003103.05.P001 - Scotiabank - Fénix": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Santiago Spencer": {
      "SGC0003103.05.P001 - Scotiabank - Fénix": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Vicente Salfate": {
      "SGC0003103.05.P001 - Scotiabank - Fénix": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26],
      "Vacaciones": [27],
    },
    "Bastian Rozas": {
      "SGC0003285.01.P001 - CÉLULA ELECNOR": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Andres Barroso": {
      "SGC0003291.01.P001 - Servicio de soporte de aplicaciones": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Marco Vasquez": {
      "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES": [2,3,4,5,6],
      "Vacaciones": [9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Sebastian Vera": {
      "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Mauricio Gallardo": {
      "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES": [2,3,4,5,6],
      "Vacaciones": [9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Danny Friz": {
      "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES": [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27],
    },
    "Luis Leiva": {
      "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES": [2,3,4,5,6,9,10,11,12,13,16,17,18],
      "Vacaciones": [19,20,23,24,25,26,27],
    },
    "Juan Ramirez": {
      "SGC0003253.01.P001 - 2025-2026 SII CHILE CÉLULA SEGURIDAD OPERACIONES": [4,11,18,26,27],
      "SGC0003288.01.P003 - Generadora - Costos Marginales": [2,9,16],
      "SGC0003285.01.P001 - CÉLULA ELECNOR": [3,10],
      "SGC0003291.01.P001 - Servicio de soporte de aplicaciones": [5,12],
      "SGC0003300.01.P001 - Integración de Facturas Decathlon": [6,13],
      "Migrador de Código - Proyecto Interno - SII Group CL": [19,20,23,24,27],
    },
  } as Record<string, Record<string, number[]>>,
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "sii_imputaciones_v1";

function loadFromStorage(): ImputState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ImputState;
  } catch {}
  return null;
}

function saveToStorage(data: ImputState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ─── ESTADO INICIAL ───────────────────────────────────────────────────────────
function buildInitialState(): ImputState {
  const stored = loadFromStorage();
  if (stored) return stored;

  const state: ImputState = {
    profesionales: [...DATA_FEBRERO_2026.profesionales],
    proyectos: [...DATA_FEBRERO_2026.proyectos, ...CATEGORIAS_ESPECIALES, ...CATEGORIAS_INTERNAS],
    meses: {},
  };

  for (let m = 1; m <= 12; m++) {
    state.meses[m] = { profesionales: {} };
    for (const prof of state.profesionales) {
      state.meses[m].profesionales[prof] = {};
    }
  }

  for (const [prof, proyData] of Object.entries(DATA_FEBRERO_2026.imputaciones)) {
    for (const [proy, dias] of Object.entries(proyData)) {
      if (!state.meses[2].profesionales[prof]) state.meses[2].profesionales[prof] = {};
      state.meses[2].profesionales[prof][proy] = [...dias];
    }
  }

  return state;
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
const MESES_NOMBRES = ["","January","February","March","April","May","June",
                       "July","August","September","October","November","December"];

function calcResumen(mesData: MesData, mesNum: number): ResumenRow[] {
  const hab = CALENDAR_2026[mesNum]?.habiles || [];
  const totalHab = hab.length;
  const result: ResumenRow[] = [];

  for (const [prof, proyData] of Object.entries(mesData.profesionales || {})) {
    let diasBillable=0, diasBench=0, diasVac=0, diasFNQ=0, diasREN=0, diasInterno=0, diasTotal=0;

    for (const [proy, dias] of Object.entries(proyData)) {
      const d = dias.filter(x => hab.includes(x)).length;
      diasTotal += d;
      if (proy === "Bench") diasBench += d;
      else if (proy === "Vacaciones") diasVac += d;
      else if (proy === "FNQ") diasFNQ += d;
      else if (proy === "REN" || proy === "Reemplazo Víctor Cáceres") diasREN += d;
      else if (CATEGORIAS_INTERNAS.includes(proy) || proy.includes("Proyecto Interno")) diasInterno += d;
      else if (esBillable(proy)) diasBillable += d;
    }

    const activityRate = totalHab > 0 ? diasBillable / totalHab : 0;
    result.push({
      prof, diasBillable, diasBench, diasVac, diasFNQ, diasREN, diasInterno,
      diasTotal, totalHab, activityRate,
      alerta: diasBench > 0 ? "bench"
        : activityRate < 0.92 && activityRate > 0 ? "low_ar"
        : diasTotal < totalHab && diasTotal > 0 ? "incompleto"
        : diasTotal === 0 ? "sin_data" : "ok",
    });
  }
  return result;
}

// ─── EXPORT EXCEL ─────────────────────────────────────────────────────────────
function exportToExcel(state: ImputState, mesNum: number) {
  const cal = CALENDAR_2026[mesNum];
  const hab = cal.habiles;
  const mesData = state.meses[mesNum];

  const rows: (string | number | null)[][] = [];
  const header: (string | number)[] = [
    "Professional", "Project",
    ...Array.from({ length: cal.dias }, (_, i) => i + 1),
    "Total days", "hh",
  ];
  rows.push(header);

  for (const [prof, proyData] of Object.entries(mesData.profesionales)) {
    for (const [proy, dias] of Object.entries(proyData)) {
      const row: (string | number | null)[] = [prof, proy];
      for (let d = 1; d <= cal.dias; d++) {
        row.push(dias.includes(d) ? 8 : null);
      }
      const totalDias = dias.filter(x => hab.includes(x)).length;
      row.push(totalDias || null, null);
      rows.push(row);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Time Logs");
  const ws2 = XLSX.utils.aoa_to_sheet([["Margin","Project","Professional","Days","AR%"]]);
  XLSX.utils.book_append_sheet(wb, ws2, "Margins");
  XLSX.writeFile(wb, `TimeLogs_${MESES_NOMBRES[mesNum]}_2026.xlsx`);
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  label: { display:"block", fontSize:11, color:"#666", marginBottom:4 },
  input: { width:"100%", boxSizing:"border-box", padding:"7px 10px", fontSize:12,
           borderRadius:6, border:"0.5px solid #ccc", background:"#fff", color:"#111" },
  btn:   { padding:"6px 12px", fontSize:12, borderRadius:6, cursor:"pointer",
           border:"0.5px solid #ccc", background:"transparent", color:"#111" },
  btnP:  { padding:"6px 14px", fontSize:12, borderRadius:6, cursor:"pointer",
           border:"none", background:"#111", color:"#fff" },
  sec:   { fontSize:11, fontWeight:500, color:"#666", textTransform:"uppercase",
           letterSpacing:"0.08em", borderBottom:"0.5px solid #e0e0e0",
           paddingBottom:6, marginBottom:14, marginTop:20 },
  card:  { background:"#f5f5f5", borderRadius:8, padding:"10px 14px" },
};

const Sec = ({ children }: { children: React.ReactNode }) => <div style={S.sec}>{children}</div>;

// ─── TAB RESUMEN ──────────────────────────────────────────────────────────────
function TabResumen({ state, mesNum }: { state: ImputState; mesNum: number }) {
  const resumen = useMemo(() =>
    calcResumen(state.meses[mesNum] || { profesionales: {} }, mesNum),
    [state, mesNum]
  );
  const cal = CALENDAR_2026[mesNum];
  const totalHab = cal.habiles.length;
  const sinData = resumen.filter(r => r.alerta === "sin_data").length;
  const conBench = resumen.filter(r => r.diasBench > 0);
  const totalPersonas = resumen.filter(r => r.alerta !== "sin_data").length;
  const arGeneral = totalPersonas > 0
    ? resumen.filter(r => r.alerta !== "sin_data").reduce((a, r) => a + r.diasBillable, 0) / (totalPersonas * totalHab)
    : 0;
  const diasBenchTotal = resumen.reduce((a, r) => a + r.diasBench, 0);
  const arColor = arGeneral >= 0.92 ? "#2e7d32" : arGeneral >= 0.80 ? "#e65100" : "#c62828";

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {([
          ["Active Professionals", totalPersonas, ""],
          ["Working Days", totalHab, ""],
          ["Activity Rate", `${(arGeneral*100).toFixed(1)}%`, arColor],
          ["Total Bench Days", diasBenchTotal, diasBenchTotal>0?"#c62828":""],
        ] as const).map(([label,val,color])=>(
          <div key={label} style={S.card}>
            <div style={{fontSize:11,color:"#666",marginBottom:3}}>{label}</div>
            <div style={{fontSize:22,fontWeight:500,color:color||"#111"}}>{val}</div>
          </div>
        ))}
      </div>

      {sinData > 0 && (
        <div style={{marginBottom:12,padding:"8px 12px",background:"#f5f5f5",borderRadius:6,fontSize:12,color:"#666"}}>
          {sinData} professional(s) with no data in {MESES_NOMBRES[mesNum]}
        </div>
      )}

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{borderBottom:"0.5px solid #ccc"}}>
              {["Professional","Billable","Bench","Leave","FNQ","REN","Internal","Total","AR%","Status"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"6px 8px",color:"#666",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...resumen].sort((a,b)=>a.activityRate-b.activityRate).map(r=>{
              const arC = r.alerta==="sin_data" ? "#999"
                : r.activityRate>=0.92 ? "#2e7d32"
                : r.activityRate>=0.80 ? "#e65100" : "#c62828";
              const alertaBadge = r.alerta==="bench"     ? {bg:"#ffebee",text:"#c62828",label:"⚠ BENCH"}
                : r.alerta==="low_ar"    ? {bg:"#fff3e0",text:"#e65100",label:"AR<92%"}
                : r.alerta==="incompleto"? {bg:"#fff8e1",text:"#f57f17",label:"Incomplete"}
                : r.alerta==="sin_data"  ? {bg:"#f5f5f5",text:"#999",label:"No data"}
                : {bg:"#e8f5e9",text:"#2e7d32",label:"OK"};
              return (
                <tr key={r.prof} style={{borderBottom:"0.5px solid #eee"}}>
                  <td style={{padding:"6px 8px",fontWeight:500}}>{r.prof}</td>
                  <td style={{padding:"6px 8px"}}>{r.diasBillable||"-"}</td>
                  <td style={{padding:"6px 8px",color:r.diasBench>0?"#c62828":""}}>{r.diasBench||"-"}</td>
                  <td style={{padding:"6px 8px"}}>{r.diasVac||"-"}</td>
                  <td style={{padding:"6px 8px"}}>{r.diasFNQ||"-"}</td>
                  <td style={{padding:"6px 8px"}}>{r.diasREN||"-"}</td>
                  <td style={{padding:"6px 8px"}}>{r.diasInterno||"-"}</td>
                  <td style={{padding:"6px 8px"}}>{r.diasTotal||"-"}/{totalHab}</td>
                  <td style={{padding:"6px 8px",fontWeight:600,color:arC}}>
                    {r.alerta==="sin_data" ? "-" : `${(r.activityRate*100).toFixed(0)}%`}
                  </td>
                  <td style={{padding:"6px 8px"}}>
                    <span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,
                      background:alertaBadge.bg,color:alertaBadge.text}}>{alertaBadge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {conBench.length > 0 && (
        <div style={{marginTop:16,background:"#ffebee",borderRadius:8,padding:"12px 16px"}}>
          <div style={{fontSize:12,fontWeight:600,color:"#c62828",marginBottom:6}}>
            ⚠ {conBench.length} person(s) on bench — action required
          </div>
          {conBench.map(r=>(
            <div key={r.prof} style={{fontSize:12,color:"#b71c1c"}}>
              {r.prof}: {r.diasBench} bench days · AR {(r.activityRate*100).toFixed(0)}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CALENDARIO POR PROFESIONAL ───────────────────────────────────────────────
function CalendarioProfesional({
  prof, mesNum, mesData, onToggle, proyectos,
}: {
  prof: string; mesNum: number; mesData: MesData;
  onToggle: (prof: string, proy: string, dia: number) => void;
  proyectos: string[];
}) {
  const cal = CALENDAR_2026[mesNum];
  const diasSemana = ["D","L","M","X","J","V","S"];
  const proyData = mesData?.profesionales?.[prof] || {};
  const primerDia = new Date(2026, mesNum-1, 1).getDay();

  const diaAProyecto: Record<number, string> = {};
  for (const [proy, dias] of Object.entries(proyData)) {
    for (const d of dias) diaAProyecto[d] = proy;
  }

  const [proySel, setProySel] = useState("");

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select style={{...S.input,width:"auto",minWidth:280}} value={proySel}
          onChange={e=>setProySel(e.target.value)}>
          <option value="">▼ Select project to assign</option>
          <optgroup label="Billable projects">
            {proyectos.filter(p=>esBillable(p)).map(p=>(
              <option key={p} value={p}>{p.length>60 ? p.slice(0,60)+"…" : p}</option>
            ))}
          </optgroup>
          <optgroup label="Special categories">
            {[...CATEGORIAS_ESPECIALES,...CATEGORIAS_INTERNAS].map(p=>(
              <option key={p} value={p}>{p}</option>
            ))}
          </optgroup>
        </select>
        <span style={{fontSize:11,color:"#666"}}>Click on a working day to assign/remove</span>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {Object.keys(proyData).filter(p=>proyData[p].length>0).map(p=>{
          const col = categoriaColor(p);
          return (
            <span key={p} style={{fontSize:10,padding:"2px 7px",borderRadius:4,
              background:col.bg,color:col.text}}>
              {p.length>40 ? p.slice(0,40)+"…" : p}: {proyData[p].filter(d=>cal.habiles.includes(d)).length}d
            </span>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {diasSemana.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:"#666",padding:"4px 0"}}>{d}</div>
        ))}
        {Array.from({length:primerDia}).map((_,i)=><div key={`e-${i}`}/>)}
        {Array.from({length:cal.dias},(_,i)=>i+1).map(dia=>{
          const esHabil = cal.habiles.includes(dia);
          const proy = diaAProyecto[dia];
          const col = proy ? categoriaColor(proy) : null;
          return (
            <div key={dia}
              onClick={()=>{ if(!esHabil||!proySel) return; onToggle(prof,proySel,dia); }}
              style={{
                aspectRatio:"1",display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center",
                borderRadius:6,fontSize:11,fontWeight:proy?600:400,
                background: !esHabil ? "#f0f0f0" : col ? col.bg : "#f5f5f5",
                color:       !esHabil ? "#aaa"    : col ? col.text : "#111",
                cursor: esHabil && proySel ? "pointer" : "default",
                border: esHabil && proySel ? "0.5px solid #ccc" : "none",
                minHeight:38, opacity:!esHabil?0.4:1,
              }}
              title={proy || (!esHabil ? "Weekend" : "Not logged")}
            >
              <span>{dia}</span>
              {proy && <span style={{fontSize:8,marginTop:1,opacity:0.9}}>{proy.slice(0,6)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB IMPUTACIONES ─────────────────────────────────────────────────────────
function TabImputaciones({
  state, mesNum, onUpdate,
}: {
  state: ImputState; mesNum: number;
  onUpdate: React.Dispatch<React.SetStateAction<ImputState>>;
}) {
  const [profSel, setProfSel] = useState(state.profesionales[0] || "");
  const [showAddProf, setShowAddProf] = useState(false);
  const [newProf, setNewProf] = useState("");
  const [showAddProy, setShowAddProy] = useState(false);
  const [newProy, setNewProy] = useState("");

  const mesData = state.meses[mesNum] || { profesionales: {} };

  const handleToggle = useCallback((prof: string, proy: string, dia: number) => {
    onUpdate(prev => {
      const next: ImputState = JSON.parse(JSON.stringify(prev));
      if (!next.meses[mesNum]) next.meses[mesNum] = { profesionales: {} };
      if (!next.meses[mesNum].profesionales[prof]) next.meses[mesNum].profesionales[prof] = {};
      if (!next.meses[mesNum].profesionales[prof][proy]) next.meses[mesNum].profesionales[prof][proy] = [];
      const dias = next.meses[mesNum].profesionales[prof][proy];
      const idx = dias.indexOf(dia);
      if (idx >= 0) dias.splice(idx, 1); else dias.push(dia);
      return next;
    });
  }, [mesNum, onUpdate]);

  const handleAddProf = () => {
    if (!newProf.trim()) return;
    onUpdate(prev => {
      const next: ImputState = JSON.parse(JSON.stringify(prev));
      if (!next.profesionales.includes(newProf)) {
        next.profesionales.push(newProf);
        for (let m = 1; m <= 12; m++) {
          if (!next.meses[m]) next.meses[m] = { profesionales: {} };
          if (!next.meses[m].profesionales[newProf]) next.meses[m].profesionales[newProf] = {};
        }
      }
      return next;
    });
    setProfSel(newProf); setNewProf(""); setShowAddProf(false);
  };

  const handleAddProy = () => {
    if (!newProy.trim()) return;
    onUpdate(prev => {
      const next: ImputState = JSON.parse(JSON.stringify(prev));
      if (!next.proyectos.includes(newProy)) next.proyectos.push(newProy);
      return next;
    });
    setNewProy(""); setShowAddProy(false);
  };

  const handleClearProf = (prof: string) => {
    if (!window.confirm(`Clear all time entries for ${prof} in ${MESES_NOMBRES[mesNum]}?`)) return;
    onUpdate(prev => {
      const next: ImputState = JSON.parse(JSON.stringify(prev));
      if (next.meses[mesNum]?.profesionales?.[prof]) next.meses[mesNum].profesionales[prof] = {};
      return next;
    });
  };

  const cal = CALENDAR_2026[mesNum];
  const proyData = mesData.profesionales?.[profSel] || {};
  const diasBillable = Object.entries(proyData)
    .filter(([p])=>esBillable(p))
    .reduce((a,[,d])=>a+d.filter(x=>cal.habiles.includes(x)).length, 0);
  const diasTotal = Object.values(proyData)
    .reduce((a,d)=>a+d.filter(x=>cal.habiles.includes(x)).length, 0);
  const ar = cal.habiles.length > 0 ? diasBillable / cal.habiles.length : 0;
  const arCol = ar >= 0.92 ? "#2e7d32" : ar >= 0.80 ? "#e65100" : "#c62828";

  return (
    <div>
      <Sec>Professional</Sec>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <select style={{...S.input,width:"auto",minWidth:220}} value={profSel}
          onChange={e=>setProfSel(e.target.value)}>
          {state.profesionales.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <button style={S.btn} onClick={()=>setShowAddProf(!showAddProf)}>+ Professional</button>
        <button style={S.btn} onClick={()=>setShowAddProy(!showAddProy)}>+ Project</button>
        {profSel && (
          <button style={{...S.btn,borderColor:"#ef9a9a",color:"#c62828"}}
            onClick={()=>handleClearProf(profSel)}>Clear month</button>
        )}
      </div>

      {showAddProf && (
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={{...S.input,maxWidth:280}} placeholder="Professional name"
            value={newProf} onChange={e=>setNewProf(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleAddProf()}/>
          <button style={S.btnP} onClick={handleAddProf}>Add</button>
        </div>
      )}
      {showAddProy && (
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={{...S.input,maxWidth:420}} placeholder="Project code and name (e.g. SGC0003XXX - Name)"
            value={newProy} onChange={e=>setNewProy(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleAddProy()}/>
          <button style={S.btnP} onClick={handleAddProy}>Add</button>
        </div>
      )}

      {profSel && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {([
            ["Working Days", cal.habiles.length, ""],
            ["Days Logged", diasTotal, ""],
            ["Billable Days", diasBillable, ""],
            ["Activity Rate", `${(ar*100).toFixed(0)}%`, arCol],
          ] as const).map(([l,v,c])=>(
            <div key={l} style={S.card}>
              <div style={{fontSize:10,color:"#666",marginBottom:2}}>{l}</div>
              <div style={{fontSize:18,fontWeight:500,color:c||"#111"}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {profSel && (
        <CalendarioProfesional
          prof={profSel} mesNum={mesNum} mesData={mesData}
          onToggle={handleToggle} proyectos={state.proyectos}
        />
      )}
    </div>
  );
}

// ─── TAB PROYECTOS ────────────────────────────────────────────────────────────
function TabProyectos({ state, mesNum }: { state: ImputState; mesNum: number }) {
  const cal = CALENDAR_2026[mesNum];
  const mesData = state.meses[mesNum] || { profesionales: {} };

  const proyResumen: Record<string, { profesionales: string[]; dias: number }> = {};
  for (const [prof, proyData] of Object.entries(mesData.profesionales || {})) {
    for (const [proy, dias] of Object.entries(proyData)) {
      const d = dias.filter(x => cal.habiles.includes(x)).length;
      if (d > 0) {
        if (!proyResumen[proy]) proyResumen[proy] = { profesionales: [], dias: 0 };
        proyResumen[proy].profesionales.push(prof);
        proyResumen[proy].dias += d;
      }
    }
  }

  const proyOrdenados = Object.entries(proyResumen)
    .filter(([,v])=>v.dias>0)
    .sort((a,b)=>b[1].dias-a[1].dias);

  return (
    <div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{borderBottom:"0.5px solid #ccc"}}>
              {["Project","Type","Professionals","Total Days"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"6px 8px",color:"#666",fontWeight:500}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proyOrdenados.map(([proy, data])=>{
              const col = categoriaColor(proy);
              const tipo = esBillable(proy) ? "Billable"
                : proy==="Bench" ? "Bench"
                : proy==="Vacaciones" ? "Leave"
                : "Special";
              return (
                <tr key={proy} style={{borderBottom:"0.5px solid #eee"}}>
                  <td style={{padding:"7px 8px",maxWidth:320}}>
                    <div style={{fontWeight:500,fontSize:11}}>{proy}</div>
                  </td>
                  <td style={{padding:"7px 8px"}}>
                    <span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,
                      background:col.bg,color:col.text}}>{tipo}</span>
                  </td>
                  <td style={{padding:"7px 8px",color:"#666",fontSize:11}}>
                    {data.profesionales.join(", ")}
                  </td>
                  <td style={{padding:"7px 8px",fontWeight:600}}>{data.dias}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB TABLA (vista estilo Excel) ──────────────────────────────────────────
function TabTabla({ state, mesNum }: { state: ImputState; mesNum: number }) {
  const [profFiltro, setProfFiltro] = useState("");
  const [proyFiltro, setProyFiltro] = useState("");
  const cal = CALENDAR_2026[mesNum];
  const mesData = state.meses[mesNum] || { profesionales: {} };

  // Lista única de proyectos en el mes
  const proyectosList = useMemo(() => {
    const set = new Set<string>();
    for (const proyData of Object.values(mesData.profesionales || {})) {
      for (const [proy, dias] of Object.entries(proyData)) {
        if ((dias as number[]).length > 0) set.add(proy);
      }
    }
    return Array.from(set).sort();
  }, [mesData]);

  const rows = useMemo(() => {
    const result: Array<{ prof: string; proy: string; dias: number[] }> = [];
    for (const [prof, proyData] of Object.entries(mesData.profesionales || {})) {
      if (profFiltro && prof !== profFiltro) continue;
      for (const [proy, dias] of Object.entries(proyData)) {
        if (dias.length === 0) continue;
        if (proyFiltro && proy !== proyFiltro) continue;
        result.push({ prof, proy, dias });
      }
    }
    // Ordenar por profesional, luego proyecto
    return result.sort((a, b) => a.prof.localeCompare(b.prof) || a.proy.localeCompare(b.proy));
  }, [mesData, profFiltro, proyFiltro]);

  // Calcular total de días por profesional para la celda de totales
  const totalesPorProf = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      const d = row.dias.filter(x => cal.habiles.includes(x)).length;
      map[row.prof] = (map[row.prof] || 0) + d;
    }
    return map;
  }, [rows, cal]);

  // Agrupar filas por profesional para fusionar la celda de nombre
  const rowsPorProf: Record<string, number> = {};
  for (const row of rows) rowsPorProf[row.prof] = (rowsPorProf[row.prof] || 0) + 1;
  const profVisto = new Set<string>();

  const th: React.CSSProperties = {
    background: "#1565c0", color: "#fff", fontWeight: 600,
    fontSize: 10, padding: "4px 2px", textAlign: "center",
    border: "0.5px solid #1e88e5", whiteSpace: "nowrap",
  };
  const thL: React.CSSProperties = { ...th, textAlign: "left", padding: "4px 6px" };

  return (
    <div>
      {/* Filters */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <label style={{ fontSize:12, color:"#666", whiteSpace:"nowrap" }}>Professional:</label>
          <select style={{ ...S.input, width:"auto", minWidth:180 }}
            value={profFiltro} onChange={e => setProfFiltro(e.target.value)}>
            <option value="">All ({state.profesionales.length})</option>
            {state.profesionales.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <label style={{ fontSize:12, color:"#666", whiteSpace:"nowrap" }}>Project:</label>
          <select style={{ ...S.input, width:"auto", minWidth:220 }}
            value={proyFiltro} onChange={e => setProyFiltro(e.target.value)}>
            <option value="">All ({proyectosList.length})</option>
            {proyectosList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <span style={{ fontSize:11, color:"#999" }}>{rows.length} rows · {MESES_NOMBRES[mesNum]} 2026</span>
      </div>

      <div style={{ width:"100%", fontSize:10 }}>
        <table style={{ borderCollapse:"collapse", tableLayout:"fixed", width:"100%" }}>
          <colgroup>
            <col style={{ width:"11%" }}/>
            <col style={{ width:"15%" }}/>
            {Array.from({ length: cal.dias }, (_, i) => (
              <col key={i} style={{ width:`${(74 / cal.dias).toFixed(2)}%` }}/>
            ))}
            <col style={{ width:"3.5%" }}/>
            <col style={{ width:"3%" }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={thL}>Professional</th>
              <th style={thL}>Project</th>
              {Array.from({ length: cal.dias }, (_, i) => {
                const dia = i + 1;
                const esHabil = cal.habiles.includes(dia);
                return (
                  <th key={dia} style={{ ...th, background: esHabil ? "#1565c0" : "#7b9fc5" }}>{dia}</th>
                );
              })}
              <th style={{ ...th, background:"#0d47a1", fontSize:9 }}>Days</th>
              <th style={{ ...th, background:"#0d47a1", fontSize:9 }}>hh</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cal.dias + 4} style={{ padding:"20px", textAlign:"center", color:"#999", fontSize:12 }}>
                  No entries for {MESES_NOMBRES[mesNum]} 2026
                  {profFiltro ? ` — ${profFiltro}` : ""}
                  {proyFiltro ? ` — ${proyFiltro}` : ""}
                </td>
              </tr>
            ) : rows.map((row, i) => {
              const totalDias = row.dias.filter(d => cal.habiles.includes(d)).length;
              const col = categoriaColor(row.proy);
              const esPrimeroDeProf = !profVisto.has(row.prof);
              if (esPrimeroDeProf) profVisto.add(row.prof);
              const rowCount = rowsPorProf[row.prof] || 1;
              const isLastOfProf = !rows[i + 1] || rows[i + 1].prof !== row.prof;
              const rowBg = i % 2 === 0 ? "#fff" : "#fafafa";
              const borderB = isLastOfProf ? "1.5px solid #1565c0" : "0.5px solid #e0e0e0";

              return (
                <tr key={`${row.prof}-${row.proy}`} style={{ background: rowBg }}>
                  {esPrimeroDeProf ? (
                    <td rowSpan={rowCount} style={{
                      padding:"3px 6px", fontWeight:600, fontSize:10,
                      border:"0.5px solid #e0e0e0", borderBottom: borderB,
                      background:"#fff", verticalAlign:"top", paddingTop:5,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"normal",
                      lineHeight:1.3,
                    }}>{row.prof}</td>
                  ) : null}

                  <td style={{
                    padding:"3px 6px", fontSize:9, overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap",
                    border:"0.5px solid #e0e0e0", borderBottom: borderB,
                    background: rowBg,
                  }} title={row.proy}>
                    <span style={{
                      display:"inline-block", width:6, height:6, borderRadius:1,
                      background:col.bg, marginRight:4, flexShrink:0,
                    }}/>
                    {row.proy.length > 28 ? row.proy.slice(0, 28) + "…" : row.proy}
                  </td>

                  {Array.from({ length: cal.dias }, (_, j) => {
                    const dia = j + 1;
                    const imputed = row.dias.includes(dia);
                    const esHabil = cal.habiles.includes(dia);
                    return (
                      <td key={dia} style={{
                        textAlign:"center", fontWeight: imputed ? 700 : 400,
                        fontSize:10, padding:"2px 0",
                        border:"0.5px solid #e0e0e0", borderBottom: borderB,
                        background: imputed ? col.bg : !esHabil ? "#f0f0f0" : rowBg,
                        color: imputed ? col.text : !esHabil ? "#ccc" : "inherit",
                      }}>
                        {imputed ? "8" : ""}
                      </td>
                    );
                  })}

                  <td style={{
                    textAlign:"center", fontWeight:700, fontSize:10, padding:"2px",
                    background: isLastOfProf ? "#fff3e0" : rowBg,
                    border:"0.5px solid #e0e0e0", borderBottom: borderB,
                    color: totalDias > 0 ? "#e65100" : "#ccc",
                  }}>{totalDias || ""}</td>

                  <td style={{
                    textAlign:"center", fontSize:10, padding:"2px",
                    background: rowBg, border:"0.5px solid #e0e0e0", borderBottom: borderB,
                    color:"#666",
                  }}>{totalDias ? totalDias * 8 : ""}</td>
                </tr>
              );
            })}

            {rows.length > 0 && (
              <tr style={{ background:"#e3f2fd", fontWeight:700 }}>
                <td colSpan={2} style={{
                  padding:"4px 6px", fontSize:10, fontWeight:700,
                  border:"1px solid #1565c0", color:"#1565c0", background:"#e3f2fd",
                }}>
                  Total {profFiltro || (proyFiltro ? proyFiltro : "overall")} — {MESES_NOMBRES[mesNum]}
                </td>
                {Array.from({ length: cal.dias }, (_, j) => {
                  const dia = j + 1;
                  const count = rows.filter(r => r.dias.includes(dia)).length;
                  const esHabil = cal.habiles.includes(dia);
                  return (
                    <td key={dia} style={{
                      textAlign:"center", fontSize:10, fontWeight:600,
                      border:"1px solid #1565c0",
                      background: count > 0 ? "#bbdefb" : !esHabil ? "#f0f0f0" : "#e3f2fd",
                      color: count > 0 ? "#1565c0" : "#aaa",
                    }}>{count > 0 ? count : ""}</td>
                  );
                })}
                <td style={{ textAlign:"center", fontSize:10, fontWeight:700,
                  border:"1px solid #1565c0", background:"#fff3e0", color:"#e65100" }}>
                  {rows.reduce((a, r) => a + r.dias.filter(d => cal.habiles.includes(d)).length, 0)}
                </td>
                <td style={{ textAlign:"center", fontSize:10,
                  border:"1px solid #1565c0", background:"#e3f2fd", color:"#666" }}>
                  {rows.reduce((a, r) => a + r.dias.filter(d => cal.habiles.includes(d)).length, 0) * 8}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function ImputacionesView() {
  const [state, setState] = useState<ImputState>(() => buildInitialState());
  const [mesNum, setMesNum] = useState(2);
  const [tab, setTab] = useState("resumen");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    saveToStorage(state);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const cal = CALENDAR_2026[mesNum];
  const TABS = [
    { id:"resumen",      label:"Summary" },
    { id:"imputaciones", label:"Log Time" },
    { id:"proyectos",    label:"By Project" },
    { id:"tabla",        label:"Table View" },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,fontWeight:500,color:"#666",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>
            SII Group Chile
          </div>
          <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 3px"}}>Time Logs 2026</h2>
          <p style={{fontSize:13,color:"#666",margin:0}}>
            {state.profesionales.length} professionals · {cal.habiles.length} working days in {MESES_NOMBRES[mesNum]}
            {saved && <span style={{marginLeft:8,fontSize:11,color:"#2e7d32"}}>✓ saved</span>}
          </p>
        </div>
        <button style={S.btn} onClick={()=>exportToExcel(state,mesNum)}>
          ↓ Export Excel
        </button>
      </div>

      {/* Selector de mes */}
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:20}}>
        {Array.from({length:12},(_,i)=>i+1).map(m=>{
          const mesData = state.meses[m] || { profesionales: {} };
          const tieneData = Object.values(mesData.profesionales||{})
            .some(p=>Object.values(p).some(d=>d.length>0));
          return (
            <button key={m} onClick={()=>setMesNum(m)} style={{
              padding:"5px 12px",fontSize:12,borderRadius:6,cursor:"pointer",
              border: m===mesNum ? "none" : "0.5px solid #ccc",
              background: m===mesNum ? "#111" : tieneData ? "#f0f0f0" : "transparent",
              color: m===mesNum ? "#fff" : "#111",
              fontWeight: m===mesNum ? 600 : 400,
              position:"relative",
            }}>
              {MESES_NOMBRES[m].slice(0,3)}
              {tieneData && m!==mesNum && (
                <span style={{position:"absolute",top:2,right:2,width:5,height:5,
                  borderRadius:"50%",background:"#1565c0"}}/>
              )}
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,borderBottom:"0.5px solid #e0e0e0",marginBottom:20}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"8px 18px",fontSize:13,cursor:"pointer",border:"none",background:"transparent",
            borderBottom:tab===t.id?"2px solid #111":"2px solid transparent",
            color:tab===t.id?"#111":"#666",
            fontWeight:tab===t.id?500:400,marginBottom:-1}}>{t.label}</button>
        ))}
      </div>

      {tab==="resumen"      && <TabResumen state={state} mesNum={mesNum}/>}
      {tab==="imputaciones" && <TabImputaciones state={state} mesNum={mesNum} onUpdate={setState}/>}
      {tab==="proyectos"    && <TabProyectos state={state} mesNum={mesNum}/>}
      {tab==="tabla"        && <TabTabla state={state} mesNum={mesNum}/>}
    </div>
  );
}
