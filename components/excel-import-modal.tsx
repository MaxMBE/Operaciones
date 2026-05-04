"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

interface ActividadCatalogo { cliente: string; codigo: string; descripcion: string; }
interface HeadcountEntry { nombre: string; dias: number; fte: number; costoDiario: number; costoMes: number; }
interface ActividadMes {
  mes: string; produccion: number; costos: number; margen: number;
  diasActividad: number; uf: number; workingDays: number; tarifaUF: number;
  costoNorm: number; irm: string; cliente: string; headcount: HeadcountEntry[];
}
interface ParsedData {
  catalogo: ActividadCatalogo[];
  actividades: Record<string, ActividadMes[]>;
  mesArchivo: string | null;
  resumen: {
    actividadesConData: number;
    totalConsultores: number;
    catalogo: number;
    totalProd: number;
    totalCosto: number;
    totalMargen: number;
    margenPct: number;
  };
  // Diagnostic: how many activities have produccion > 0 in each parsed month.
  // If a month is missing or has 0 activities, the parser did not pick it up.
  distribucionPorMes: Record<string, number>;
  // Diagnostic: how many BDD2 (headcount) entries the parser found per month.
  // If a month is empty here, the file has no consultant-day rows for it.
  distribucionHeadcountPorMes: Record<string, number>;
}
interface StoredData {
  catalogo: ActividadCatalogo[];
  actividades: Record<string, ActividadMes[]>;
}

const FY_START = "2025-04";

const MES_LABEL: Record<string, string> = {
  "2025-04":"Apr-25","2025-05":"May-25","2025-06":"Jun-25","2025-07":"Jul-25",
  "2025-08":"Aug-25","2025-09":"Sep-25","2025-10":"Oct-25","2025-11":"Nov-25",
  "2025-12":"Dec-25","2026-01":"Jan-26","2026-02":"Feb-26","2026-03":"Mar-26",
  "2026-04":"Apr-26","2026-05":"May-26","2026-06":"Jun-26",
};

function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseMes(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const m1 = s.match(/^(\d{4})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}`;
  const m2 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}`;
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  } catch {}
  return null;
}

