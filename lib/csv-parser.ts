import type { Project, TeamMember, FinancialData, ProjectStatus, MemberRole } from "@/types";
import { projects as defaultProjects, teamMembers as defaultTeam, financialData as defaultFinance } from "@/lib/data";

// ─── Delimiter detection ─────────────────────────────────────────────────────

function detectDelimiter(text: string): string {
  const clean = text.startsWith("\ufeff") ? text.slice(1) : text;
  const firstLine = clean.split("\n")[0];
  const semis  = (firstLine.match(/;/g)  || []).length;
  const commas = (firstLine.match(/,/g)  || []).length;
  const tabs   = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis)  return "\t";
  if (semis > commas)                 return ";";
  return ",";
}

// ─── Raw CSV parsing ─────────────────────────────────────────────────────────

function parseCSVText(text: string, delimiter = ","): string[][] {
  // Remove UTF-8 BOM
  const clean = text.startsWith("\ufeff") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c    = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; }
      else if (c === '"')            { inQuotes = false; }
      else                           { cell += c; }
    } else {
      if      (c === '"')            { inQuotes = true; }
      else if (c === delimiter)      { row.push(cell); cell = ""; }
      else if (c === "\n")           { row.push(cell); cell = ""; rows.push(row); row = []; }
      else if (c !== "\r")           { cell += c; }
    }
  }
  if (cell || row.length > 0) { row.push(cell); if (row.length > 1) rows.push(row); }
  return rows;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parsePct(val: string): number {
  if (!val || val.trim() === "") return 0;
  return Math.round(parseFloat(val.replace("%", "").replace(",", ".").trim())) || 0;
}

/** DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD */
function parseDateCL(val: string): string {
  if (!val || val.trim() === "") return "";
  const v = val.trim();
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const parts = v.split(/[\/\-]/);
  if (parts.length !== 3) return v;
  const [a, b, c] = parts;
  // If first part is 4 digits, assume YYYY-MM-DD
  if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
  // Otherwise DD/MM/YYYY
  return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
}

