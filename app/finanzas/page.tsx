"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { exportCarmoWord, type CarmoExportData } from "@/lib/carmo-export";
import { FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import ImputacionesView from "@/components/imputaciones-view";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const IFS_UF = 148;
const DIAS_MES = 20.75;
const RATIO_VAC = 1 + 1/12;
const INT_COSTOS_FNQ = 0.0141;
const COLACION_MES = 100000;

const UF_TABLE: Record<string, number> = {
  "Enero2024":36733.04,"Febrero2024":36856.5,"Marzo2024":37093.52,
  "Abril2024":37261.98,"Mayo2024":37438.91,"Junio2024":37571.86,
  "Julio2024":37578.95,"Agosto2024":37754.47,"Septiembre2024":37910.42,
  "Octubre2024":37971.42,"Noviembre2024":38247.92,"Diciembre2024":38416.69,
  "Enero2025":38384.41,"Febrero2025":38647.94,"Marzo2025":38894.11,
  "Abril2025":39075.41,"Mayo2025":39189.45,"Junio2025":39267.07,
  "Julio2025":39179.01,"Agosto2025":39383.07,"Septiembre2025":39485.65,
  "Octubre2025":39485.65,"Noviembre2025":39643.59,"Diciembre2025":39727.96,
  "Enero2026":39706.07,"Febrero2026":39790.63,"Marzo2026":39875.43,
  "Abril2026":39960.47,"Mayo2026":40045.75,"Junio2026":40131.27,
  "Julio2026":40217.03,"Agosto2026":40303.04,"Septiembre2026":40389.29,
  "Octubre2026":40475.79,"Noviembre2026":40562.53,"Diciembre2026":40649.52,
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ANIOS = [2024,2025,2026];

function getUF(mes: string, anio: number): number {
  return UF_TABLE[`${mes}${anio}`] || 39790.63;
}

// ─── LÓGICA CORE ──────────────────────────────────────────────────────────────
function costoLineaFn(costoDiario: number, tipoPeriodo: string, cantidad: number, pct: number): number {
  return tipoPeriodo === "Meses"
    ? costoDiario * DIAS_MES * cantidad * pct
    : costoDiario * cantidad * pct;
}

function tarifaMinima(costoEmpresaMes: number, margenObj: number, uf: number) {
  const costoConFnq = costoEmpresaMes * RATIO_VAC * (1 + INT_COSTOS_FNQ);
  const pvMesCLP = costoConFnq / (1 - margenObj);
  const pvMesUF  = pvMesCLP / uf;
  const pvDiaUF  = pvMesUF / DIAS_MES;
  return { costoConFnq, pvMesCLP, pvMesUF, pvDiaUF };
}

function margenReal(tarifaUFDia: number, costoEmpresaMes: number, uf: number): number {
  const costoConFnq = costoEmpresaMes * RATIO_VAC * (1 + INT_COSTOS_FNQ);
  const pvMes = tarifaUFDia * DIAS_MES * uf;
  return (pvMes - costoConFnq) / pvMes;
}

interface SemaforoColor { bg: string; text: string; label: string; }

function semaforoMargen(m: number): SemaforoColor {
  if (m >= 0.34) return { bg:"#1b5e20", text:"#fff", label:">34% – BM" };
  if (m >= 0.32) return { bg:"#388e3c", text:"#fff", label:">32% – BSM/BUM/BUD" };
  if (m >= 0.30) return { bg:"#8bc34a", text:"#1b5e20", label:">30% – BSM/BUM/BUD" };
  if (m >= 0.28) return { bg:"#fdd835", text:"#333", label:">28% – Country Manager" };
  if (m >= 0.25) return { bg:"#f44336", text:"#fff", label:">25% – Country Manager" };
  return { bg:"#111", text:"#fff", label:"<25% – Country Manager" };
}

const TABLA_VALIDADOR = [
  { label:">34% BM",              min:0.34, max:Infinity, bg:"#1b5e20", text:"#fff" },
  { label:">32% BSM/BUM/BUD",     min:0.32, max:0.34,     bg:"#388e3c", text:"#fff" },
  { label:">30% BSM/BUM/BUD",     min:0.30, max:0.32,     bg:"#8bc34a", text:"#1b5e20" },
  { label:">28% Country Manager", min:0.28, max:0.30,     bg:"#fdd835", text:"#333" },
  { label:">25% Country Manager", min:0.25, max:0.28,     bg:"#f44336", text:"#fff" },
  { label:"<25% Country Manager", min:0,    max:0.25,     bg:"#111",    text:"#fff" },
];

const TABLA_FREELANCER_DISPLAY = [
  { label:">20% BM",              min:0.20, bg:"#1b5e20", text:"#fff" },
  { label:"-",                    min:0.15, bg:"#388e3c", text:"#fff" },
  { label:"-",                    min:0.10, bg:"#8bc34a", text:"#1b5e20" },
  { label:">10% Country Manager", min:0.10, bg:"#f44336", text:"#fff" },
  { label:"<10% Country Manager", min:0,    bg:"#111",    text:"#fff" },
];

function TablaValidador({ margenActual }: { margenActual: number | null }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}}>
      <div>
        <div style={{fontSize:11,fontWeight:600,marginBottom:6,
          color:"#666",textTransform:"uppercase",letterSpacing:"0.06em"}}>
          Approver by margin level
        </div>
        {TABLA_VALIDADOR.map((row,i)=>{
          const activo = margenActual!==null &&
            margenActual >= row.min && margenActual < row.max;
          return (
            <div key={i} style={{
              padding:"5px 10px", background:row.bg, color:row.text,
              fontSize:12, fontWeight: activo?700:400,
              border: activo?"2px solid #fff":"2px solid transparent",
              outline: activo?"2px solid #1565c0":"none",
              marginBottom:1, borderRadius: i===0?"6px 6px 0 0":i===5?"0 0 6px 6px":"0",
              display:"flex", alignItems:"center", gap:8
            }}>
              {activo && <span style={{fontSize:10}}>▶</span>}
              {row.label}
            </div>
          );
        })}
      </div>
      <div>
        <div style={{fontSize:11,fontWeight:600,marginBottom:6,
          color:"#666",textTransform:"uppercase",letterSpacing:"0.06em"}}>
          Misiones solo-freelancers
        </div>
        {TABLA_FREELANCER_DISPLAY.map((row,i)=>{
          const activo = margenActual!==null &&
            margenActual >= row.min &&
            (i===TABLA_FREELANCER_DISPLAY.length-1 || margenActual < TABLA_FREELANCER_DISPLAY[i-1]?.min);
          return (
            <div key={i} style={{
              padding:"5px 10px", background:row.bg, color:row.text,
              fontSize:12, fontWeight: activo?700:400,
              border: activo?"2px solid #fff":"2px solid transparent",
              outline: activo?"2px solid #1565c0":"none",
              marginBottom:1, borderRadius: i===0?"6px 6px 0 0":i===4?"0 0 6px 6px":"0",
              display:"flex", alignItems:"center", gap:8
            }}>
              {activo && <span style={{fontSize:10}}>▶</span>}
              {row.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── COLABORADORES ────────────────────────────────────────────────────────────
interface Colaborador { rut: string; nombre: string; sueldoBase: number; costoEmpresaMes: number; costoDiario: number; }

const COLABORADORES: Colaborador[] = [
  {rut:"18.676.023-9",nombre:"Aaron Isaac Barra Araya",sueldoBase:1986000,costoEmpresaMes:2470794,costoDiario:133556},
  {rut:"19.117.401-1",nombre:"Adolfo Eduardo Lagos Varela",sueldoBase:2754000,costoEmpresaMes:3287484,costoDiario:177702},
  {rut:"19.959.139-8",nombre:"Agustin-Alonso Rivas López",sueldoBase:1627000,costoEmpresaMes:2089033,costoDiario:112921},
  {rut:"9.177.146-2",nombre:"Alba Cecilia Vega Yevenes",sueldoBase:2293546,costoEmpresaMes:2797838,costoDiario:151235},
  {rut:"16.092.751-8",nombre:"Albert Eduardo Uribe Gonzalez",sueldoBase:2529659,costoEmpresaMes:3048920,costoDiario:164807},
  {rut:"26.375.772-6",nombre:"Alberto Jose Pernalete Lameda",sueldoBase:2791624,costoEmpresaMes:3327493,costoDiario:179864},
  {rut:"17.576.566-2",nombre:"Alejandra De Lourdes Navarro Valdenegro",sueldoBase:1670000,costoEmpresaMes:2134759,costoDiario:115392},
  {rut:"10.076.694-9",nombre:"Alejandra María Chávez González",sueldoBase:2904780,costoEmpresaMes:3447824,costoDiario:186369},
  {rut:"16.516.702-3",nombre:"Alejandra Marlene Gallardo Troncoso",sueldoBase:3219000,costoEmpresaMes:3781966,costoDiario:204431},
  {rut:"13.996.421-7",nombre:"Alejandro Andrés González Aravena",sueldoBase:1554000,costoEmpresaMes:2011404,costoDiario:108724},
  {rut:"26.807.797-9",nombre:"Alejandro Enrique Sánchez Hernández",sueldoBase:3746000,costoEmpresaMes:4338141,costoDiario:234493},
  {rut:"12.269.806-8",nombre:"Alejandro Rodrigo Blanco González",sueldoBase:1434000,costoEmpresaMes:1883796,costoDiario:101827},
  {rut:"17.777.745-5",nombre:"Alex Andrés Martínez Andrade",sueldoBase:2009000,costoEmpresaMes:2495252,costoDiario:134933},
  {rut:"12.820.018-5",nombre:"Alexander Enrique Sandoval Acevedo",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"14.196.032-6",nombre:"Alexis Antonio Sepúlveda Cárdenas",sueldoBase:2264469,costoEmpresaMes:2766917,costoDiario:149563},
  {rut:"20.397.770-0",nombre:"Alexis Juan Alexander Osorio Julca",sueldoBase:556000,costoEmpresaMes:871064,costoDiario:47084},
  {rut:"20.761.634-6",nombre:"Alexis Paulino Hojas Ortiz",sueldoBase:555000,costoEmpresaMes:869734,costoDiario:47013},
  {rut:"18.220.258-4",nombre:"Alfonso Enrique Opazo Muñoz",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"10.185.255-5",nombre:"Alfredo Eduardo Sepúlveda Rivera",sueldoBase:2119305,costoEmpresaMes:2612550,costoDiario:141219},
  {rut:"25.413.844-4",nombre:"Ali Gabriel Gutierrez Piñate",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"26.332.703-9",nombre:"Alina Hung Fung",sueldoBase:1613000,costoEmpresaMes:2074145,costoDiario:112116},
  {rut:"20.467.307-1",nombre:"Aline Valentina Salomé Gallegos Fernández",sueldoBase:1471000,costoEmpresaMes:1923142,costoDiario:103954},
  {rut:"16.356.409-2",nombre:"Alvaro Alonso Fuentes D'Alencon",sueldoBase:2235000,costoEmpresaMes:2735580,costoDiario:147869},
  {rut:"16.342.049-k",nombre:"Ana Luisa Campos Guzmán",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"19.567.102-8",nombre:"Anastasia Paz Durán Jorquera",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"17.051.802-5",nombre:"Andrés Alejandro Henríquez Cortez",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"17.002.315-0",nombre:"Andrés Rodrigo Bustos Aravena",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"15.699.048-4",nombre:"Ángela Paulina Herrera Aguilar",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"17.368.498-1",nombre:"Arturo Ignacio Muñoz Concha",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"16.879.265-5",nombre:"Bastian Daniel Rozas Araya",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"17.502.398-9",nombre:"Brahin Ignacio Cassis Velez",sueldoBase:2650000,costoEmpresaMes:3176891,costoDiario:171724},
  {rut:"17.141.388-2",nombre:"Camila Alejandra Rojas Muñoz",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"19.201.553-0",nombre:"Camila Ignacia Ávila González",sueldoBase:1471000,costoEmpresaMes:1923142,costoDiario:103954},
  {rut:"21.084.965-2",nombre:"Carlos Andrés Martínez Díaz",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"15.500.994-2",nombre:"Carlos Arturo Pérez Fuentes",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"17.895.226-1",nombre:"Carlos Eduardo Núñez Cárdenas",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"14.882.330-2",nombre:"Carlos Enrique Silva Araya",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"16.706.492-3",nombre:"Carlos Roberto Morales Reyes",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"20.156.879-4",nombre:"Carola Valentina Sepúlveda Torres",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"18.543.210-7",nombre:"Carolina Andrea Muñoz Herrera",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"17.234.567-8",nombre:"Catalina Isabel Fernández Rojas",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"19.876.543-2",nombre:"Claudia Marcela Vargas Espinoza",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"16.543.210-9",nombre:"Cristian Alejandro López Díaz",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"15.678.901-3",nombre:"Cristián Eduardo Moreno González",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"17.890.123-4",nombre:"Cristobal Andrés Reyes Muñoz",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"20.234.567-1",nombre:"Daniel Alejandro Castro Herrera",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"18.901.234-5",nombre:"Daniela Andrea Fuentes Araya",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"16.789.012-6",nombre:"David Ignacio Gutiérrez Torres",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"19.012.345-7",nombre:"Diego Andrés Hernández Rojas",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"17.345.678-9",nombre:"Eduardo Alejandro Jiménez Silva",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"15.123.456-0",nombre:"Eduardo Enrique Valenzuela López",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"18.456.789-1",nombre:"Felipe Andrés Contreras Díaz",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"20.567.890-2",nombre:"Felipe Ignacio Medina González",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"16.890.123-3",nombre:"Fernando Alejandro Peña Muñoz",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"14.234.567-4",nombre:"Francisco Eduardo Ramos Herrera",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"17.567.890-5",nombre:"Francisco Javier Garcia Orellana",sueldoBase:3993000,costoEmpresaMes:4598503,costoDiario:248568},
  {rut:"19.345.678-6",nombre:"Francisca Andrea Soto Torres",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"21.456.789-7",nombre:"Gabriela Alejandra Vidal Rojas",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"15.890.123-8",nombre:"Gonzalo Eduardo Flores Silva",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"18.123.456-9",nombre:"Héctor Andrés Espinoza López",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"20.901.234-0",nombre:"Hugo Ignacio Campos Díaz",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"16.234.567-1",nombre:"Ignacio Alejandro Castillo González",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"14.567.890-2",nombre:"Isabel Cristina Morales Muñoz",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"17.678.901-3",nombre:"Javier Eduardo Rojas Herrera",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"19.234.567-4",nombre:"Jessica Andrea Navarro Torres",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"21.123.456-5",nombre:"Jorge Alejandro Pérez Rojas",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"15.456.789-6",nombre:"Jorge Luis Fuentes Silva",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"18.234.567-7",nombre:"José Andrés Gutiérrez López",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"20.678.901-8",nombre:"Juan Carlos Hernández Díaz",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"16.012.345-9",nombre:"Juan Eduardo Medina González",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"14.345.678-0",nombre:"Karla Andrea Contreras Muñoz",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"17.789.012-1",nombre:"Laura Ignacia Reyes Herrera",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"19.123.456-2",nombre:"Leonardo Alejandro Castro Torres",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"21.012.345-3",nombre:"Lorena Andrea Vidal Rojas",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"15.345.678-4",nombre:"Luis Eduardo Espinoza Silva",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"18.012.345-5",nombre:"Luis Fernando Morales López",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"20.456.789-6",nombre:"Marcela Andrea Soto Díaz",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"16.123.456-7",nombre:"Marcelo Alejandro Flores González",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"14.456.789-8",nombre:"María Cristina Campos Muñoz",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"17.901.234-9",nombre:"María José Rojas Herrera",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"19.456.789-0",nombre:"María Paula Torres Silva",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"21.234.567-1",nombre:"Mario Alejandro Navarro López",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"15.234.567-2",nombre:"Martín Eduardo Pérez Díaz",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"18.345.678-3",nombre:"Mauricio Andrés Gutiérrez González",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"20.345.678-4",nombre:"Miguel Ignacio Hernández Muñoz",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"16.456.789-5",nombre:"Mónica Andrea Medina Herrera",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"14.678.901-6",nombre:"Natalia Alejandra Contreras Torres",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"17.012.345-7",nombre:"Nicolás Alfonso Coloma Castro",sueldoBase:1545000,costoEmpresaMes:2001834,costoDiario:108207},
  {rut:"19.678.901-8",nombre:"Nicolás Alejandro Reyes Silva",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"21.345.678-9",nombre:"Orlando Andrés Castro López",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"15.567.890-0",nombre:"Pablo Eduardo Vidal Díaz",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"18.678.901-1",nombre:"Patricia Andrea Espinoza González",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"20.789.012-2",nombre:"Pedro Alejandro Morales Muñoz",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"16.567.890-3",nombre:"Rafael Ignacio Soto Herrera",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"14.789.012-4",nombre:"Ricardo Andrés Flores Torres",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"17.234.568-5",nombre:"Roberto Alejandro Campos Silva",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"19.789.012-6",nombre:"Sandra Andrea Navarro López",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"21.567.890-7",nombre:"Sebastián Eduardo Pérez Díaz",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"15.678.902-8",nombre:"Sergio Andrés Gutiérrez González",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"18.789.012-9",nombre:"Silvia Ignacia Hernández Muñoz",sueldoBase:1614000,costoEmpresaMes:2075208,costoDiario:112174},
  {rut:"20.012.345-0",nombre:"Sofía Alejandra Medina Herrera",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
  {rut:"16.678.901-1",nombre:"Valentina Andrea Contreras Torres",sueldoBase:2100000,costoEmpresaMes:2593050,costoDiario:140165},
  {rut:"14.901.234-2",nombre:"Valeria Ignacia Reyes Silva",sueldoBase:2293000,costoEmpresaMes:2797252,costoDiario:151203},
  {rut:"17.456.789-3",nombre:"Víctor Alejandro Castro López",sueldoBase:2690000,costoEmpresaMes:3219427,costoDiario:173995},
  {rut:"19.901.234-4",nombre:"Viviana Andrea Vidal Díaz",sueldoBase:1869000,costoEmpresaMes:2346376,costoDiario:126885},
  {rut:"21.678.901-5",nombre:"Waldo Eduardo Espinoza González",sueldoBase:2514000,costoEmpresaMes:3032268,costoDiario:163906},
  {rut:"16.536.622-0",nombre:"Zulema Del Rosario Mosqueira Márquez",sueldoBase:1994000,costoEmpresaMes:2479300,costoDiario:134016},
];

interface Perfil { perfil: string; liquidoRef: number; costoEmpresaMes: number; costoDiario: number; }

const PERFILES: Perfil[] = [
  {perfil:"Desarrollador- Junior (MM$1,3liq)",liquidoRef:1300000,costoEmpresaMes:1796642,costoDiario:97116},
  {perfil:"Desarrollador - Semi-Senior (MM$1,8liq)",liquidoRef:1800000,costoEmpresaMes:2472965,costoDiario:133673},
  {perfil:"Desarrollador - Senior (MM$2,3liq)",liquidoRef:2300000,costoEmpresaMes:3162048,costoDiario:170922},
  {perfil:"Desarrollador - Experto (MM$2,9liq)",liquidoRef:2900000,costoEmpresaMes:3976393,costoDiario:214940},
  {perfil:"Lider Tecnico - Semi Senior (MM$2,4liq)",liquidoRef:2400000,costoEmpresaMes:3302417,costoDiario:178509},
  {perfil:"Lider Tecnico - Senior (MM$2,7liq)",liquidoRef:2700000,costoEmpresaMes:3726714,costoDiario:201444},
  {perfil:"Lider Tecnico - Experto (MM$3,2liq)",liquidoRef:3200000,costoEmpresaMes:4322137,costoDiario:233629},
  {perfil:"QA - Junior (MM$1,2liq)",liquidoRef:1200000,costoEmpresaMes:1661591,costoDiario:89816},
  {perfil:"QA - Semi-Senior (MM$1,6liq)",liquidoRef:1600000,costoEmpresaMes:2201798,costoDiario:119016},
  {perfil:"QA - Senior (MM$1,8liq)",liquidoRef:1800000,costoEmpresaMes:2472965,costoDiario:133673},
  {perfil:"QA - Experto (MM$2,2liq)",liquidoRef:2200000,costoEmpresaMes:3020616,costoDiario:163276},
  {perfil:"UX/UI - Junior (MM$1,2liq)",liquidoRef:1200000,costoEmpresaMes:1661591,costoDiario:89816},
  {perfil:"UX/UI - Semi-Senior (MM$1,6liq)",liquidoRef:1600000,costoEmpresaMes:2201798,costoDiario:119016},
  {perfil:"UX/UI - Senior (MM$1,9liq)",liquidoRef:1900000,costoEmpresaMes:2608017,costoDiario:140974},
  {perfil:"UX/UI - Experto (MM$2,2liq)",liquidoRef:2200000,costoEmpresaMes:3020616,costoDiario:163276},
  {perfil:"Jefe de Proyectos - Junior (MM$1,4liq)",liquidoRef:1400000,costoEmpresaMes:1931694,costoDiario:104416},
  {perfil:"Jefe de Proyectos - Pleno (MM$1,8liq)",liquidoRef:1800000,costoEmpresaMes:2472965,costoDiario:133673},
  {perfil:"Jefe de Proyectos - Senior (MM$2,5liq)",liquidoRef:2500000,costoEmpresaMes:3443849,costoDiario:186154},
  {perfil:"PMO (MM$1,6liq)",liquidoRef:1600000,costoEmpresaMes:2201798,costoDiario:119016},
  {perfil:"BA/Consultor Funcional - Junior (MM$1,2liq)",liquidoRef:1200000,costoEmpresaMes:1661591,costoDiario:89816},
  {perfil:"BA/Consultor Funcional - Semi-Senior (MM$1,4liq)",liquidoRef:1400000,costoEmpresaMes:1931694,costoDiario:104416},
  {perfil:"BA/Consultor Funcional - Senior (MM$2liq)",liquidoRef:2000000,costoEmpresaMes:2743068,costoDiario:148274},
  {perfil:"PO - Junior (MM$1,6liq)",liquidoRef:1600000,costoEmpresaMes:2201798,costoDiario:119016},
  {perfil:"PO - Semi (MM$2liq)",liquidoRef:2000000,costoEmpresaMes:2743068,costoDiario:148274},
  {perfil:"PO - Senior (MM$2,4liq)",liquidoRef:2400000,costoEmpresaMes:3302417,costoDiario:178509},
  {perfil:"PO - Experto (MM$2,8liq)",liquidoRef:2800000,costoEmpresaMes:3860442,costoDiario:208673},
  {perfil:"Consultor Funcional CRM/ERP - Senior (MM$2,4liq)",liquidoRef:2400000,costoEmpresaMes:3302417,costoDiario:178509},
  {perfil:"Scrum - Junior (MM$1,5liq)",liquidoRef:1500000,costoEmpresaMes:2066746,costoDiario:111716},
  {perfil:"Scrum - Semi (MM$2liq)",liquidoRef:2000000,costoEmpresaMes:2743068,costoDiario:148274},
  {perfil:"Scrum - Senior (MM$2,4liq)",liquidoRef:2400000,costoEmpresaMes:3302417,costoDiario:178509},
  {perfil:"Consultor SAP - Junior (MM$1,8liq)",liquidoRef:1800000,costoEmpresaMes:2472965,costoDiario:133673},
  {perfil:"Consultor SAP - Semi (MM$2,3liq)",liquidoRef:2300000,costoEmpresaMes:3162048,costoDiario:170922},
  {perfil:"Consultor SAP - Senior (MM$3liq)",liquidoRef:3000000,costoEmpresaMes:4116185,costoDiario:222497},
  {perfil:"Data Engineer - Junior (MM$1,6liq)",liquidoRef:1600000,costoEmpresaMes:2201798,costoDiario:119016},
  {perfil:"Data Engineer - Senior (MM$2,5liq)",liquidoRef:2500000,costoEmpresaMes:3443849,costoDiario:186154},
  {perfil:"DevOps - Semi (MM$2liq)",liquidoRef:2000000,costoEmpresaMes:2743068,costoDiario:148274},
  {perfil:"DevOps - Senior (MM$2,5liq)",liquidoRef:2500000,costoEmpresaMes:3443849,costoDiario:186154},
  {perfil:"Arquitecto de Software (MM$3,2liq)",liquidoRef:3200000,costoEmpresaMes:4322137,costoDiario:233629},
  {perfil:"Arquitecto de Soluciones (MM$3,5liq)",liquidoRef:3500000,costoEmpresaMes:4745272,costoDiario:256501},
  {perfil:"Consultor BI - Junior (MM$1,5liq)",liquidoRef:1500000,costoEmpresaMes:2066746,costoDiario:111716},
  {perfil:"Consultor BI - Senior (MM$2,4liq)",liquidoRef:2400000,costoEmpresaMes:3302417,costoDiario:178509},
  {perfil:"Seguridad Informática - Senior (MM$2,8liq)",liquidoRef:2800000,costoEmpresaMes:3860442,costoDiario:208673},
  {perfil:"Tester Manual - Junior (MM$1,1liq)",liquidoRef:1100000,costoEmpresaMes:1526539,costoDiario:82516},
  {perfil:"Tester Automatizador - Senior (MM$2liq)",liquidoRef:2000000,costoEmpresaMes:2743068,costoDiario:148274},
  {perfil:"Analista Programador - Senior (MM$2,2liq)",liquidoRef:2200000,costoEmpresaMes:3020616,costoDiario:163276},
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmt    = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtUF  = (n: number) => Number(n).toFixed(2);
const fmtPct = (n: number) => (n*100).toFixed(1)+"%";

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const S = {
  label:  {display:"block" as const,fontSize:11,color:"#666",marginBottom:4},
  input:  {width:"100%",boxSizing:"border-box" as const,padding:"8px 10px",fontSize:13,borderRadius:6,
           border:"0.5px solid #ccc",background:"#fff",color:"#111"},
  btn:    {padding:"6px 12px",fontSize:12,borderRadius:6,cursor:"pointer" as const,
           border:"0.5px solid #ccc",background:"transparent",color:"#111"},
  btnA:   {background:"#e3f2fd",borderColor:"#1565c0",color:"#1565c0"},
  btnD:   {padding:"6px 10px",fontSize:12,borderRadius:6,cursor:"pointer" as const,
           border:"0.5px solid #ef9a9a",background:"transparent",color:"#c62828"},
  sec:    {fontSize:11,fontWeight:500,color:"#666",
           textTransform:"uppercase" as const,letterSpacing:"0.08em",
           borderBottom:"0.5px solid #e0e0e0",
           paddingBottom:6,marginBottom:14,marginTop:20},
  card:   {background:"#f5f5f5",borderRadius:8,padding:"12px 16px"},
};

const MC = ({label,value,sub}: {label:string;value:string;sub?:string}) => (
  <div style={S.card}>
    <div style={{fontSize:11,color:"#666",marginBottom:3}}>{label}</div>
    <div style={{fontSize:20,fontWeight:500}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:"#666",marginTop:2}}>{sub}</div>}
  </div>
);

const Badge = ({color,children}: {color:SemaforoColor;children:React.ReactNode}) => (
  <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,
    fontSize:11,fontWeight:600,background:color.bg,color:color.text}}>{children}</span>
);

const Sec = ({children}: {children:React.ReactNode}) => <div style={S.sec}>{children}</div>;

// ─── TAB CARMO INDIVIDUAL ─────────────────────────────────────────────────────
function TabCaRMO({ onDataChange }: { onDataChange?: (d: CarmoExportData | null) => void }) {
  const [mes,setMes]=useState("Marzo"); const [anio,setAnio]=useState(2026);
  const [tipo,setTipo]=useState("colaborador");
  const [rutSel,setRutSel]=useState(""); const [perfilSel,setPerfilSel]=useState("");
  const [liqManual,setLiqManual]=useState(2000000);
  const [margenObj,setMargenObj]=useState(0.34);
  const [tarifaNeg,setTarifaNeg]=useState("");
  const [busq,setBusq]=useState("");

  const uf = getUF(mes,anio);

  const costoEmpresaMes = useMemo(()=>{
    if(tipo==="colaborador"&&rutSel){const c=COLABORADORES.find(x=>x.rut===rutSel);return c?c.costoEmpresaMes:0;}
    if(tipo==="perfil"&&perfilSel){const p=PERFILES.find(x=>x.perfil===perfilSel);return p?p.costoEmpresaMes:0;}
    if(tipo==="manual"){const b=parseFloat(String(liqManual))||0;return Math.round((b/0.815)*1.285+COLACION_MES);}
    return 0;
  },[tipo,rutSel,perfilSel,liqManual]);

  const result = useMemo(()=>costoEmpresaMes?tarifaMinima(costoEmpresaMes,margenObj,uf):null,[costoEmpresaMes,margenObj,uf]);
  const mgnNeg = useMemo(()=>{const tf=parseFloat(tarifaNeg);return tf&&costoEmpresaMes?margenReal(tf,costoEmpresaMes,uf):null;},[tarifaNeg,costoEmpresaMes,uf]);

  useEffect(()=>{
    if (!onDataChange) return;
    if (!result || !costoEmpresaMes) { onDataChange(null); return; }
    const colab = COLABORADORES.find(c=>c.rut===rutSel);
    const perfil = PERFILES.find(p=>p.perfil===perfilSel);
    const nombreRecurso = tipo==="colaborador"
      ? (colab?.nombre ?? "")
      : tipo==="perfil" ? (perfil?.perfil ?? "") : `Manual ($${fmt(liqManual)} liq.)`;
    const tipoLabel = tipo==="colaborador" ? "Colaborador SII" : tipo==="perfil" ? "Perfil genérico" : "Manual";
    const sm = semaforoMargen(margenObj);
    const smNeg = mgnNeg !== null ? semaforoMargen(mgnNeg) : null;
    const badgeColor = (bg: string) => bg === "#1b5e20" || bg === "#388e3c" ? "green" : bg === "#8bc34a" || bg === "#fdd835" ? "amber" : bg === "#f44336" ? "red" : "black";
    const sections = [
      {
        title: "Parámetros",
        rows: [
          { label: "Mes / Año", value: `${mes} ${anio}` },
          { label: "Valor UF", value: `$${fmt(uf)}` },
          { label: "Tipo de recurso", value: tipoLabel },
          { label: "Recurso", value: nombreRecurso || "—" },
          { label: "Costo empresa / mes", value: `$${fmt(costoEmpresaMes)}` },
          { label: "Costo c/ vac.+fnq", value: `$${fmt(result.costoConFnq)}` },
          { label: "Margen objetivo", value: fmtPct(margenObj) },
        ],
      },
      {
        title: "Resultado CaRMO",
        badge: { label: sm.label, color: badgeColor(sm.bg) },
        rows: [
          { label: "Tarifa mínima día", value: `UF ${fmtUF(result.pvDiaUF)}  ·  $${fmt(result.pvDiaUF*uf)}/día`, bold: true },
          { label: "Tarifa mínima mes", value: `UF ${fmtUF(result.pvMesUF)}  ·  $${fmt(result.pvMesCLP)}`, bold: true },
        ],
      },
      ...(mgnNeg !== null && smNeg ? [{
        title: "Tarifa negociada",
        badge: { label: smNeg.label, color: badgeColor(smNeg.bg) },
        rows: [
          { label: "Tarifa acordada (UF/día)", value: `UF ${tarifaNeg}` },
          { label: "Margen real obtenido", value: fmtPct(mgnNeg), bold: true },
        ],
      }] : []),
      {
        title: "Tabla de responsables validadores",
        table: {
          headers: ["Rango margen", "Responsable"],
          rows: TABLA_VALIDADOR.map(r => [r.label.split("–")[0]?.trim() ?? r.label, r.label.split("–")[1]?.trim() ?? "—"]),
        },
      },
    ];
    onDataChange({ tab: "carmo", tabLabel: "CaRMO Individual", fecha: new Date().toLocaleDateString("es-CL", { day:"2-digit", month:"long", year:"numeric" }), sections });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[result, mgnNeg, mes, anio, uf, tipo, rutSel, perfilSel, liqManual, margenObj, tarifaNeg]);

  const filtColabs = useMemo(()=>busq.length<2?[]:COLABORADORES.filter(c=>
    c.nombre.toLowerCase().includes(busq.toLowerCase())||c.rut.includes(busq)).slice(0,8),[busq]);

  const colab = COLABORADORES.find(c=>c.rut===rutSel);
  const mc = result?semaforoMargen(margenObj):null;
  const mcN = mgnNeg!==null?semaforoMargen(mgnNeg):null;

  return (
    <div>
      <Sec>Mes de referencia UF</Sec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={S.label}>Mes inicio contrato</label>
          <select style={S.input} value={mes} onChange={e=>setMes(e.target.value)}>
            {MESES.map(m=><option key={m}>{m}</option>)}</select></div>
        <div><label style={S.label}>Año</label>
          <select style={S.input} value={anio} onChange={e=>setAnio(+e.target.value)}>
            {ANIOS.map(a=><option key={a}>{a}</option>)}</select></div>
      </div>
      <div style={{fontSize:12,color:"#666",marginTop:6}}>
        UF {mes} {anio}: <strong>${fmt(uf)}</strong>
      </div>

      <Sec>Recurso</Sec>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {([["colaborador","Colaborador SII"],["perfil","Perfil Genérico"],["manual","Manual"]] as const).map(([v,l])=>(
          <button key={v} onClick={()=>{setTipo(v);setRutSel("");setPerfilSel("");setBusq("");}}
            style={{...S.btn,...(tipo===v?S.btnA:{})}}>{l}</button>
        ))}
      </div>

      {tipo==="colaborador"&&(
        <div style={{position:"relative"}}>
          <label style={S.label}>Buscar colaborador (nombre o RUT)</label>
          <input style={S.input} placeholder="Ej: Bastian Rozas o 16.879..."
            value={colab?colab.nombre:busq}
            onChange={e=>{setBusq(e.target.value);setRutSel("");}}/>
          {filtColabs.length>0&&!rutSel&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:100,
              background:"#fff",border:"0.5px solid #ccc",borderRadius:8,maxHeight:240,overflowY:"auto"}}>
              {filtColabs.map(c=>(
                <div key={c.rut} onClick={()=>{setRutSel(c.rut);setBusq("");}}
                  style={{padding:"10px 14px",cursor:"pointer",borderBottom:"0.5px solid #eee"}}>
                  <div style={{fontSize:13,fontWeight:500}}>{c.nombre}</div>
                  <div style={{fontSize:11,color:"#666"}}>
                    {c.rut} · CE/mes: ${fmt(c.costoEmpresaMes)} · Diario IFS: ${fmt(c.costoDiario)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {colab&&<button onClick={()=>{setRutSel("");setBusq("");}}
            style={{fontSize:11,color:"#c62828",background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>✕ Limpiar</button>}
        </div>
      )}

      {tipo==="perfil"&&(
        <div><label style={S.label}>Perfil genérico</label>
          <select style={S.input} value={perfilSel} onChange={e=>setPerfilSel(e.target.value)}>
            <option value="">-- Seleccionar perfil --</option>
            {PERFILES.map(p=><option key={p.perfil} value={p.perfil}>{p.perfil}</option>)}
          </select></div>
      )}

      {tipo==="manual"&&(
        <div><label style={S.label}>Líquido mensual acordado (CLP)</label>
          <input style={S.input} type="number" step="50000"
            value={liqManual} onChange={e=>setLiqManual(+e.target.value)}/>
          <div style={{fontSize:11,color:"#666",marginTop:4}}>
            CE estimado: ${fmt(costoEmpresaMes)}</div></div>
      )}

      <Sec>Margen objetivo</Sec>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {[0.34,0.32,0.30,0.28,0.25,0.20].map(m=>{
          const col=semaforoMargen(m);
          return <button key={m} onClick={()=>setMargenObj(m)}
            style={{...S.btn,...(margenObj===m?{background:col.bg,borderColor:col.text,color:col.text,fontWeight:600}:{})}}>{fmtPct(m)}</button>;
        })}
      </div>

      {result&&costoEmpresaMes>0&&mc&&(
        <>
          <Sec>Resultado CaRMO</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <MC label="Costo empresa / mes" value={`$${fmt(costoEmpresaMes)}`}/>
            <MC label="Costo c/ vac.+fnq" value={`$${fmt(result.costoConFnq)}`}
              sub={`ratio ${((RATIO_VAC*(1+INT_COSTOS_FNQ)-1)*100).toFixed(1)}%`}/>
            <MC label="Tarifa mínima día" value={`UF ${fmtUF(result.pvDiaUF)}`}
              sub={`$${fmt(result.pvDiaUF*uf)}/día`}/>
            <MC label="Tarifa mínima mes" value={`UF ${fmtUF(result.pvMesUF)}`}
              sub={`$${fmt(result.pvMesCLP)}`}/>
          </div>
          <div style={{background:mc.bg,borderRadius:8,padding:"10px 14px",marginBottom:16,
            display:"flex",alignItems:"center",gap:10}}>
            <Badge color={mc}>{mc.label}</Badge>
            <span style={{fontSize:13,color:mc.text}}>
              Margen {fmtPct(margenObj)} · mínimo <strong>UF {fmtUF(result.pvDiaUF)}/día</strong>
            </span>
          </div>

          <Sec>Verificar tarifa negociada</Sec>
          <div><label style={S.label}>Tarifa acordada con cliente (UF/día)</label>
            <input style={{...S.input,maxWidth:200}} type="number" step="0.5"
              placeholder={`Mín: ${fmtUF(result.pvDiaUF)}`}
              value={tarifaNeg} onChange={e=>setTarifaNeg(e.target.value)}/></div>
          {mcN&&mgnNeg!==null&&(
            <div style={{marginTop:10,background:mcN.bg,borderRadius:8,
              padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <Badge color={mcN}>{mcN.label}</Badge>
              <span style={{fontSize:13,color:mcN.text}}>
                Margen real: <strong>{fmtPct(mgnNeg)}</strong>
              </span>
            </div>
          )}

          <TablaValidador margenActual={mgnNeg!==null ? mgnNeg : margenObj} />
        </>
      )}
    </div>
  );
}

// ─── TAB PRICING PROYECTO ─────────────────────────────────────────────────────
interface LineaRecurso {
  id: number;
  tipo: string;
  nombre: string;
  rut: string;
  costoDiario: number;
  costoEmpresaMes: number;
  tipoPeriodo: string;
  cantidad: number;
  pct: number;
  busq: string;
}

interface OtroCosto { id: number; desc: string; meses: number; costoMes: number; }

function LineaPricing({linea,upL,rmL}: {linea:LineaRecurso;upL:(id:number,f:string,v:string|number)=>void;rmL:(id:number)=>void}) {
  const filtColabs = useMemo(()=>linea.busq.length<2?[]:COLABORADORES.filter(c=>
    c.nombre.toLowerCase().includes(linea.busq.toLowerCase())||c.rut.includes(linea.busq)).slice(0,7),[linea.busq]);

  const costoLinea = linea.costoDiario
    ? costoLineaFn(linea.costoDiario,linea.tipoPeriodo,linea.cantidad,linea.pct) : 0;

  return (
    <div style={{border:"0.5px solid #e0e0e0",borderRadius:8,padding:10}}>
      <div style={{display:"grid",gridTemplateColumns:"2.5fr 90px 80px 90px 36px",gap:8,alignItems:"end"}}>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",gap:4,marginBottom:4}}>
            {([["colaborador","Colab."],["perfil","Perfil"],["freelance","Honorarios"]] as const).map(([v,l])=>(
              <button key={v} onClick={()=>upL(linea.id,"tipo",v)}
                style={{fontSize:10,padding:"2px 6px",borderRadius:4,border:"0.5px solid",cursor:"pointer",
                  background:linea.tipo===v?"#e3f2fd":"transparent",
                  borderColor:linea.tipo===v?"#1565c0":"#ccc",
                  color:linea.tipo===v?"#1565c0":"#666"}}>{l}</button>
            ))}
          </div>

          {linea.tipo==="colaborador"&&(
            <>
              <input style={{...S.input,fontSize:12}} placeholder="Buscar por nombre o RUT..."
                value={linea.rut?linea.nombre:linea.busq}
                onChange={e=>{upL(linea.id,"busq",e.target.value);upL(linea.id,"rut","");
                  upL(linea.id,"nombre","");upL(linea.id,"costoDiario",0);upL(linea.id,"costoEmpresaMes",0);}}/>
              {filtColabs.length>0&&!linea.rut&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,
                  background:"#fff",border:"0.5px solid #ccc",borderRadius:8,maxHeight:200,overflowY:"auto"}}>
                  {filtColabs.map(c=>(
                    <div key={c.rut} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,
                      borderBottom:"0.5px solid #eee"}}
                      onClick={()=>{
                        upL(linea.id,"rut",c.rut);upL(linea.id,"nombre",c.nombre);
                        upL(linea.id,"costoDiario",c.costoDiario);
                        upL(linea.id,"costoEmpresaMes",c.costoEmpresaMes);
                        upL(linea.id,"busq","");
                      }}>
                      <div style={{fontWeight:500}}>{c.nombre}</div>
                      <div style={{fontSize:10,color:"#666"}}>
                        Diario IFS: ${fmt(c.costoDiario)} · CE/mes: ${fmt(c.costoEmpresaMes)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {linea.tipo==="perfil"&&(
            <select style={{...S.input,fontSize:12}} value={linea.nombre}
              onChange={e=>{const p=PERFILES.find(x=>x.perfil===e.target.value);
                upL(linea.id,"nombre",e.target.value);
                upL(linea.id,"costoDiario",p?p.costoDiario:0);
                upL(linea.id,"costoEmpresaMes",p?p.costoEmpresaMes:0);}}>
              <option value="">-- Perfil --</option>
              {PERFILES.map(p=><option key={p.perfil} value={p.perfil}>{p.perfil}</option>)}
            </select>
          )}

          {linea.tipo==="freelance"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <input style={{...S.input,fontSize:12}} placeholder="Nombre"
                value={linea.nombre} onChange={e=>upL(linea.id,"nombre",e.target.value)}/>
              <input style={{...S.input,fontSize:12}} type="number" step="50000"
                placeholder="Líquido/mes"
                onChange={e=>{
                  const liq=parseFloat(e.target.value)||0;
                  upL(linea.id,"costoDiario",Math.round(liq*1.145/DIAS_MES));
                  upL(linea.id,"costoEmpresaMes",Math.round(liq*1.145));
                }}/>
            </div>
          )}
        </div>

        <div><label style={{...S.label,fontSize:10}}>Periodo</label>
          <select style={{...S.input,fontSize:12}} value={linea.tipoPeriodo}
            onChange={e=>upL(linea.id,"tipoPeriodo",e.target.value)}>
            <option>Meses</option><option>Días</option></select></div>

        <div><label style={{...S.label,fontSize:10}}>Cant.</label>
          <input style={{...S.input,fontSize:12}} type="number" min="0.5" step="0.5"
            value={linea.cantidad} onChange={e=>upL(linea.id,"cantidad",+e.target.value)}/></div>

        <div><label style={{...S.label,fontSize:10}}>% Asig.</label>
          <select style={{...S.input,fontSize:12}} value={linea.pct}
            onChange={e=>upL(linea.id,"pct",+e.target.value)}>
            {[1,0.75,0.5,0.25].map(p=><option key={p} value={p}>{p*100}%</option>)}
          </select></div>

        <button onClick={()=>rmL(linea.id)} style={{...S.btnD,alignSelf:"end"}}>✕</button>
      </div>

      {costoLinea>0&&(
        <div style={{marginTop:6,fontSize:11,color:"#666"}}>
          Costo línea: <strong>${fmt(costoLinea)}</strong>
          {linea.costoDiario>0&&<span style={{marginLeft:8}}>· Diario: ${fmt(linea.costoDiario)}</span>}
        </div>
      )}
    </div>
  );
}

function TabPricing({ onDataChange }: { onDataChange?: (d: CarmoExportData | null) => void }) {
  const [proyecto,setProyecto]=useState(""); const [cliente,setCliente]=useState("");
  const [mes,setMes]=useState("Marzo"); const [anio,setAnio]=useState(2026);
  const [mesesProy,setMesesProy]=useState(1);
  const [margenObj,setMargenObj]=useState(0.34);
  const [lineas,setLineas]=useState<LineaRecurso[]>([
    {id:1,tipo:"colaborador",nombre:"",rut:"",costoDiario:0,
     costoEmpresaMes:0,tipoPeriodo:"Meses",cantidad:1,pct:1,busq:""}
  ]);
  const [otros,setOtros]=useState<OtroCosto[]>([]);
  const [tarifaNeg,setTarifaNeg]=useState("");

  const uf=getUF(mes,anio);
  const addL=()=>setLineas(l=>[...l,{id:Date.now(),tipo:"colaborador",nombre:"",rut:"",
    costoDiario:0,costoEmpresaMes:0,tipoPeriodo:"Meses",cantidad:1,pct:1,busq:""}]);
  const rmL=(id:number)=>setLineas(l=>l.filter(x=>x.id!==id));
  const upL=(id:number,f:string,v:string|number)=>setLineas(l=>l.map(x=>x.id===id?{...x,[f]:v}:x));
  const addO=()=>setOtros(o=>[...o,{id:Date.now(),desc:"",meses:1,costoMes:0}]);
  const rmO=(id:number)=>setOtros(o=>o.filter(x=>x.id!==id));
  const upO=(id:number,f:string,v:string|number)=>setOtros(o=>o.map(x=>x.id===id?{...x,[f]:v}:x));

  const costoRec = useMemo(()=>lineas.reduce((a,l)=>
    a+(l.costoDiario?costoLineaFn(l.costoDiario,l.tipoPeriodo,l.cantidad,l.pct):0),0),[lineas]);
  const costoOtros = useMemo(()=>otros.reduce((a,o)=>a+(parseFloat(String(o.costoMes))||0)*(parseFloat(String(o.meses))||0),0),[otros]);
  const costoTotal = costoRec+costoOtros;
  const pvCLP = costoTotal>0&&margenObj<1 ? costoTotal/(1-margenObj) : 0;
  const pvUF  = pvCLP/uf;
  const pvMesUF = mesesProy>0 ? pvUF/mesesProy : 0;
  const mc = semaforoMargen(margenObj);
  const tarifaNegUF = parseFloat(tarifaNeg)||0;
  const margenNeg = tarifaNegUF>0&&costoTotal>0
    ? (tarifaNegUF*uf - costoTotal)/(tarifaNegUF*uf) : null;
  const mcNeg = margenNeg!==null ? semaforoMargen(margenNeg) : null;

  useEffect(()=>{
    if (!onDataChange) return;
    if (costoTotal <= 0) { onDataChange(null); return; }
    const badgeColor = (bg: string) => bg === "#1b5e20" || bg === "#388e3c" ? "green" : bg === "#8bc34a" || bg === "#fdd835" ? "amber" : bg === "#f44336" ? "red" : "black";
    const sections = [
      {
        title: "Datos del proyecto",
        rows: [
          { label: "Proyecto", value: proyecto || "—" },
          { label: "Cliente", value: cliente || "—" },
          { label: "Mes inicio / Año", value: `${mes} ${anio}` },
          { label: "Duración", value: `${mesesProy} mes(es)` },
          { label: "Margen objetivo", value: fmtPct(margenObj) },
          { label: "UF referencia", value: `$${fmt(uf)}` },
        ],
      },
      {
        title: "Recursos",
        table: {
          headers: ["Recurso", "Tipo", "Periodo", "Cant.", "% Asig.", "Costo línea"],
          rows: lineas.filter(l=>l.costoDiario>0).map(l=>[
            l.nombre||"—", l.tipo,
            l.tipoPeriodo, String(l.cantidad), `${l.pct*100}%`,
            `$${fmt(costoLineaFn(l.costoDiario,l.tipoPeriodo,l.cantidad,l.pct))}`,
          ]),
        },
      },
      ...(otros.length > 0 ? [{
        title: "Otros costos",
        table: {
          headers: ["Descripción", "Meses", "Costo/mes", "Total"],
          rows: otros.map(o=>[o.desc||"—", String(o.meses), `$${fmt(o.costoMes)}`, `$${fmt((o.costoMes||0)*(o.meses||0))}`]),
        },
      }] : []),
      {
        title: "Resumen financiero",
        badge: { label: mc.label, color: badgeColor(mc.bg) },
        rows: [
          { label: "Costo recursos", value: `$${fmt(costoRec)}` },
          { label: "Otros costos", value: `$${fmt(costoOtros)}` },
          { label: "Costo total", value: `$${fmt(costoTotal)}`, bold: true },
          { label: `Margen ${fmtPct(margenObj)}`, value: `$${fmt(pvCLP - costoTotal)}` },
          { label: "Tarifa total neta", value: `UF ${fmtUF(pvUF)}  ·  $${fmt(pvCLP)}`, bold: true },
          { label: "Tarifa mensual neta", value: `UF ${fmtUF(pvMesUF)}  (c/IVA: UF ${fmtUF(pvMesUF*1.19)})`, bold: true },
        ],
      },
      ...(margenNeg !== null && mcNeg ? [{
        title: "Tarifa negociada",
        badge: { label: mcNeg.label, color: badgeColor(mcNeg.bg) },
        rows: [
          { label: "Tarifa ingresada (UF total)", value: `UF ${tarifaNeg}` },
          { label: "Margen real obtenido", value: fmtPct(margenNeg), bold: true },
        ],
      }] : []),
    ];
    onDataChange({
      tab: "pricing", tabLabel: "Pricing Proyecto",
      titulo: proyecto ? `${proyecto}${cliente ? ` · ${cliente}` : ""}` : undefined,
      fecha: new Date().toLocaleDateString("es-CL", { day:"2-digit", month:"long", year:"numeric" }),
      sections,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[costoTotal, pvUF, pvMesUF, margenNeg, proyecto, cliente, mes, anio, mesesProy, margenObj]);

  return (
    <div>
      <Sec>Datos del proyecto</Sec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={S.label}>Nombre proyecto</label>
          <input style={S.input} value={proyecto} onChange={e=>setProyecto(e.target.value)}
            placeholder="Ej: Elecnor – Migración"/></div>
        <div><label style={S.label}>Cliente</label>
          <input style={S.input} value={cliente} onChange={e=>setCliente(e.target.value)}
            placeholder="Ej: Elecnor Chile"/></div>
        <div><label style={S.label}>Mes inicio servicio</label>
          <select style={S.input} value={mes} onChange={e=>setMes(e.target.value)}>
            {MESES.map(m=><option key={m}>{m}</option>)}</select></div>
        <div><label style={S.label}>Año</label>
          <select style={S.input} value={anio} onChange={e=>setAnio(+e.target.value)}>
            {ANIOS.map(a=><option key={a}>{a}</option>)}</select></div>
        <div><label style={S.label}>Duración (meses)</label>
          <input style={S.input} type="number" min="1" value={mesesProy}
            onChange={e=>setMesesProy(+e.target.value)}/></div>
        <div><label style={S.label}>Margen objetivo</label>
          <select style={S.input} value={margenObj} onChange={e=>setMargenObj(+e.target.value)}>
            {[0.34,0.32,0.30,0.28,0.25,0.20].map(m=>(
              <option key={m} value={m}>{fmtPct(m)} {m<0.25?"⛔":m<0.30?"⚠️":m<0.34?"~":"✓"}</option>
            ))}</select></div>
      </div>
      <div style={{fontSize:12,color:"#666",marginTop:6}}>
        UF {mes} {anio}: <strong>${fmt(uf)}</strong>
      </div>

      <Sec>(1a) Colaboradores SII Group Chile</Sec>
      <div style={{display:"grid",gap:8}}>
        <div style={{display:"grid",gridTemplateColumns:"2.5fr 90px 80px 90px 36px",gap:8,
          fontSize:10,color:"#666",padding:"0 2px"}}>
          <span>Colaborador</span><span>Periodo</span><span>Cant.</span><span>% Asig.</span><span/>
        </div>
        {lineas.map(l=><LineaPricing key={l.id} linea={l} upL={upL} rmL={rmL}/>)}
      </div>
      <button onClick={addL} style={{...S.btn,fontSize:12,marginTop:8}}>+ Agregar recurso</button>

      <Sec>(2) Otros costos</Sec>
      {otros.map(o=>(
        <div key={o.id} style={{display:"grid",gridTemplateColumns:"2fr 80px 1fr 36px",gap:8,alignItems:"end",marginBottom:8}}>
          <div><label style={S.label}>Descripción</label>
            <input style={S.input} value={o.desc} onChange={e=>upO(o.id,"desc",e.target.value)} placeholder="Claude, AWS…"/></div>
          <div><label style={S.label}>Meses</label>
            <input style={S.input} type="number" min="1" value={o.meses} onChange={e=>upO(o.id,"meses",+e.target.value)}/></div>
          <div><label style={S.label}>Costo/mes (CLP)</label>
            <input style={S.input} type="number" step="10000" value={o.costoMes} onChange={e=>upO(o.id,"costoMes",+e.target.value)}/></div>
          <button onClick={()=>rmO(o.id)} style={{...S.btnD,alignSelf:"end"}}>✕</button>
        </div>
      ))}
      <button onClick={addO} style={{...S.btn,fontSize:12}}>+ Agregar costo</button>

      {costoTotal>0&&(
        <>
          <Sec>Resumen financiero</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <MC label="Costo total (1)+(2)" value={`$${fmt(costoTotal)}`}
              sub={`Recursos: $${fmt(costoRec)} · Otros: $${fmt(costoOtros)}`}/>
            <MC label="Margen objetivo" value={fmtPct(margenObj)}
              sub={`Margen = (PV - Costo) / PV`}/>
            <MC label="Tarifa total neta (UF)" value={`UF ${fmtUF(pvUF)}`}
              sub={`$${fmt(pvCLP)}`}/>
            <MC label="Tarifa mensual neta" value={`UF ${fmtUF(pvMesUF)}`}
              sub={`con IVA: UF ${fmtUF(pvMesUF*1.19)} · ${mesesProy} mes(es)`}/>
          </div>
          <div style={{background:mc.bg,borderRadius:8,padding:"12px 16px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <Badge color={mc}>{mc.label}</Badge>
              <span style={{fontSize:14,fontWeight:500,color:mc.text}}>Margen objetivo {fmtPct(margenObj)}</span>
            </div>
            <div style={{fontSize:13,color:mc.text}}>
              Tarifa proyecto: <strong>UF {fmtUF(pvUF)} neto</strong> · <strong>UF {fmtUF(pvUF*1.19)} con IVA</strong>
            </div>
            {margenObj<0.25&&<div style={{fontSize:12,fontWeight:700,color:"#b71c1c",marginTop:6}}>
              ⛔ PROHIBIDO – GM &lt;25%: acción inmediata
            </div>}
          </div>
          <div style={{fontSize:12,borderTop:"0.5px solid #e0e0e0",paddingTop:10}}>
            {[
              ["Costo recursos",costoRec],
              ["Otros costos",costoOtros],
              [`Margen ${fmtPct(margenObj)}`,pvCLP-costoTotal],
            ].map(([l,v])=>(
              <div key={String(l)} style={{display:"flex",justifyContent:"space-between",
                marginBottom:3,color:"#666"}}>
                <span>{l}</span><span>${fmt(Number(v))}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:600,
              borderTop:"0.5px solid #e0e0e0",paddingTop:4,marginTop:4}}>
              <span>PV total neto</span><span>UF {fmtUF(pvUF)} / ${fmt(pvCLP)}</span>
            </div>
          </div>

          <Sec>Calculadora Margen</Sec>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"start"}}>
            <div>
              <label style={S.label}>Ingresar tarifa manual (UF total)</label>
              <input style={{...S.input,maxWidth:200}} type="number" step="1"
                placeholder={`Sugerida: ${fmtUF(pvUF)}`}
                value={tarifaNeg} onChange={e=>setTarifaNeg(e.target.value)}/>
              {tarifaNegUF>0&&<div style={{fontSize:11,color:"#666",marginTop:4}}>
                Tarifa (CLP): ${fmt(tarifaNegUF*uf)}
              </div>}
            </div>
            {mcNeg&&margenNeg!==null&&(
              <div style={{background:mcNeg.bg,borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:11,color:mcNeg.text,marginBottom:4}}>Margen obtenido</div>
                <div style={{fontSize:22,fontWeight:600,color:mcNeg.text}}>{fmtPct(margenNeg)}</div>
                <Badge color={mcNeg}>{mcNeg.label}</Badge>
                {margenNeg<0.25&&<div style={{fontSize:11,fontWeight:700,color:"#b71c1c",marginTop:4}}>
                  ⛔ Margen &lt;25%: debe aprobación Country Manager
                </div>}
              </div>
            )}
          </div>

          <TablaValidador margenActual={margenNeg!==null ? margenNeg : margenObj} />
        </>
      )}
    </div>
  );
}

// ─── TAB ESCENARIOS ───────────────────────────────────────────────────────────
function TabEscenarios({ onDataChange }: { onDataChange?: (d: CarmoExportData | null) => void }) {
  const [mes,setMes]=useState("Marzo"); const [anio,setAnio]=useState(2026);
  const [liqMin,setLiqMin]=useState(900000); const [liqMax,setLiqMax]=useState(3500000);
  const [paso,setPaso]=useState(200000); const [margenF,setMargenF]=useState(0.34);
  const uf=getUF(mes,anio);

  const estimarCE=(liq: number)=>{ const b=liq/0.815; return Math.round(b*(1+0.0093+0.024+0.0301)+COLACION_MES); };

  const escenarios=useMemo(()=>{
    const rows: Array<{liquido:number;ce:number;costoConFnq:number;pvMesCLP:number;pvMesUF:number;pvDiaUF:number}>=[];
    let l=parseFloat(String(liqMin))||900000;
    const max=parseFloat(String(liqMax))||3500000, p=parseFloat(String(paso))||200000;
    while(l<=max&&rows.length<60){
      const ce=estimarCE(l);const r=tarifaMinima(ce,margenF,uf);
      rows.push({liquido:l,ce,...r});l+=p;}
    return rows;
  },[liqMin,liqMax,paso,margenF,uf]);

  const mc=semaforoMargen(margenF);

  useEffect(()=>{
    if (!onDataChange || escenarios.length === 0) { onDataChange?.(null); return; }
    onDataChange({
      tab: "escenarios", tabLabel: "Simulador de Escenarios",
      fecha: new Date().toLocaleDateString("es-CL", { day:"2-digit", month:"long", year:"numeric" }),
      sections: [
        {
          title: "Configuración",
          rows: [
            { label: "Mes / Año", value: `${mes} ${anio}` },
            { label: "UF referencia", value: `$${fmt(uf)}` },
            { label: "Margen fijo", value: fmtPct(margenF) },
            { label: "Rango liquidez", value: `$${fmt(liqMin)} – $${fmt(liqMax)}` },
            { label: "Paso", value: `$${fmt(paso)}` },
            { label: "Filas generadas", value: String(escenarios.length) },
          ],
        },
        {
          title: "Tabla de escenarios",
          table: {
            headers: ["Líquido", "CE/mes", "CE c/vac+fnq", "Tarifa día (UF)", "Tarifa mes (UF)", "PV mes (CLP)"],
            rows: escenarios.map(e=>[`$${fmt(e.liquido)}`,`$${fmt(e.ce)}`,`$${fmt(e.costoConFnq)}`,fmtUF(e.pvDiaUF),fmtUF(e.pvMesUF),`$${fmt(e.pvMesCLP)}`]),
          },
        },
      ],
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[escenarios, mes, anio, margenF]);

  return (
    <div>
      <Sec>Configuración</Sec>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
        <div><label style={S.label}>Mes UF</label>
          <select style={S.input} value={mes} onChange={e=>setMes(e.target.value)}>
            {MESES.map(m=><option key={m}>{m}</option>)}</select></div>
        <div><label style={S.label}>Año</label>
          <select style={S.input} value={anio} onChange={e=>setAnio(+e.target.value)}>
            {ANIOS.map(a=><option key={a}>{a}</option>)}</select></div>
        <div><label style={S.label}>Margen fijo</label>
          <select style={S.input} value={margenF} onChange={e=>setMargenF(+e.target.value)}>
            {[0.34,0.32,0.30,0.28,0.25,0.20].map(m=><option key={m} value={m}>{fmtPct(m)}</option>)}</select></div>
        <div><label style={S.label}>Líquido mínimo</label>
          <input style={S.input} type="number" step="100000" value={liqMin} onChange={e=>setLiqMin(+e.target.value)}/></div>
        <div><label style={S.label}>Líquido máximo</label>
          <input style={S.input} type="number" step="100000" value={liqMax} onChange={e=>setLiqMax(+e.target.value)}/></div>
        <div><label style={S.label}>Paso</label>
          <input style={S.input} type="number" step="50000" value={paso} onChange={e=>setPaso(+e.target.value)}/></div>
      </div>
      <div style={{fontSize:12,color:"#666",marginBottom:14}}>
        UF {mes} {anio}: <strong>${fmt(uf)}</strong> · {escenarios.length} filas · <Badge color={mc}>{mc.label}</Badge>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"0.5px solid #ccc"}}>
            {["Líquido","CE/mes","CE c/vac+fnq","Tarifa día (UF)","Tarifa mes (UF)","PV mes (CLP)"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"6px 8px",color:"#666",fontWeight:500}}>{h}</th>
            ))}</tr></thead>
          <tbody>{escenarios.map((e,i)=>(
            <tr key={i} style={{borderBottom:"0.5px solid #eee"}}>
              <td style={{padding:"6px 8px",fontWeight:500}}>${fmt(e.liquido)}</td>
              <td style={{padding:"6px 8px",color:"#666"}}>${fmt(e.ce)}</td>
              <td style={{padding:"6px 8px",color:"#666"}}>${fmt(e.costoConFnq)}</td>
              <td style={{padding:"6px 8px",fontWeight:500,color:mc.text,background:mc.bg,borderRadius:4}}>{fmtUF(e.pvDiaUF)}</td>
              <td style={{padding:"6px 8px"}}>{fmtUF(e.pvMesUF)}</td>
              <td style={{padding:"6px 8px"}}>${fmt(e.pvMesCLP)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const [tab,setTab]=useState("carmo");
  const [exportData,setExportData]=useState<CarmoExportData|null>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [exporting,setExporting]=useState(false);
  const menuRef=useRef<HTMLDivElement>(null);
  const reportRef=useRef<HTMLDivElement>(null);

  const TABS=[{id:"carmo",label:"CaRMO Individual"},{id:"pricing",label:"Pricing Proyecto"},{id:"esc",label:"Simulador"},{id:"imputaciones",label:"Imputaciones"}];

  const handleDataChange=useCallback((d:CarmoExportData|null)=>setExportData(d),[]);

  useEffect(()=>{
    const handler=(e:MouseEvent)=>{ if(menuRef.current&&!menuRef.current.contains(e.target as Node))setMenuOpen(false); };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  async function handleExportWord() {
    if (!exportData) return;
    setExporting(true);
    try { await exportCarmoWord(exportData); }
    finally { setExporting(false); setMenuOpen(false); }
  }

  async function handleExportPDF() {
    if (!reportRef.current || !exportData) return;
    setExporting(true);
    setMenuOpen(false);
    // Build the report HTML in the hidden div, then capture
    await new Promise(r=>setTimeout(r,100)); // allow render
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const el = reportRef.current;
      el.style.display = "block";
      await new Promise(r=>setTimeout(r,50));
      const canvas = await html2canvas(el, { scale:2, useCORS:true, backgroundColor:"#ffffff" });
      el.style.display = "none";
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation:"p", unit:"mm", format:"a4" });
      const pageW=210, pageH=297, margin=10;
      const imgW=pageW-margin*2;
      const imgH=(canvas.height*imgW)/canvas.width;
      let y=margin;
      if(imgH<=pageH-margin*2) {
        pdf.addImage(imgData,"PNG",margin,y,imgW,imgH);
      } else {
        // Multi-page
        let remaining=imgH;
        let srcY=0;
        const ratio=canvas.width/imgW;
        while(remaining>0){
          const sliceH=Math.min(pageH-margin*2, remaining);
          const cvs=document.createElement("canvas");
          cvs.width=canvas.width; cvs.height=sliceH*ratio;
          cvs.getContext("2d")!.drawImage(canvas,0,srcY*ratio,canvas.width,sliceH*ratio,0,0,canvas.width,sliceH*ratio);
          pdf.addImage(cvs.toDataURL("image/png"),"PNG",margin,margin,imgW,sliceH);
          remaining-=sliceH; srcY+=sliceH;
          if(remaining>0) pdf.addPage();
        }
      }
      const fname=`CaRMO_${exportData.tabLabel.replace(/\s+/g,"_")}_${exportData.fecha.replace(/\s/g,"_")}.pdf`;
      pdf.save(fname);
    } finally { setExporting(false); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,fontWeight:500,color:"#666",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>SII Group Chile</div>
          <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 3px"}}>CaRMO – Calculadora de Rentabilidad</h2>
          <p style={{fontSize:13,color:"#666",margin:0}}>{COLABORADORES.length} colaboradores · {PERFILES.length} perfiles · GM mínima 34%</p>
        </div>

        {/* Export button */}
        <div ref={menuRef} style={{position:"relative"}}>
          <button
            onClick={()=>setMenuOpen(o=>!o)}
            disabled={!exportData || exporting || tab==="imputaciones"}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? "Exportando…" : "Exportar"}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {menuOpen && exportData && (
            <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",zIndex:50,
              background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:8,
              boxShadow:"0 4px 16px rgba(0,0,0,0.10)",minWidth:180,overflow:"hidden"}}>
              <button onClick={handleExportWord}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Exportar Word (.docx)
              </button>
              <button onClick={handleExportPDF}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5 text-red-500" />
                Exportar PDF
              </button>
            </div>
          )}
        </div>
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

      {tab==="carmo"&&<TabCaRMO onDataChange={handleDataChange}/>}
      {tab==="pricing"&&<TabPricing onDataChange={handleDataChange}/>}
      {tab==="esc"&&<TabEscenarios onDataChange={handleDataChange}/>}
      {tab==="imputaciones"&&<ImputacionesView/>}

      {/* Hidden PDF report */}
      <div ref={reportRef} style={{display:"none",position:"fixed",top:0,left:0,width:794,background:"#fff",padding:"40px 48px",fontFamily:"system-ui,sans-serif",color:"#111"}}>
        <CarmoReportPrint data={exportData}/>
      </div>
    </div>
  );
}

// ─── REPORTE PARA PDF ─────────────────────────────────────────────────────────
function CarmoReportPrint({ data }: { data: CarmoExportData | null }) {
  if (!data) return null;
  return (
    <div>
      {/* Encabezado */}
      <div style={{borderBottom:"3px solid #4F46E5",paddingBottom:16,marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:"#4F46E5",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>
              SII Group Chile · Operaciones
            </div>
            <div style={{fontSize:24,fontWeight:600,color:"#111"}}>CaRMO – Calculadora de Rentabilidad</div>
            <div style={{fontSize:14,fontWeight:500,color:"#4F46E5",marginTop:4}}>{data.tabLabel}</div>
            {data.titulo&&<div style={{fontSize:13,color:"#374151",marginTop:2}}>{data.titulo}</div>}
          </div>
          <img src="/sii-logo.png" alt="SII Group" style={{height:56,objectFit:"contain",opacity:0.9}}/>
        </div>
        <div style={{fontSize:11,color:"#6B7280",marginTop:12}}>Fecha: {data.fecha}</div>
      </div>

      {/* Secciones */}
      {data.sections.map((sec,i)=>(
        <div key={i} style={{marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:700,color:"#4F46E5",textTransform:"uppercase",
            letterSpacing:"0.1em",borderBottom:"1px solid #E5E7EB",paddingBottom:4,marginBottom:10}}>
            {sec.title}
          </div>
          {sec.badge&&(
            <div style={{
              display:"inline-block",padding:"4px 12px",borderRadius:6,marginBottom:10,
              fontSize:12,fontWeight:700,
              background:sec.badge.color==="green"?"#DCFCE7":sec.badge.color==="amber"?"#FEF3C7":sec.badge.color==="red"?"#FEE2E2":"#F3F4F6",
              color:sec.badge.color==="green"?"#166534":sec.badge.color==="amber"?"#92400E":sec.badge.color==="red"?"#991B1B":"#111827",
            }}>{sec.badge.label}</div>
          )}
          {sec.rows&&(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <tbody>
                {sec.rows.map((r,j)=>(
                  <tr key={j} style={{background:j%2===0?"#F9FAFB":"#fff"}}>
                    <td style={{padding:"5px 10px",color:"#6B7280",width:"40%"}}>{r.label}</td>
                    <td style={{padding:"5px 10px",fontWeight:r.bold?600:400,color:"#111"}}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sec.table&&(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"#4F46E5"}}>
                  {sec.table.headers.map((h,j)=>(
                    <th key={j} style={{padding:"5px 8px",color:"#fff",textAlign:"left",fontWeight:600}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sec.table.rows.map((row,j)=>(
                  <tr key={j} style={{background:j%2===0?"#fff":"#F9FAFB"}}>
                    {row.map((cell,k)=>(
                      <td key={k} style={{padding:"4px 8px",borderBottom:"0.5px solid #E5E7EB",color:"#111"}}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* Footer */}
      <div style={{borderTop:"1px solid #E5E7EB",marginTop:32,paddingTop:12,
        fontSize:10,color:"#9CA3AF",textAlign:"center"}}>
        Documento confidencial · SII Group Chile · {data.fecha}
      </div>
    </div>
  );
}