async function parsePlanillaMargenes(file: File): Promise<ParsedData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const required = ["BDD1", "BDD2", "Buscador Actividad"];
  const missing = required.filter(s => !wb.SheetNames.includes(s));
  if (missing.length > 0) throw new Error(`Hojas no encontradas: ${missing.join(", ")}`);

  // BDD1
  const ws1 = wb.Sheets["BDD1"];
  const raw1 = XLSX.utils.sheet_to_json<unknown[]>(ws1, { header: 1, defval: null, raw: false, dateNF: "yyyy-mm-dd" });

  let hdrRow1 = -1;
  for (let i = 0; i < Math.min(raw1.length, 12); i++) {
    if (raw1[i] && (raw1[i] as unknown[]).includes("Activity Short Name")) { hdrRow1 = i; break; }
  }
  if (hdrRow1 < 0) throw new Error("No se encontró header en BDD1 (Activity Short Name)");

  const headers1 = (raw1[hdrRow1] as unknown[]).map(h => (h ?? "").toString().trim());
  const idx1 = (name: string) => headers1.indexOf(name);
  const COL1 = {
    month: idx1("Month"), customer: idx1("Customer"),
    actCode: idx1("Activity Short Name"), actDesc: idx1("Activity Description"),
    irm: idx1("Income recognition Method"),
    facturacion: idx1("Total Facturacion mensual"),
    prod: idx1("Total Monthly Prod"), costos: idx1("Total Monthly costs"),
    margen: idx1("Total Monthly Margen"),
    diasAct: idx1("Dias Actividad"), workingDays: idx1("Working Days"),
    uf: idx1("UF"),
  };
  const required1 = ["month","actCode","prod","costos","margen","uf"] as const;
  const missing1 = required1.filter(k => COL1[k] < 0);
  if (missing1.length) throw new Error(`Columnas BDD1 no encontradas: ${missing1.join(", ")}`);

  // BDD2
  const ws2 = wb.Sheets["BDD2"];
  const raw2 = XLSX.utils.sheet_to_json<unknown[]>(ws2, { header: 1, defval: null, raw: false, dateNF: "yyyy-mm-dd" });

  let hdrRow2 = -1;
  for (let i = 0; i < Math.min(raw2.length, 6); i++) {
    if (raw2[i] && (raw2[i] as unknown[]).includes("Employee Name")) { hdrRow2 = i; break; }
  }
  if (hdrRow2 < 0) throw new Error("No se encontró header en BDD2 (Employee Name)");

  const headers2 = (raw2[hdrRow2] as unknown[]).map(h => (h ?? "").toString().trim());
  const idx2 = (name: string) => headers2.indexOf(name);
  const COL2 = {
    month: idx2("Month"), empName: idx2("Employee Name"),
    actCode: idx2("Activity Short Name"), dias: idx2("Dias"),
    fte: idx2("FTE2"), costoDia: idx2("Costo diario"), costoMes: idx2("Costo mensual IFS"),
  };

  // Catálogo
  const wsBusc = wb.Sheets["Buscador Actividad"];
  const rawBusc = XLSX.utils.sheet_to_json<unknown[]>(wsBusc, { header: 1, defval: null });
  const catalogo: ActividadCatalogo[] = [];
  const seen = new Set<string>();
  for (let i = 6; i < rawBusc.length; i++) {
    const row = rawBusc[i] as unknown[] | undefined;
    if (!row) continue;
    const cli = row[8], cod = row[9], des = row[10];
    if (cod && typeof cod === "string" && cod.startsWith("SGC") && !seen.has(cod)) {
      seen.add(cod);
      catalogo.push({
        cliente: (cli && !String(cli).includes("ArrayFormula")) ? String(cli) : "",
        codigo: cod,
        descripcion: des ? String(des) : "",
      });
    }
  }

  // Headcount por activity+mes
  const hcMap: Record<string, HeadcountEntry[]> = {};
  for (let i = hdrRow2 + 1; i < raw2.length; i++) {
    const row = raw2[i] as unknown[] | undefined;
    if (!row || !row[COL2.actCode] || !row[COL2.month]) continue;
    const actCode = String(row[COL2.actCode]).trim();
    if (!actCode.startsWith("SGC")) continue;
    const mesStr = parseMes(row[COL2.month]);
    if (!mesStr || mesStr < FY_START) continue;
    const key = `${actCode}_${mesStr}`;
    if (!hcMap[key]) hcMap[key] = [];
    const nombre = String(row[COL2.empName] || "").trim();
    if (!nombre) continue;
    hcMap[key].push({
      nombre,
      dias: safeNum(row[COL2.dias]),
      fte: Math.round(safeNum(row[COL2.fte]) * 100) / 100,
      costoDiario: Math.round(safeNum(row[COL2.costoDia])),
      costoMes: Math.round(safeNum(row[COL2.costoMes])),
    });
  }

  // BDD1 → actividades
  const actMap: Record<string, ActividadMes[]> = {};
  let mesArchivo: string | null = null;

  for (let i = hdrRow1 + 1; i < raw1.length; i++) {
    const row = raw1[i] as unknown[] | undefined;
    if (!row || !row[COL1.actCode] || !row[COL1.month]) continue;
    const actCode = String(row[COL1.actCode]).trim();
    if (!actCode.startsWith("SGC")) continue;
    const mesStr = parseMes(row[COL1.month]);
    if (!mesStr || mesStr < FY_START) continue;

    if (!mesArchivo || mesStr > mesArchivo) mesArchivo = mesStr;

    const prod = safeNum(row[COL1.prod]);
    const costos = safeNum(row[COL1.costos]);
    const margen = safeNum(row[COL1.margen]);
    const dias = safeNum(row[COL1.diasAct]);
    const uf = safeNum(row[COL1.uf]);
    const wd = safeNum(row[COL1.workingDays]) || 20;
    const tarifaUF = uf > 0 ? Math.round(prod / uf * 10) / 10 : 0;
    const costoNorm = dias > 0 ? Math.round(Math.abs(costos) / dias * 20.75) : 0;
    const headcount = hcMap[`${actCode}_${mesStr}`] || [];

    if (!actMap[actCode]) actMap[actCode] = [];
    actMap[actCode].push({
      mes: mesStr,
      produccion: Math.round(prod),
      costos: Math.round(costos),
      margen: Math.round(margen),
      diasActividad: Math.round(dias),
      uf: Math.round(uf * 100) / 100,
      workingDays: Math.round(wd),
      tarifaUF, costoNorm,
      irm: String(row[COL1.irm] || "").trim(),
      cliente: String(row[COL1.customer] || "").trim(),
      headcount,
    });
  }

  Object.values(actMap).forEach(meses => meses.sort((a, b) => a.mes.localeCompare(b.mes)));

  // Resumen
  let totalProd = 0, totalCosto = 0, totalMargen = 0;
  let actividadesConData = 0;
  Object.values(actMap).forEach(meses => {
    const m = meses.find(x => x.mes === mesArchivo);
    if (!m) return;
    if (m.produccion !== 0 || m.costos !== 0) {
      actividadesConData++;
      totalProd += m.produccion;
      totalCosto += m.costos;
      totalMargen += m.margen;
    }
  });
  const margenPct = totalProd > 0 ? totalMargen / totalProd : 0;
  const consultMes = new Set<string>();
  Object.entries(hcMap).filter(([k]) => k.endsWith(`_${mesArchivo}`))
    .forEach(([, hc]) => hc.forEach(h => consultMes.add(h.nombre)));

  // Diagnostic: count activities with production > 0 per month parsed
  const distribucionPorMes: Record<string, number> = {};
  Object.values(actMap).forEach(meses => {
    meses.forEach(m => {
      if ((m.produccion || 0) > 0) {
        distribucionPorMes[m.mes] = (distribucionPorMes[m.mes] || 0) + 1;
      }
    });
  });

  // Diagnostic: count BDD2 headcount entries per month so we can tell
  // whether the file actually carries consultant-day data for each month.
  const distribucionHeadcountPorMes: Record<string, number> = {};
  Object.entries(hcMap).forEach(([key, hc]) => {
    const mes = key.split("_").pop() || "";
    if (!mes) return;
    distribucionHeadcountPorMes[mes] = (distribucionHeadcountPorMes[mes] || 0) + hc.length;
  });

  return {
    catalogo, actividades: actMap, mesArchivo,
    resumen: {
      actividadesConData, totalConsultores: consultMes.size, catalogo: catalogo.length,
      totalProd, totalCosto, totalMargen, margenPct,
    },
    distribucionPorMes,
    distribucionHeadcountPorMes,
  };
}