function mapStatus(estado: string, riesgo: string): ProjectStatus {
  const e = estado.toLowerCase().trim();
  const r = riesgo.trim();
  if (e.includes("finaliz") || e.includes("complet"))                          return "completed";
  if (e.includes("garant"))                                                     return "guarantee";
  if (e.includes("atraso") || e.includes("delay") || e.includes("retraso"))    return "delayed";
  if (e.includes("suspend") || e.includes("paus") || e.includes("iniciar") ||
      e.includes("pendiente") || e.includes("por inic") || e.includes("hold")) return "on-hold";
  if ((e.includes("curso") || e.includes("activ")) && r === "1")               return "at-risk";
  return "active";
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Column index map (based on header row) ─────────────────────────────────

const EXPECTED_COLS = [
  "RIESGO", "Título", "NIVEL DE SERVICIO", "TIPO SERVICIO", "CLIENTE",
  "NOMBRE SERVICIO", "BIFS", "ESTADO", "Business Manager",
  "CANTIDAD CONSULTORES", "LIDER", "BU", "% REAL", "% ESPERADO",
  "INICIO", "FIN", "GAR", "Comentarios", "Próximas acciones",
  "Riesgos", "Plan de Mitigación", "FLEX-SHORE", "COCKPIT", "DELIVER",
  "SKILLS", "SECURE", "Profesionales", "Historial Comentarios",
  "CORREO CONTACTO CLIENTE", "FECHAS DE ENVÍO CORREOS", "% OTD", "% OQD",
];

interface ColMap { [key: string]: number }

function buildColMap(headerRow: string[]): ColMap {
  const map: ColMap = {};
  headerRow.forEach((h, i) => {
    const clean = h.trim().replace(/\uFEFF/g, "");
    map[clean] = i;
    map[clean.toLowerCase()] = i;
    // Also try without accents
    const noAccent = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    map[noAccent] = i;
    map[noAccent.toLowerCase()] = i;
  });
  // Fallback: positional mapping if headers match expected order
  EXPECTED_COLS.forEach((col, i) => {
    if (!(col in map)) map[col] = i;
    if (!(col.toLowerCase() in map)) map[col.toLowerCase()] = i;
  });
  return map;
}

function get(row: string[], col: ColMap, key: string): string {
  const idx = col[key] ?? col[key.toLowerCase()];
  return idx !== undefined ? (row[idx] ?? "").trim() : "";
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface ParseResult {
  projects: Project[];
  teamMembers: TeamMember[];
  financialData: FinancialData[];
  rowCount: number;
}

export function parseServicesCSV(text: string): ParseResult {
  const delimiter = detectDelimiter(text);
  const allRows   = parseCSVText(text, delimiter);
  if (allRows.length < 2) {
    return { projects: defaultProjects, teamMembers: defaultTeam, financialData: defaultFinance, rowCount: 0 };
  }

  const headerRow = allRows[0];
  const col       = buildColMap(headerRow);
  const dataRows  = allRows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

  // ── Build projects ──────────────────────────────────────────────────────
  const projects: Project[] = dataRows.map((row, idx) => {
    const id     = `p${idx + 1}`;
    const nombre = get(row, col, "NOMBRE SERVICIO") || get(row, col, "Título");
    const cliente         = get(row, col, "CLIENTE");
    const estado          = get(row, col, "ESTADO");
    const riesgo          = get(row, col, "RIESGO");
    const progReal        = parsePct(get(row, col, "% REAL"));
    const progEsp         = parsePct(get(row, col, "% ESPERADO"));
    const inicio          = parseDateCL(get(row, col, "INICIO"));
    const fin             = parseDateCL(get(row, col, "FIN"));
    const bm              = get(row, col, "Business Manager");
    const cantConsultores = parseInt(get(row, col, "CANTIDAD CONSULTORES")) || 1;
    const tipoServicio    = get(row, col, "TIPO SERVICIO");
    const nivelServicio   = get(row, col, "NIVEL DE SERVICIO");
    const bu              = get(row, col, "BU");
    const comentarios     = get(row, col, "Comentarios");
    const csvRisks              = get(row, col, "Riesgos");
    const csvMitigation         = get(row, col, "Plan de Mitigación");
    const csvNextActions        = get(row, col, "Próximas acciones");
    const csvHistoricalComments = get(row, col, "Historial Comentarios");
    const csvOtdPercent         = get(row, col, "% OTD");
    const csvOqdPercent         = get(row, col, "% OQD");

    return {
      id,
      name:      nombre || `Servicio ${idx + 1}`,
      status:    mapStatus(estado, riesgo),
      progress:  progReal,
      budget:    0,
      spent:     0,
      revenue:   0,
      startDate: inicio,
      endDate:   fin,
      teamSize:  cantConsultores,
      tasksTotal: 100,
      tasksDone:  progReal,
      manager:    bm,
      client:     cliente,
      leader:     get(row, col, "LIDER"),
      serviceType:  tipoServicio,
      serviceLevel: nivelServicio,
      bu,
      expectedProgress: progEsp,
      riskFlag:   riesgo === "1",
      shortComment: comentarios.slice(0, 300).replace(/\n/g, " "),
      csvRisks:      csvRisks.slice(0, 500),
      csvMitigation: csvMitigation.slice(0, 500),
      csvNextActions: csvNextActions.slice(0, 500),
      csvHistoricalComments: csvHistoricalComments.slice(0, 500),
      csvOtdPercent,
      csvOqdPercent,
    } as Project & Record<string, unknown>;
  });

  // ── Extract team members ────────────────────────────────────────────────
  const memberMap = new Map<string, { name: string; role: MemberRole; projectIds: string[]; isBm: boolean; isLeader: boolean }>();

  const addMember = (name: string, role: MemberRole, projectId: string, isBm = false, isLeader = false) => {
    const key = name.toLowerCase().trim();
    if (!key || key === "undefined") return;
    if (!memberMap.has(key)) {
      memberMap.set(key, { name: name.trim(), role, projectIds: [], isBm, isLeader });
    }
    const m = memberMap.get(key)!;
    if (!m.projectIds.includes(projectId)) m.projectIds.push(projectId);
    if (isBm)     m.isBm     = true;
    if (isLeader) m.isLeader = true;
  };

  dataRows.forEach((row, idx) => {
    const projectId = `p${idx + 1}`;
    const bm     = get(row, col, "Business Manager");
    const leader = get(row, col, "LIDER");
    const profStr = get(row, col, "Profesionales");

    if (bm)     addMember(bm,     "BM",        projectId, true,  false);
    if (leader) addMember(leader, "Team Lead",  projectId, false, true);

    if (profStr) {
      profStr.split(";").forEach((p) => {
        const name = p.trim();
        if (name) addMember(name, "Developer", projectId);
      });
    }
  });

  const teamMembers: TeamMember[] = Array.from(memberMap.values()).map((m, idx) => ({
    id:           `m${idx + 1}`,
    name:         m.name,
    role:         m.isBm ? "BM" : m.isLeader ? "Team Lead" : "Developer",
    avatar:       initials(m.name),
    hourlyRate:   0,
    hoursWorked:  0,
    projectsCount: m.projectIds.length,
    utilization:  0,
    projectIds:   m.projectIds,
  }));

  // ── Build financial data (zero-init, editable in Finance page) ──────────
  const financialData: FinancialData[] = projects.map((p) => ({
    projectId:         p.id,
    revenue:           0,
    directCosts:       0,
    operatingExpenses: 0,
    budget:            0,
    spent:             0,
  }));

  return { projects, teamMembers, financialData, rowCount: dataRows.length };
}