// Merge incoming Excel data into current storage.
//
// - In additive mode (default): a month is added if missing, and replaces an
//   existing entry only when the existing one is an empty placeholder
//   (produccion === 0). Months with real data already loaded are preserved.
// - In overwrite mode (force = true): every month present in the Excel
//   replaces what was in storage.
function mergeData(current: StoredData | null, incoming: ParsedData, force: boolean): {
  merged: StoredData;
  mesesAgregados:    { code: string; meses: string[] }[];
  mesesReemplazados: { code: string; meses: string[] }[];
  mesesOmitidos:     { code: string; meses: string[] }[];
} {
  const baseCat = current?.catalogo ?? [];
  const baseAct = current?.actividades ?? {};
  const catCodes = new Set(baseCat.map(c => c.codigo));
  const newCat = [...baseCat];
  for (const c of incoming.catalogo) if (!catCodes.has(c.codigo)) newCat.push(c);

  const merged: Record<string, ActividadMes[]> = { ...baseAct };
  const agregados:    Record<string, string[]> = {};
  const reemplazados: Record<string, string[]> = {};
  const omitidos:     Record<string, string[]> = {};

  for (const [code, mesesIn] of Object.entries(incoming.actividades)) {
    const existing = merged[code] || [];
    const byMes = new Map<string, ActividadMes>(existing.map(m => [m.mes, m]));
    for (const m of mesesIn) {
      const prev = byMes.get(m.mes);
      if (!prev) {
        byMes.set(m.mes, m);
        (agregados[code] = agregados[code] || []).push(m.mes);
      } else if (force || (prev.produccion || 0) === 0) {
        byMes.set(m.mes, m);
        (reemplazados[code] = reemplazados[code] || []).push(m.mes);
      } else {
        (omitidos[code] = omitidos[code] || []).push(m.mes);
      }
    }
    merged[code] = [...byMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }

  return {
    merged: { catalogo: newCat, actividades: merged },
    mesesAgregados:    Object.entries(agregados).map(([code, meses]) => ({ code, meses })),
    mesesReemplazados: Object.entries(reemplazados).map(([code, meses]) => ({ code, meses })),
    mesesOmitidos:     Object.entries(omitidos).map(([code, meses]) => ({ code, meses })),
  };
}

const fmtNum = (n: number) => Math.abs(Math.round(n)).toLocaleString("en-US");
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (merged: StoredData, agregados: { code: string; meses: string[] }[]) => void;
}

export function ExcelImportModal({ open, onClose, onImported }: Props) {
  const [parsing, setParsing] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [parsed, setParsed]   = useState<ParsedData | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [force, setForce]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setParsing(false); setError(null); setParsed(null); setSaving(false); setForce(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const processFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsm") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setError("El archivo debe ser .xlsm o .xlsx");
      return;
    }
    setParsing(true); setError(null); setParsed(null);
    try {
      const data = await parsePlanillaMargenes(file);
      setParsed(data);
    } catch (err) {
      setError((err as Error).message || "Error al procesar el archivo");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleConfirm = useCallback(async () => {
    if (!parsed) return;
    setSaving(true); setError(null);
    try {
      const current: StoredData | null = await fetch("/api/settings/actividades-data")
        .then(r => r.json()).catch(() => null);
      const { merged, mesesAgregados } = mergeData(current, parsed, force);
      const res = await fetch("/api/settings/actividades-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) throw new Error("Error guardando en Supabase");
      onImported(merged, mesesAgregados);
      handleClose();
    } catch (err) {
      setError((err as Error).message || "Error al guardar");
      setSaving(false);
    }
  }, [parsed, onImported, handleClose, force]);

  if (!open) return null;

  // Pre-cómputo: cuántos meses de cuántas actividades están a punto de agregarse
  const mesesNuevosCount = parsed
    ? new Set(Object.values(parsed.actividades).flatMap(ms => ms.map(m => m.mes))).size
    : 0;

  return (
    <div onClick={handleClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:"#fff", borderRadius:12, maxWidth:680, width:"100%",
          boxShadow:"0 20px 60px rgba(0,0,0,0.3)", overflow:"hidden", maxHeight:"90vh",
          display:"flex", flexDirection:"column" }}>

        <div style={{ background:"#17375e", color:"#fff", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, opacity:0.7, textTransform:"uppercase", letterSpacing:"0.06em" }}>
              SII Group Chile
            </div>
            <div style={{ fontSize:16, fontWeight:600 }}>Importar Planilla de Márgenes</div>
          </div>
          <button onClick={handleClose}
            style={{ background:"transparent", border:"none", color:"#fff", fontSize:22, cursor:"pointer", lineHeight:1, padding:"0 4px" }}>
            ×
          </button>
        </div>

        <div style={{ padding:"18px 20px", overflow:"auto", flex:1 }}>
          {!parsed && (
            <>
              <p style={{ margin:0, fontSize:13, color:"#475569", marginBottom:14 }}>
                Carga el archivo <code style={{ fontSize:12, background:"#f1f5f9", padding:"1px 6px", borderRadius:3 }}>
                SIICL_Planilla-Margenes_YYYY-MM.xlsm</code>. La importación es <b>aditiva</b>: solo se agregan los meses que aún no existen en el sistema.
              </p>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !parsing && inputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "#1565c0" : error ? "#dc2626" : "#cbd5e1"}`,
                  borderRadius:10, padding:"34px 20px", textAlign:"center",
                  cursor: parsing ? "wait" : "pointer",
                  background: dragOver ? "#e0f2fe" : error ? "#fef2f2" : "#f8fafc",
                  transition:"all 0.15s",
                }}>
                <input ref={inputRef} type="file" accept=".xlsm,.xlsx,.xls"
                  style={{ display:"none" }}
                  onChange={e => processFile(e.target.files?.[0])} />
                {parsing ? (
                  <>
                    <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>Procesando archivo…</div>
                    <div style={{ fontSize:11, color:"#64748b" }}>Leyendo BDD1, BDD2 y Buscador Actividad</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>
                      Arrastrá el archivo o hacé clic para seleccionar
                    </div>
                    <div style={{ fontSize:11, color:"#64748b" }}>Formatos: .xlsm · .xlsx</div>
                  </>
                )}
              </div>

              {error && (
                <div style={{ marginTop:12, padding:"10px 12px", background:"#fef2f2", border:"1px solid #fecaca",
                  borderRadius:8, fontSize:12, color:"#b91c1c" }}>
                  ⚠ {error}
                </div>
              )}
            </>
          )}

          {parsed && (
            <>
              <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
                  Mes más reciente del archivo
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:"#17375e" }}>
                  {parsed.mesArchivo ? (MES_LABEL[parsed.mesArchivo] || parsed.mesArchivo) : "—"}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10, marginBottom:14 }}>
                <Stat label="Actividades del mes"   value={String(parsed.resumen.actividadesConData)} />
                <Stat label="Consultores del mes"   value={String(parsed.resumen.totalConsultores)} />
                <Stat label="Producción del mes"    value={`$${fmtNum(parsed.resumen.totalProd)}`} />
                <Stat label="Margen %"              value={fmtPct(parsed.resumen.margenPct)}
                  color={parsed.resumen.margenPct >= 0.34 ? "#15803d" : parsed.resumen.margenPct >= 0.30 ? "#ca8a04" : "#b91c1c"} />
              </div>

              <div style={{ background:"#fefce8", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#854d0e" }}>
                Vas a importar <b>{Object.keys(parsed.actividades).length}</b> actividades cubriendo
                <b> {mesesNuevosCount} mes{mesesNuevosCount === 1 ? "" : "es"}</b>.
                {force ? (
                  <> El modo <b>Sobrescribir</b> está activado: los meses que ya existían se reemplazarán por los del Excel.</>
                ) : (
                  <> Los meses que ya tengan datos reales se preservan; los meses sin datos (placeholders) se reemplazan automáticamente.</>
                )}
              </div>

              <label style={{ display:"flex", alignItems:"flex-start", gap:8, marginTop:10, padding:"10px 12px",
                background: force ? "#fff7ed" : "#f8fafc", border: `1px solid ${force ? "#fb923c" : "#e2e8f0"}`,
                borderRadius:8, cursor:"pointer", fontSize:12, color:"#334155" }}>
                <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)}
                  style={{ marginTop:2, accentColor:"#ea580c", cursor:"pointer" }} />
                <span>
                  <b>Sobrescribir todos los meses del archivo</b><br/>
                  <span style={{ color:"#64748b" }}>
                    Útil si una importación previa quedó con datos incorrectos. Reemplaza los meses del Excel
                    aunque ya existan en el sistema.
                  </span>
                </span>
              </label>

              <ParsedDiagnostic parsed={parsed} />
              <ActivityInspector parsed={parsed} />

              {error && (
                <div style={{ marginTop:12, padding:"10px 12px", background:"#fef2f2", border:"1px solid #fecaca",
                  borderRadius:8, fontSize:12, color:"#b91c1c" }}>
                  ⚠ {error}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display:"flex", gap:8, padding:"12px 20px", background:"#f9fafb",
          borderTop:"1px solid #e2e8f0", justifyContent:"flex-end", flexWrap:"wrap" }}>
          <button onClick={handleClose}
            style={{ padding:"7px 14px", background:"transparent", border:"1px solid #cbd5e1",
              borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", color:"#475569" }}>
            Cancelar
          </button>
          {parsed && (
            <>
              <button onClick={reset}
                style={{ padding:"7px 14px", background:"#fff", border:"1px solid #2e75b6",
                  borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", color:"#2e75b6" }}>
                Cargar otro archivo
              </button>
              <button onClick={handleConfirm} disabled={saving}
                style={{ padding:"7px 14px", background: saving ? "#94a3b8" : "#16a34a", border:"none",
                  borderRadius:6, fontSize:12, fontWeight:700, cursor: saving ? "wait" : "pointer", color:"#fff" }}>
                {saving ? "Guardando…" : "✓ Confirmar e importar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 12px" }}>
      <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>
        {label}
      </div>
      <div style={{ fontSize:16, fontWeight:600, color: color ?? "#0f172a" }}>{value}</div>
    </div>
  );
}

const ALL_MESES_DIAG = [
  "2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
  "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03",
  "2026-04","2026-05","2026-06",
];

function ParsedDiagnostic({ parsed }: { parsed: ParsedData }) {
  return (
    <>
      <DiagnosticBars
        title="BDD1 — actividades con producción > 0"
        data={parsed.distribucionPorMes}
        positiveColor="#86efac"
        labelColor="#15803d"
      />
      <DiagnosticBars
        title="BDD2 — entradas de headcount (días por consultor) detectadas"
        data={parsed.distribucionHeadcountPorMes}
        positiveColor="#bfdbfe"
        labelColor="#1d4ed8"
      />
    </>
  );
}

function DiagnosticBars({ title, data, positiveColor, labelColor }: {
  title: string;
  data: Record<string, number>;
  positiveColor: string;
  labelColor: string;
}) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div style={{ marginTop:14, border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 14px", background:"#fff" }}>
      <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
        {title}
      </div>
      <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:60, marginBottom:4 }}>
        {ALL_MESES_DIAG.map(mes => {
          const n = data[mes] || 0;
          const h = Math.max(2, (n / max) * 56);
          return (
            <div key={mes} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ fontSize:9, fontWeight:600, color: n > 0 ? labelColor : "#94a3b8" }}>{n || ""}</div>
              <div style={{ width:"100%", height: h, background: n > 0 ? positiveColor : "#e2e8f0", borderRadius:2 }}/>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:4 }}>
        {ALL_MESES_DIAG.map(mes => (
          <div key={mes} style={{ flex:1, fontSize:8, color:"#64748b", textAlign:"center" }}>
            {(MES_LABEL[mes] || mes).replace(" ", "\n")}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityInspector({ parsed }: { parsed: ParsedData }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    return parsed.catalogo.filter(c =>
      c.codigo.toLowerCase().includes(lq) ||
      c.cliente.toLowerCase().includes(lq) ||
      c.descripcion.toLowerCase().includes(lq)
    ).slice(0, 8);
  }, [q, parsed.catalogo]);
  const [selected, setSelected] = useState<string | null>(null);
  const meses = selected ? (parsed.actividades[selected] || []) : [];

  return (
    <div style={{ marginTop:10, border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 14px", background:"#fff" }}>
      <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
        Inspeccionar una actividad parseada
      </div>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setSelected(null); }}
        placeholder="Buscar por código, cliente o descripción…"
        style={{ width:"100%", boxSizing:"border-box", border:"1px solid #cbd5e1", borderRadius:6,
          padding:"6px 10px", fontSize:12, background:"#fff" }} />
      {matches.length > 0 && !selected && (
        <div style={{ marginTop:6, maxHeight:140, overflowY:"auto", border:"1px solid #e2e8f0", borderRadius:6 }}>
          {matches.map(c => (
            <div key={c.codigo} onClick={() => setSelected(c.codigo)}
              style={{ padding:"6px 10px", cursor:"pointer", borderBottom:"0.5px solid #f1f5f9", fontSize:11 }}>
              <div style={{ fontFamily:"monospace", fontWeight:700, color:"#1d4ed8" }}>{c.codigo}</div>
              <div style={{ color:"#475569" }}>{c.cliente} · {c.descripcion}</div>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:11, color:"#0f172a", fontWeight:600, marginBottom:4 }}>
            {selected} · {meses.length} mes{meses.length === 1 ? "" : "es"} parseado{meses.length === 1 ? "" : "s"}
            <button onClick={() => { setSelected(null); setQ(""); }}
              style={{ marginLeft:8, fontSize:10, color:"#64748b", background:"none", border:"none", cursor:"pointer" }}>
              cambiar
            </button>
          </div>
          {meses.length === 0 ? (
            <div style={{ fontSize:11, color:"#b91c1c" }}>
              Esta actividad no tiene meses parseados desde el Excel.
            </div>
          ) : (
            <div style={{ overflowX:"auto", border:"1px solid #e2e8f0", borderRadius:6 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Mes","Producción","Costos","Margen","Margen %","HC"].map(h => (
                      <th key={h} style={{ padding:"5px 8px", textAlign:"left", fontWeight:600, color:"#475569",
                        borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {meses.map(m => {
                    const pct = m.produccion > 0 ? (m.margen / m.produccion) * 100 : 0;
                    return (
                      <tr key={m.mes} style={{ borderBottom:"0.5px solid #f1f5f9" }}>
                        <td style={{ padding:"4px 8px", fontFamily:"monospace" }}>{MES_LABEL[m.mes] || m.mes}</td>
                        <td style={{ padding:"4px 8px", textAlign:"right" }}>{fmtNum(m.produccion)}</td>
                        <td style={{ padding:"4px 8px", textAlign:"right", color:"#64748b" }}>{m.costos === 0 ? "" : `(${fmtNum(m.costos)})`}</td>
                        <td style={{ padding:"4px 8px", textAlign:"right", color: m.margen >= 0 ? "#15803d" : "#b91c1c" }}>{fmtNum(m.margen)}</td>
                        <td style={{ padding:"4px 8px", textAlign:"right" }}>{m.produccion > 0 ? `${pct.toFixed(1)}%` : ""}</td>
                        <td style={{ padding:"4px 8px", textAlign:"center" }}>{m.headcount?.length ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
