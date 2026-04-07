"use client";

import { useMemo, useState, useEffect, useCallback, useRef, Fragment } from "react";
import { useData } from "@/lib/data-context";
import { useT, useLang } from "@/lib/i18n";
import {
  PieChart, Pie, Cell, Tooltip as ReTT,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, ReferenceLine,
} from "recharts";
import { formatCurrency, formatClpToUsd } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";
import CareerPathTab from "@/components/career-path-tab";
import { PrintHeader } from "@/components/print-header";
import { MultiFilter } from "@/components/multi-filter";
import { CsvUploadMenuItems } from "@/components/csv-upload-menu-items";
import type { Project, ProjectReport, HealthStatus, TeamMember } from "@/types";
import {
  CheckCircle2, TrendingUp, DollarSign,
  ChevronDown, ChevronRight, Target, Gauge, Pencil, Plus, X, History, Clock,
} from "lucide-react";

// ── Snapshot types ────────────────────────────────────────────────────────────
interface SnapshotMeta { id: string; snapshot_date: string; week_label: string; created_at: string; }
interface SnapshotFull extends SnapshotMeta { projects: Project[]; report_data: Record<string, ProjectReport>; cor_manual: CORManual | null; }

// ── Helpers de fecha para snapshots ──────────────────────────────────────────
function getLastMonday(from = new Date()): string {
  const d = new Date(from);
  // day 0=Dom, 1=Lun ... 6=Sab
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // días hacia atrás hasta el lunes
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isMondayToday(): boolean {
  return new Date().getDay() === 1;
}

function formatWeekLabel(isoDate: string): string {
  const [y, m, day] = isoDate.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return `Week of ${d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`;
}

function translateWeekLabel(label: string): string {
  const ES_MONTHS: Record<string, string> = {
    enero:"January", febrero:"February", marzo:"March", abril:"April",
    mayo:"May", junio:"June", julio:"July", agosto:"August",
    septiembre:"September", octubre:"October", noviembre:"November", diciembre:"December",
  };
  const m = label.match(/^Semana del (\d+) de (\w+) de (\d+)$/i);
  if (m) return `Week of ${ES_MONTHS[m[2].toLowerCase()] || m[2]} ${m[1]}, ${m[3]}`;
  return label;
}

// ── Constants ─────────────────────────────────────────────────────────────────


const CHART_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6"];

// ── COR manual override ────────────────────────────────────────────────────────

const COR_MANUAL_KEY = "cor_manual_data";

interface CORManual {
  revenue: string; cost: string; otd: string; oqd: string;
  customers: string; models: string;
  reportMonth?: string;
  teamMembers?: TeamMember[];
}

const EMPTY_MANUAL: CORManual = { revenue:"", cost:"", otd:"", oqd:"", customers:"", models:"", reportMonth:"January" };

function parseCORCSV(text: string): Array<{name:string; value:number}> {
  return text.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const [name, val] = l.split(",").map(s => s.trim());
    const value = parseFloat((val||"0").replace("%",""));
    return { name: name||"—", value: isNaN(value) ? 0 : value };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parsePercent(val: string | undefined): number | null {
  if (!val || val === "N/A" || val === "N/D" || val === "—") return null;
  const n = parseFloat(val.replace("%", "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function pctBadge(val: number | null): string {
  if (val === null) return "bg-gray-100 text-gray-500";
  if (val >= 95) return "bg-emerald-100 text-emerald-700";
  if (val >= 80) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function csatFromHealth(health: string | undefined): string {
  if (!health) return "N/D";
  const num = parseFloat(health);
  if (!isNaN(num) && num >= 1 && num <= 4) return num.toFixed(1);
  const h = health.toUpperCase();
  if (h === "G" || h.includes("BUEN") || h.includes("EXCE")) return "4.0";
  if (h === "A" || h.includes("ACEPT") || h.includes("NORM")) return "3.0";
  if (h === "R" || h.includes("RIESG") || h.includes("MAL")) return "2.0";
  return "3.5";
}

// ── WEATHER is built from translations at render time — see makeWeather() ──────

const WEATHER_KEYS = ["G","A","R","grey","B","done"] as const;
type WeatherKey = typeof WEATHER_KEYS[number];

function makeWeather(t: ReturnType<typeof useT>) {
  return {
    G:    { icon: "☀️",  label: t.cor_weather_on_track, bg: "bg-green-50",  text: "text-green-700",  border: "border-green-300" },
    A:    { icon: "⛅",  label: t.cor_weather_at_risk,  bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-300" },
    R:    { icon: "⛈️", label: t.cor_weather_critical, bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300"   },
    grey: { icon: "☁️",  label: t.cor_weather_na,       bg: "bg-gray-50",   text: "text-gray-500",   border: "border-gray-200"  },
    B:    { icon: "🌤️", label: t.cor_weather_stable,   bg: "bg-blue-50",   text: "text-blue-600",   border: "border-blue-200"  },
    done: { icon: "✅",  label: t.cor_weather_done,     bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-300"  },
  } as Record<WeatherKey, { icon: string; label: string; bg: string; text: string; border: string }>;
}

// ── BulletList ────────────────────────────────────────────────────────────────

function BulletList({ text }: { text: string }) {
  const items = text
    .split(/\n|(?<=\S)\s*•\s*/)
    .map(s => s.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);
  if (items.length <= 1) {
    return <p className="text-[10px] text-muted-foreground leading-relaxed">{text}</p>;
  }
  return (
    <ul className="space-y-1 mt-0.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-snug">
          <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Small edit-field helpers ──────────────────────────────────────────────────

function EF({
  label, value, editMode, onChange, textarea, type = "text",
}: {
  label: string; value: string; editMode: boolean;
  onChange?: (v: string) => void;
  textarea?: boolean; type?: string;
}) {
  return (
    <div>
      <span className="text-[8px] text-muted-foreground uppercase tracking-wide block">{label}</span>
      {editMode && onChange ? (
        textarea ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={3}
            className="w-full text-[10px] border border-indigo-200 rounded px-1.5 py-0.5 mt-0.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full text-[10px] border border-indigo-200 rounded px-1.5 py-0.5 mt-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        )
      ) : (
        <span className="text-[10px] font-medium">{value || "—"}</span>
      )}
    </div>
  );
}

function SEF({
  label, value, editMode, onChange,
}: {
  label: string; value: string; editMode: boolean;
  onChange?: (v: string) => void;
}) {
  const w = (makeWeather as unknown as (t: { cor_weather_on_track: string; cor_weather_at_risk: string; cor_weather_critical: string; cor_weather_na: string; cor_weather_stable: string; cor_weather_done: string }) => ReturnType<typeof makeWeather>)({ cor_weather_on_track: "On Track", cor_weather_at_risk: "At Risk", cor_weather_critical: "Critical", cor_weather_na: "N/A", cor_weather_stable: "Stable", cor_weather_done: "Terminado" })[value as WeatherKey] ?? { icon: "☁️", label: "N/A", text: "text-gray-500" };
  return (
    <div>
      <span className="text-[8px] text-muted-foreground uppercase tracking-wide block">{label}</span>
      {editMode && onChange ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full text-[10px] border border-indigo-200 rounded px-1.5 py-0.5 mt-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="G">☀️ On Track</option>
          <option value="A">⛅ At Risk</option>
          <option value="R">⛈️ Critical</option>
          <option value="grey">☁️ N/A</option>
          <option value="B">🌤️ Stable</option>
          <option value="done">✅ Done</option>
        </select>
      ) : (
        <span className={`text-[10px] font-medium ${w.text}`}>{w.icon} {w.label}</span>
      )}
    </div>
  );
}

function NumericInput({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const { lang } = useLang();
  const display = value ? parseInt(value, 10).toLocaleString(lang === "en" ? "en-US" : "es-CL") : "";
  return (
    <div>
      <span className="text-[8px] text-muted-foreground uppercase tracking-wide block">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="w-full text-[10px] border border-indigo-200 rounded px-1.5 py-0.5 mt-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        placeholder="0"
      />
    </div>
  );
}

// ── Project Detail Panel ──────────────────────────────────────────────────────

function ProjectDetailPanel({
  project: p,
  report: rep,
  onSaveProject,
  onSaveReport,
  readOnly = false,
}: {
  project: Project;
  report?: ProjectReport;
  onSaveProject: (changes: Partial<Project>) => void;
  onSaveReport:  (changes: Partial<ProjectReport>) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const { teamMembers } = useData();

  const [editMode, setEditMode] = useState(false);

  // Secciones colapsables
  const [highlightsOpen,   setHighlightsOpen]   = useState(false);
  const [ftesOpen,         setFtesOpen]         = useState(false);
  const [improvementOpen,  setImprovementOpen]  = useState(false);
  const [risksOpen,        setRisksOpen]        = useState(false);

  // Consultores asociados a este proyecto
  const projectFTEs = useMemo(
    () => teamMembers.filter(m => m.projectIds?.includes(p.id)),
    [teamMembers, p.id]
  );

  // Modal de confirmación y éxito
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [saveSuccess,  setSaveSuccess]  = useState(false);

  // Split draft into project fields and report fields
  const [draftP, setDraftP] = useState({
    client:        p.client       || "",
    ifsCode:       p.ifsCode      || "",
    manager:       p.manager      || "",
    leader:        p.leader       || "",
    serviceType:   p.serviceType  || "",
    serviceLevel:  p.serviceLevel || "",
    bu:            p.bu           || "",
    teamSize:      String(p.teamSize || ""),
    revenue:           String(p.revenue           || ""),
    budget:            String(p.budget            || ""),
    spent:             String(p.spent             || ""),
    revenueMonthly:    String(p.revenueMonthly    || ""),
    costMonthly:       String(p.costMonthly       || ""),
    revenueProjection: String(p.revenueProjection || ""),
    costProjection:    String(p.costProjection    || ""),
    progress:       String(p.progress || ""),
    expectedProgress: String(p.expectedProgress ?? ""),
    startDate:     p.startDate    || "",
    endDate:       p.endDate      || "",
    csvOtdPercent: (p.csvOtdPercent || "").replace("%",""),
    csvOqdPercent: (p.csvOqdPercent || "").replace("%",""),
    shortComment:  p.shortComment  || "",
    csvRisks:      p.csvRisks      || "",
    csvMitigation: p.csvMitigation || "",
    csvNextActions:p.csvNextActions|| "",
  });

  const [draftR, setDraftR] = useState({
    ftes:             rep?.ftes             || "",
    phase:            rep?.phase             || "",
    overallStatus:    rep?.overallStatus     ?? "grey",
    currentStatus:    rep?.currentStatus     ?? "grey",
    milestonesStatus: rep?.milestonesStatus  ?? "grey",
    resourcesStatus:  rep?.resourcesStatus   ?? "grey",
    issuesStatus:     rep?.issuesStatus      ?? "grey",
    risksStatus:      rep?.risksStatus       ?? "grey",
    achievements:     rep?.achievements      || "",
    currentIssues:    rep?.currentIssues     || "",
    actionsInProgress:rep?.actionsInProgress || "",
    nextSteps:        rep?.nextSteps         || "",
    keyRisks:         rep?.keyRisks          || "",
    mitigation:       rep?.mitigation        || "",
    csat:             csatFromHealth(rep?.healthGovernance) === "N/D" ? "" : csatFromHealth(rep?.healthGovernance),
    teamMood:         rep?.teamMood || "",
    marginImprovement: rep?.marginImprovement || "",
  });

  function setP(k: keyof typeof draftP, v: string) { setDraftP(d => ({ ...d, [k]: v })); }
  function setR(k: keyof typeof draftR, v: string) { setDraftR(d => ({ ...d, [k]: v })); }

  function handleSave() {
    setConfirmOpen(true);
  }

  function handleConfirmSave() {
    onSaveProject({
      client:        draftP.client,
      ifsCode:       draftP.ifsCode || undefined,
      manager:       draftP.manager,
      leader:        draftP.leader,
      serviceType:   draftP.serviceType,
      serviceLevel:  draftP.serviceLevel,
      bu:            draftP.bu,
      teamSize:      parseInt(draftP.teamSize) || p.teamSize,
      revenue:           parseFloat(draftP.revenue)           || p.revenue,
      budget:            parseFloat(draftP.budget)            || p.budget,
      spent:             parseFloat(draftP.spent)             || p.spent,
      revenueMonthly:    parseFloat(draftP.revenueMonthly)    || undefined,
      costMonthly:       parseFloat(draftP.costMonthly)       || undefined,
      revenueProjection: parseFloat(draftP.revenueProjection) || undefined,
      costProjection:    parseFloat(draftP.costProjection)    || undefined,
      progress:      parseInt(draftP.progress)  || p.progress,
      expectedProgress: draftP.expectedProgress !== "" ? parseInt(draftP.expectedProgress) : p.expectedProgress,
      startDate:     draftP.startDate,
      endDate:       draftP.endDate,
      csvOtdPercent: draftP.csvOtdPercent ? draftP.csvOtdPercent + "%" : p.csvOtdPercent,
      csvOqdPercent: draftP.csvOqdPercent ? draftP.csvOqdPercent + "%" : p.csvOqdPercent,
      shortComment:  draftP.shortComment,
      csvRisks:      draftP.csvRisks,
      csvMitigation: draftP.csvMitigation,
      csvNextActions:draftP.csvNextActions,
    });
    onSaveReport({
      ftes:             draftR.ftes,
      phase:            draftR.phase,
      overallStatus:    draftR.overallStatus as HealthStatus,
      currentStatus:    draftR.currentStatus as HealthStatus,
      milestonesStatus: draftR.milestonesStatus as HealthStatus,
      resourcesStatus:  draftR.resourcesStatus as HealthStatus,
      issuesStatus:     draftR.issuesStatus as HealthStatus,
      risksStatus:      draftR.risksStatus as HealthStatus,
      achievements:     draftR.achievements,
      currentIssues:    draftR.currentIssues,
      actionsInProgress:draftR.actionsInProgress,
      nextSteps:        draftR.nextSteps,
      keyRisks:         draftR.keyRisks,
      mitigation:       draftR.mitigation,
      healthGovernance:  draftR.csat || rep?.healthGovernance || "",
      teamMood:          draftR.teamMood,
      marginImprovement: draftR.marginImprovement,
    });
    setConfirmOpen(false);
    setEditMode(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  function handleCancel() {
    setDraftP({
      client: p.client||"", ifsCode: p.ifsCode||"", manager: p.manager||"", leader: p.leader||"",
      serviceType: p.serviceType||"", serviceLevel: p.serviceLevel||"",
      bu: p.bu||"", teamSize: String(p.teamSize||""),
      revenue: String(p.revenue||""), budget: String(p.budget||""),
      spent: String(p.spent||""), revenueMonthly: String(p.revenueMonthly||""),
      costMonthly: String(p.costMonthly||""),
      revenueProjection: String(p.revenueProjection||""),
      costProjection: String(p.costProjection||""),
      progress: String(p.progress||""),
      expectedProgress: String(p.expectedProgress??""),
      startDate: p.startDate||"", endDate: p.endDate||"",
      csvOtdPercent: (p.csvOtdPercent||"").replace("%",""),
      csvOqdPercent: (p.csvOqdPercent||"").replace("%",""),
      shortComment: p.shortComment||"", csvRisks: p.csvRisks||"",
      csvMitigation: p.csvMitigation||"", csvNextActions: p.csvNextActions||"",
    });
    setDraftR({
      ftes: rep?.ftes||"",
      phase: rep?.phase||"", overallStatus: rep?.overallStatus??"grey",
      currentStatus: rep?.currentStatus??"grey",
      milestonesStatus: rep?.milestonesStatus??"grey",
      resourcesStatus: rep?.resourcesStatus??"grey",
      issuesStatus: rep?.issuesStatus??"grey",
      risksStatus: rep?.risksStatus??"grey",
      achievements: rep?.achievements||"", currentIssues: rep?.currentIssues||"",
      actionsInProgress: rep?.actionsInProgress||"", nextSteps: rep?.nextSteps||"",
      keyRisks: rep?.keyRisks||"", mitigation: rep?.mitigation||"",
      csat: csatFromHealth(rep?.healthGovernance)==="N/D" ? "" : csatFromHealth(rep?.healthGovernance),
      teamMood: rep?.teamMood||"",
      marginImprovement: rep?.marginImprovement||"",
    });
    setEditMode(false);
  }

  const weather = makeWeather(t);
  const otdVal  = parsePercent(draftP.csvOtdPercent || undefined);
  const oqdVal  = parsePercent(draftP.csvOqdPercent || undefined);

  // Financial values
  const revMes   = parseFloat(draftP.revenueMonthly)    || 0;
  const costMes  = parseFloat(draftP.costMonthly)       || 0;
  const rev      = parseFloat(draftP.revenue)           || 0;
  const cost     = parseFloat(draftP.spent)             || 0;
  const revProj  = parseFloat(draftP.revenueProjection) || 0;
  const costProj = parseFloat(draftP.costProjection)    || 0;

  // Ganancia (Producción - Costo) per column
  const ganMes   = revMes  > 0 ? revMes  - costMes  : null;
  const ganYTD   = rev     > 0 ? rev     - cost      : null;
  const ganProj  = revProj > 0 ? revProj - costProj  : null;

  // Margen % per column
  const mrgMes   = revMes  > 0 ? Math.round((revMes  - costMes)  / revMes  * 100) : null;
  const mrgYTD   = rev     > 0 ? Math.round((rev     - cost)     / rev     * 100) : null;
  const mrgProj  = revProj > 0 ? Math.round((revProj - costProj) / revProj * 100) : null;

  // TMD = Margen - 34% target
  const tmdMes   = mrgMes  !== null ? mrgMes  - 34 : null;
  const tmdYTD   = mrgYTD  !== null ? mrgYTD  - 34 : null;
  const tmdProj  = mrgProj !== null ? mrgProj - 34 : null;

  function fmtCLP(v: number | null): string {
    if (v === null || v === 0) return "—";
    return Math.round(v).toLocaleString(lang === "en" ? "en-US" : "es-CL");
  }
  function fmtPct(v: number | null): string {
    if (v === null) return "—";
    return `${v}%`;
  }
  function fmtDev(v: number | null): string {
    if (v === null) return "—";
    return `${v > 0 ? "+" : ""}${v}pp`;
  }
  function devClass(v: number | null): string {
    if (v === null) return "text-gray-400";
    return v >= 0 ? "text-emerald-700" : "text-red-600";
  }

  const fmtDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="p-4 border-t border-indigo-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
          {p.name}
        </h4>
        <div className="flex items-center gap-2">
          {readOnly ? (
            <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">Vista histórica</span>
          ) : editMode ? (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-semibold hover:bg-indigo-700 transition-colors"
              >
                {t.cor_save_fields}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-600 rounded-lg text-[10px] font-semibold hover:bg-gray-50 transition-colors"
              >
                {t.cor_cancel_edit}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-300 text-indigo-600 rounded-lg text-[10px] font-semibold hover:bg-indigo-50 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {t.cor_edit_fields}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* ── Left: General Info + Highlights ──────────────────────────── */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">{t.cor_general_info}</h4>
              {!editMode && <span className="text-sm">{weather[draftR.overallStatus as WeatherKey]?.icon ?? "☁️"}</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <EF label={t.cor_client_label} value={draftP.client}      editMode={editMode} onChange={v => setP("client", v)} />
              <EF label="BM"                  value={draftP.manager}     editMode={editMode} onChange={v => setP("manager", v)} />
              <EF label="Team Leader"         value={draftP.leader}      editMode={editMode} onChange={v => setP("leader", v)} />
              <EF label={t.cor_phase_label}   value={draftR.phase}       editMode={editMode} onChange={v => setR("phase", v)} />
              <EF label={lang === "en" ? "IFS Code" : "Código IFS"} value={draftP.ifsCode}     editMode={editMode} onChange={v => setP("ifsCode", v)} />
              <EF label={t.cor_model_label}   value={draftP.serviceType} editMode={editMode} onChange={v => setP("serviceType", v)} />
              <EF label="FTEs"                value={draftR.ftes || draftP.teamSize} editMode={editMode} onChange={v => setR("ftes", v)} />
              <EF label="BU"                  value={draftP.bu}          editMode={editMode} onChange={v => setP("bu", v)} />
              <EF label={t.cor_start_label}   value={editMode ? draftP.startDate : fmtDate(draftP.startDate)} editMode={editMode} onChange={v => setP("startDate", v)} type="date" />
              <EF label={t.cor_end_label}     value={editMode ? draftP.endDate   : fmtDate(draftP.endDate)}   editMode={editMode} onChange={v => setP("endDate", v)} type="date" />
              {editMode && (
                <SEF label={t.cor_status_col} value={draftR.overallStatus} editMode={editMode} onChange={v => setR("overallStatus", v)} />
              )}
              <EF label="CSAT (1-4)"          value={draftR.csat}        editMode={editMode} onChange={v => setR("csat", v)} />
              <EF label="Team Mood (1-4)"     value={draftR.teamMood}    editMode={editMode} onChange={v => setR("teamMood", v)} />
            </div>
          </div>

          {/* Highlights */}
          <div className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50/50 transition-colors"
              onClick={() => setHighlightsOpen(o => !o)}
            >
              <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Highlights</h4>
              {highlightsOpen || editMode ? <ChevronDown className="w-3 h-3 text-indigo-400" /> : <ChevronRight className="w-3 h-3 text-indigo-400" />}
            </button>
            {(highlightsOpen || editMode) && (
              <div className="px-3 pb-3 space-y-2">
                {editMode ? (
                  <>
                    <EF label={t.cor_achievements_label} value={draftR.achievements}  editMode onChange={v => setR("achievements", v)} textarea />
                    <EF label={t.cor_issues_label}        value={draftR.currentIssues} editMode onChange={v => setR("currentIssues", v)} textarea />
                    <EF label={t.cor_comment_label}       value={draftP.shortComment}  editMode onChange={v => setP("shortComment", v)} textarea />
                  </>
                ) : (
                  <>
                    <div><p className="text-[9px] font-semibold text-emerald-700 mb-0.5">{t.cor_achievements_label}</p>{draftR.achievements ? <BulletList text={draftR.achievements} /> : <p className="text-[10px] text-muted-foreground italic">—</p>}</div>
                    <div><p className="text-[9px] font-semibold text-amber-700 mb-0.5">{t.cor_issues_label}</p>{draftR.currentIssues ? <BulletList text={draftR.currentIssues} /> : <p className="text-[10px] text-muted-foreground italic">—</p>}</div>
                    <div><p className="text-[9px] font-semibold text-muted-foreground mb-0.5">{t.cor_comment_label}</p>{draftP.shortComment ? <BulletList text={draftP.shortComment} /> : <p className="text-[10px] text-muted-foreground italic">—</p>}</div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ── Center: Financial KPIs + Improvement Plan ─────────────────── */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide mb-2">Financial KPIs</h4>
            {editMode ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <NumericInput label="Revenue (Month)"    value={draftP.revenueMonthly}    onChange={v => setP("revenueMonthly", v)} />
                <NumericInput label="Cost (Month)"      value={draftP.costMonthly}        onChange={v => setP("costMonthly", v)} />
                <NumericInput label="Revenue YTD"       value={draftP.revenue}            onChange={v => setP("revenue", v)} />
                <NumericInput label="Cost YTD"          value={draftP.spent}              onChange={v => setP("spent", v)} />
                <NumericInput label="FY Revenue Proj."  value={draftP.revenueProjection}  onChange={v => setP("revenueProjection", v)} />
                <NumericInput label="FY Cost Proj."     value={draftP.costProjection}     onChange={v => setP("costProjection", v)} />
                {draftP.serviceType === "Fixed Price" && <>
                  <EF label="Progress %"      value={draftP.progress}         editMode onChange={v => setP("progress", v)} />
                  <EF label="Planned Progress %" value={draftP.expectedProgress} editMode onChange={v => setP("expectedProgress", v)} />
                </>}
              </div>
            ) : (
              <table className="w-full text-[9px]">
                <thead>
                  <tr>
                    <th className="text-left font-semibold text-muted-foreground py-1 pr-2 border-b border-gray-200">KPI</th>
                    <th className="text-right font-semibold text-muted-foreground py-1 px-1 border-b border-gray-200">{lang === "en" ? "Monthly" : "Mensual"}</th>
                    <th className="text-right font-semibold text-muted-foreground py-1 px-1 border-b border-gray-200">{lang === "en" ? "YTD Actual" : "Real YTD"}</th>
                    <th className="text-right font-semibold text-muted-foreground py-1 pl-1 border-b border-gray-200">{lang === "en" ? "FY Projection" : "Proyección FY"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-1 pr-2 font-medium">{lang === "en" ? "Revenue" : "Producción"}</td>
                    <td className="py-1 px-1 text-right">{fmtCLP(revMes||null)}</td>
                    <td className="py-1 px-1 text-right font-semibold">{fmtCLP(rev||null)}</td>
                    <td className="py-1 pl-1 text-right">{fmtCLP(revProj||null)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium">{lang === "en" ? "Cost" : "Costo"}</td>
                    <td className="py-1 px-1 text-right">{fmtCLP(costMes||null)}</td>
                    <td className="py-1 px-1 text-right font-semibold">{fmtCLP(cost||null)}</td>
                    <td className="py-1 pl-1 text-right">{fmtCLP(costProj||null)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium">{lang === "en" ? "Profit" : "Ganancia"}</td>
                    <td className={`py-1 px-1 text-right ${ganMes!==null&&ganMes<0?"text-red-600":""}`}>{fmtCLP(ganMes)}</td>
                    <td className={`py-1 px-1 text-right font-semibold ${ganYTD!==null&&ganYTD<0?"text-red-600":""}`}>{fmtCLP(ganYTD)}</td>
                    <td className={`py-1 pl-1 text-right ${ganProj!==null&&ganProj<0?"text-red-600":""}`}>{fmtCLP(ganProj)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium">Gross Margin</td>
                    <td className={`py-1 px-1 text-right ${mrgMes!==null?(mrgMes>=34?"text-emerald-700":mrgMes>=25?"text-amber-700":"text-red-600"):"text-gray-400"}`}>{fmtPct(mrgMes)}</td>
                    <td className={`py-1 px-1 text-right font-semibold ${mrgYTD!==null?(mrgYTD>=34?"text-emerald-700":mrgYTD>=25?"text-amber-700":"text-red-600"):"text-gray-400"}`}>{fmtPct(mrgYTD)}</td>
                    <td className={`py-1 pl-1 text-right ${mrgProj!==null?(mrgProj>=34?"text-emerald-700":mrgProj>=25?"text-amber-700":"text-red-600"):"text-gray-400"}`}>{fmtPct(mrgProj)}</td>
                  </tr>
                  <tr className="bg-indigo-50/50">
                    <td className="py-1 pr-2 font-bold text-indigo-700">TMD <span className="text-gray-400 font-normal">(vs 34%)</span></td>
                    <td className={`py-1 px-1 text-right font-semibold ${devClass(tmdMes)}`}>{fmtDev(tmdMes)}</td>
                    <td className={`py-1 px-1 text-right font-bold ${devClass(tmdYTD)}`}>{fmtDev(tmdYTD)}</td>
                    <td className={`py-1 pl-1 text-right font-semibold ${devClass(tmdProj)}`}>{fmtDev(tmdProj)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium">FTE Man-days</td>
                    <td className="py-1 px-1 text-right text-gray-400">—</td>
                    <td className="py-1 px-1 text-right font-semibold">{draftR.ftes||draftP.teamSize||"—"}</td>
                    <td className="py-1 pl-1 text-right text-gray-400">—</td>
                  </tr>
                  {draftP.serviceType === "Fixed Price" && (
                  <tr>
                    <td className="py-1 pr-2 font-medium">{t.cor_progress_kpi}</td>
                    <td className="py-1 px-1 text-right">{draftP.expectedProgress||"0"}%</td>
                    <td className="py-1 px-1 text-right font-semibold">{draftP.progress}%</td>
                    <td className={`py-1 pl-1 text-right font-semibold ${parseInt(draftP.progress)>=(parseInt(draftP.expectedProgress)||0)?"text-emerald-700":"text-red-600"}`}>
                      {draftP.expectedProgress
                        ? `${parseInt(draftP.progress)-(parseInt(draftP.expectedProgress)||0)>0?"+":""}${parseInt(draftP.progress)-(parseInt(draftP.expectedProgress)||0)}pp`
                        : "—"}
                    </td>
                  </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Improvement Plan */}
          <div className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50/50 transition-colors"
              onClick={() => setImprovementOpen(o => !o)}
            >
              <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Improvement Plan</h4>
              {improvementOpen || editMode ? <ChevronDown className="w-3 h-3 text-indigo-400" /> : <ChevronRight className="w-3 h-3 text-indigo-400" />}
            </button>
            {(improvementOpen || editMode) && (
              <div className="px-3 pb-3 space-y-2">
                {editMode ? (
                  <>
                    <EF label="Actions in Progress"  value={draftR.actionsInProgress}    editMode onChange={v => setR("actionsInProgress", v)} textarea />
                    <EF label="Next Steps"            value={draftR.nextSteps}             editMode onChange={v => setR("nextSteps", v)} textarea />
                    <EF label="Margin Improvement"    value={draftR.marginImprovement}     editMode onChange={v => setR("marginImprovement", v)} textarea />
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">Actions in Progress</p>
                      {draftR.actionsInProgress
                        ? draftR.actionsInProgress.split(/[;\n]/).filter(Boolean).slice(0,6).map((a, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-[9px] font-bold text-indigo-500 flex-shrink-0 mt-0.5">{String(i+1).padStart(2,"0")}</span>
                              <span className="text-[10px] text-muted-foreground leading-tight">{a.trim()}</span>
                            </div>
                          ))
                        : <p className="text-[10px] text-muted-foreground italic">—</p>}
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">Next Steps</p>
                      {draftR.nextSteps
                        ? draftR.nextSteps.split(/[;\n]/).filter(Boolean).slice(0,6).map((a, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-[9px] font-bold text-indigo-500 flex-shrink-0 mt-0.5">{String(i+1).padStart(2,"0")}</span>
                              <span className="text-[10px] text-muted-foreground leading-tight">{a.trim()}</span>
                            </div>
                          ))
                        : <p className="text-[10px] text-muted-foreground italic">—</p>}
                    </div>
                    <div className="pt-1 border-t border-gray-100">
                      <p className="text-[9px] font-semibold text-emerald-700 mb-0.5">Margin Improvement</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{draftR.marginImprovement || "—"}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FTEs / Consultores */}
          <div className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50/50 transition-colors"
              onClick={() => setFtesOpen(o => !o)}
            >
              <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">
                FTEs {projectFTEs.length > 0 && <span className="ml-1 text-indigo-400 font-normal">({projectFTEs.length})</span>}
              </h4>
              {ftesOpen ? <ChevronDown className="w-3 h-3 text-indigo-400" /> : <ChevronRight className="w-3 h-3 text-indigo-400" />}
            </button>
            {ftesOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {projectFTEs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">No consultants assigned. Assign them in Team → Directory.</p>
                ) : projectFTEs.map(m => (
                  <div key={m.id} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {m.avatar || m.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-[9px] text-muted-foreground">{m.role}</p>
                    </div>
                    {m.projectEndDates?.[p.id] && (
                      <span className="text-[8px] text-muted-foreground flex-shrink-0">
                        until {new Date(m.projectEndDates[p.id]).toLocaleDateString("en-US",{day:"2-digit",month:"short"})}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: OTD/OQD + Health + Risks ──────────────────────────── */}
        <div className="space-y-3">

          {/* OTD / OQD */}
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide mb-3">{t.cor_otd_global} &amp; {t.cor_oqd_global}</h4>
            {editMode ? (
              <div className="grid grid-cols-2 gap-3">
                <EF label="OTD %" value={draftP.csvOtdPercent} editMode={editMode} onChange={v => setP("csvOtdPercent", v)} />
                <EF label="OQD %" value={draftP.csvOqdPercent} editMode={editMode} onChange={v => setP("csvOqdPercent", v)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "OTD", val: otdVal },
                  { label: "OQD", val: oqdVal },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-lg p-3 text-center border border-gray-200">
                    <p className="text-[9px] font-semibold text-muted-foreground mb-1">{label}</p>
                    <p className={`text-2xl font-bold leading-none ${val===null?"text-gray-400":val>=95?"text-emerald-700":val>=80?"text-amber-600":"text-red-600"}`}>
                      {val!==null?`${Math.round(val)}%`:t.cor_nd}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">Target ≥ 95%</p>
                    <div className={`mt-1.5 text-xs ${val===null?"":val>=95?"text-emerald-700":val>=80?"text-amber-700":"text-red-700"}`}>
                      {val===null?"—":val>=95?"✅ OK":val>=80?"⚠️ Riesgo":"❌ KO"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Health Indicators */}
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide mb-2">Health Indicators</h4>
            <div className="space-y-2">
              {(["currentStatus","milestonesStatus","resourcesStatus","issuesStatus","risksStatus"] as const).map((field, idx) => {
                const labels = ["Delivery","Governance","Resources","Issues","Risks"];
                const w = weather[draftR[field] as WeatherKey] ?? weather.grey;
                return (
                  <div key={field} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground w-20 flex-shrink-0">{labels[idx]}</span>
                    {editMode ? (
                      <select
                        value={draftR[field]}
                        onChange={e => setR(field, e.target.value)}
                        className="flex-1 text-[9px] border border-indigo-200 rounded px-1 py-0.5 bg-white"
                      >
                        <option value="G">☀️ On Track</option>
                        <option value="A">⛅ At Risk</option>
                        <option value="R">⛈️ Critical</option>
                        <option value="grey">☁️ N/A</option>
                        <option value="B">🌤️ Stable</option>
                        <option value="done">✅ Done</option>
                      </select>
                    ) : (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium border ${w.bg} ${w.text} ${w.border}`}>
                        {w.icon} {w.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risks & Mitigation */}
          <div className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-red-50/50 transition-colors"
              onClick={() => setRisksOpen(o => !o)}
            >
              <h4 className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Key Risks</h4>
              {risksOpen || editMode ? <ChevronDown className="w-3 h-3 text-red-400" /> : <ChevronRight className="w-3 h-3 text-red-400" />}
            </button>
            {(risksOpen || editMode) && (
              <div className="px-3 pb-3 space-y-2">
                {editMode ? (
                  <>
                    <EF label="Key Risks"        value={draftR.keyRisks}   editMode onChange={v => setR("keyRisks", v)} textarea />
                    <EF label={t.cor_mitigation_label} value={draftR.mitigation} editMode onChange={v => setR("mitigation", v)} textarea />
                  </>
                ) : (
                  <>
                    <p className="text-[9px] font-semibold text-red-700 mb-0.5">Key Risks</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{draftR.keyRisks || "—"}</p>
                    <p className="text-[9px] font-semibold text-amber-700 mt-1.5 mb-0.5">{t.cor_mitigation_label}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{draftR.mitigation || "—"}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal confirmación guardar ──────────────────────────────────── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-indigo-100">
            <h3 className="text-sm font-bold text-gray-800 mb-1">{lang === "en" ? "Confirm changes?" : "¿Confirmar cambios?"}</h3>
            <p className="text-xs text-muted-foreground mb-5">{lang === "en" ? <>All changes to <strong>{p.name}</strong> will be saved.</> : <>Se guardarán todos los cambios realizados en <strong>{p.name}</strong>.</>}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {lang === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                {lang === "en" ? "Confirm & save" : "Confirmar y guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast éxito ─────────────────────────────────────────────────── */}
      {saveSuccess && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" /> {lang === "en" ? "Changes saved successfully!" : "¡Cambios guardados con éxito!"}
        </div>
      )}
    </div>
  );
}
// ── New Service Modal ────────────────────────────────────────────────────────

const EMPTY_NEW_SERVICE = {
  name: "", client: "", manager: "", leader: "",
  serviceType: "", serviceLevel: "", bu: "",
  status: "active" as import("@/types").ProjectStatus,
  startDate: "", endDate: "",
};

function NewServiceModal({ onClose, onSave }: { onClose: () => void; onSave: (p: import("@/types").Project) => void }) {
  const [form, setForm] = useState(EMPTY_NEW_SERVICE);
  const t = useT();
  const { knownLeaders, knownManagers } = useData();

  function setF(k: keyof typeof EMPTY_NEW_SERVICE, v: string) {
    setForm(d => ({ ...d, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const project: import("@/types").Project = {
      id: `manual-${Date.now()}`,
      name: form.name.trim(),
      status: form.status,
      progress: 0,
      budget: 0,
      spent: 0,
      revenue: 0,
      startDate: form.startDate || new Date().toISOString().slice(0, 10),
      endDate: form.endDate || "",
      teamSize: 0,
      tasksTotal: 0,
      tasksDone: 0,
      manager: form.manager,
      client: form.client || undefined,
      leader: form.leader || undefined,
      serviceType: form.serviceType || undefined,
      serviceLevel: form.serviceLevel || undefined,
      bu: form.bu || undefined,
    };
    onSave(project);
    onClose();
  }

  const STATUS_OPTIONS: import("@/types").ProjectStatus[] = ["active","at-risk","on-hold","guarantee","delayed","terminated","completed"];
  const STATUS_LABELS: Record<string, string> = {
    active: t.status_active, "at-risk": t.status_at_risk, "on-hold": t.status_on_hold,
    guarantee: t.status_guarantee, delayed: t.status_delayed, terminated: t.status_terminated, completed: t.status_completed,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-indigo-800">{t.pf_new_service}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">
              Nombre del Servicio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setF("name", e.target.value)}
              required
              placeholder="Ej: Soporte Producción Transbank"
              className="w-full text-[11px] border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Cliente y BU: texto libre */}
            {([
              { label: t.cor_client_label, key: "client" as const, ph: "Nombre cliente" },
              { label: "BU",               key: "bu" as const,      ph: "Business Unit"  },
              { label: t.cor_model_label,  key: "serviceType" as const, ph: "Ej: Competence Center" },
            ] as { label: string; key: keyof typeof EMPTY_NEW_SERVICE; ph: string }[]).map(({ label, key, ph }) => (
              <div key={key}>
                <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">{label}</label>
                <input
                  type="text"
                  value={form[key]}
                  onChange={e => setF(key, e.target.value)}
                  placeholder={ph}
                  className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ))}

            {/* BM — dropdown */}
            <div>
              <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">BM / Manager</label>
              <select
                value={form.manager}
                onChange={e => setF("manager", e.target.value)}
                className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">— Seleccionar BM —</option>
                {knownManagers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {knownManagers.length === 0 && (
                <p className="text-[9px] text-amber-600 mt-0.5">Agrega BMs en la sección Equipo → Directorio</p>
              )}
            </div>

            {/* Team Leader — dropdown */}
            <div>
              <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">Team Leader</label>
              <select
                value={form.leader}
                onChange={e => setF("leader", e.target.value)}
                className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">— Seleccionar Team Leader —</option>
                {knownLeaders.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {knownLeaders.length === 0 && (
                <p className="text-[9px] text-amber-600 mt-0.5">Agrega Team Leaders en la sección Equipo → Directorio</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">Estado</label>
              <select
                value={form.status}
                onChange={e => setF("status", e.target.value)}
                className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">{t.cor_start_label}</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setF("startDate", e.target.value)}
                className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">{t.cor_end_label}</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setF("endDate", e.target.value)}
                className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[11px] font-semibold border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!form.name.trim()}
              className="px-4 py-2 text-[11px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Agregar Servicio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── COR View ─────────────────────────────────────────────────────────────────

function ReportMonthLabel({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);

  function save() {
    onChange(draft.trim() || value);
    setEditing(false);
  }

  if (editing && !readOnly) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground font-medium">{t.report_month_label}</span>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="text-[11px] border border-primary/40 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => { if (!readOnly) { setDraft(value); setEditing(true); } }}
      className={`flex items-center gap-1 text-[11px] text-muted-foreground ${readOnly ? "" : "hover:text-foreground group"}`}
    >
      <span className="font-medium">{t.report_month_label} {value}</span>
      {!readOnly && <span className="opacity-0 group-hover:opacity-50 text-[9px]">✏️</span>}
    </button>
  );
}

function CORView() {
  const { projects: liveProjects, teamMembers: liveTeamMembers, reportData: liveReportData, updateProject, updateReport, addProject, isDefaultData } = useData();
  const t = useT();
  const { lang } = useLang();
  const WEATHER = useMemo(() => makeWeather(t), [t]);

  const [selectedId, setSelectedId]  = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Snapshots ─────────────────────────────────────────────────────────
  const [snapshots,        setSnapshots]        = useState<SnapshotMeta[]>([]);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | "live">("live");
  const [snapshotData,     setSnapshotData]     = useState<SnapshotFull | null>(null);
  const [snapshotLoading,  setSnapshotLoading]  = useState(false);
  const [snapshotStatus,   setSnapshotStatus]   = useState<string>("");

  // Datos activos: live o snapshot
  const projects    = snapshotData ? snapshotData.projects    : liveProjects;
  const reportData  = snapshotData ? snapshotData.report_data : liveReportData;
  const isHistorical = activeSnapshotId !== "live" && snapshots.some(s => s.id === activeSnapshotId && s.snapshot_date !== getLastMonday());

  // ── Month selector for KPI cards ──────────────────────────────────────
  const [kpiMonth, setKpiMonth] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  const kpiMonthProjects = useMemo(() => {
    const [y, m] = kpiMonth.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay  = new Date(y, m, 0);
    return projects.filter(p => {
      const start = p.startDate ? new Date(p.startDate + "T00:00:00") : null;
      const end   = p.endDate   ? new Date(p.endDate   + "T00:00:00") : null;
      return (!start || start <= lastDay) && (!end || end >= firstDay);
    });
  }, [projects, kpiMonth]);

  const kpiMonthLabel = useMemo(() => {
    const [y, m] = kpiMonth.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { month: "long", year: "numeric" });
  }, [kpiMonth, lang]);

  // Cargar lista de snapshots al montar
  useEffect(() => {
    fetch("/api/snapshots")
      .then(r => r.json())
      .then((list: SnapshotMeta[]) => setSnapshots(list))
      .catch(() => {});
  }, []);

  // Auto-limpiar campos semanales al inicio de nueva semana
  // Usa cor_settings["weekly_clear_date"] en Supabase como fuente de verdad compartida
  // (independiente de fechas de snapshots, funciona para todos los usuarios)
  const WEEKLY_CLEAR_FIELDS: Array<keyof ProjectReport> = [
    "achievements", "currentIssues", "actionsInProgress",
    "nextSteps", "marginImprovement", "keyRisks", "mitigation",
  ];
  const weekClearedRef = useRef(false);
  useEffect(() => {
    if (isDefaultData || liveProjects.length === 0) return;
    if (weekClearedRef.current) return;
    const currentMonday = getLastMonday();
    fetch("/api/settings/weekly-clear")
      .then(r => r.json())
      .then((stored: string | null) => {
        if ((stored ?? "") >= currentMonday) return; // already cleared this week
        weekClearedRef.current = true;
        // Clear fields for all projects
        liveProjects.forEach(p => {
          const clearFields = {} as Partial<ProjectReport>;
          WEEKLY_CLEAR_FIELDS.forEach(f => { (clearFields as Record<string, string>)[f] = ""; });
          updateReport(p.id, clearFields);
          updateProject(p.id, { shortComment: "" });
        });
        // Persist the clear date so all users see it
        fetch("/api/settings/weekly-clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentMonday),
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveProjects.length, isDefaultData]);

  // Auto-snapshot: crea/actualiza snapshot de la semana actual con los datos en vivo
  // Se dispara al cargar la app, al cargar un CSV, o cuando cambian revenue/cost de proyectos
  const snapshotDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSnapshotHashRef = useRef("");
  const projectsHash = useMemo(
    () => liveProjects.reduce((h, p) => h + (p.revenue || 0) + (p.spent || 0) + (p.id || "").length, 0).toString() + liveProjects.length,
    [liveProjects]
  );
  useEffect(() => {
    if (isDefaultData || liveProjects.length === 0) return;
    if (projectsHash === prevSnapshotHashRef.current) return;
    if (snapshotDebounceRef.current) clearTimeout(snapshotDebounceRef.current);
    snapshotDebounceRef.current = setTimeout(() => {
      prevSnapshotHashRef.current = projectsHash;
      const todayDate = getLastMonday();
      const week_label = formatWeekLabel(todayDate);
      let corManual: CORManual | null = null;
      try { const s = localStorage.getItem(COR_MANUAL_KEY); if (s) corManual = JSON.parse(s); } catch {}
      setSnapshotStatus("Saving weekly snapshot...");
      fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_date: todayDate, week_label, projects: liveProjects, report_data: liveReportData, cor_manual: { ...(corManual ?? {}), teamMembers: liveTeamMembers } }),
      })
        .then(r => r.json())
        .then((newSnap: SnapshotMeta) => {
          setSnapshots(prev => [newSnap, ...prev.filter(s => s.snapshot_date !== newSnap.snapshot_date)]);
          setSnapshotStatus("✓ Snapshot guardado");
          setTimeout(() => setSnapshotStatus(""), 3000);
        })
        .catch(() => setSnapshotStatus(""));
    }, 8000); // 8s debounce — waits for Supabase sync to settle before saving snapshot
    return () => { if (snapshotDebounceRef.current) clearTimeout(snapshotDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsHash, isDefaultData]);

  // Al cambiar snapshot seleccionado, cargar datos completos
  // "live" siempre muestra datos en tiempo real (nunca carga snapshot)
  useEffect(() => {
    if (activeSnapshotId === "live") {
      setSnapshotData(null);
      return;
    }
    setSnapshotLoading(true);
    fetch(`/api/snapshots/${activeSnapshotId}`)
      .then(r => r.json())
      .then((d: SnapshotFull) => setSnapshotData(d))
      .catch(() => setSnapshotData(null))
      .finally(() => setSnapshotLoading(false));
  }, [activeSnapshotId, snapshots]);

  // ── Table filters ─────────────────────────────────────────────────────
  const [fltStatus,  setFltStatus]  = useState<string[]>([]);
  const [fltClient,  setFltClient]  = useState<string[]>([]);
  const [fltLeader,  setFltLeader]  = useState<string[]>([]);
  const [fltManager, setFltManager] = useState<string[]>([]);
  const [fltType,    setFltType]    = useState<string[]>([]);

  // ── Table sorting ──────────────────────────────────────────────────────
  type SortField = "client"|"name"|"serviceType"|"startDate"|"endDate"|"leader"|"ftes"|"revenue"|"margin"|"tmd"|"otd"|"oqd"|"csat"|"status"|"trend";

  // Prioridad de status (mayor = mejor)
  const STATUS_RANK: Record<string, number> = { G:5, B:4, grey:3, A:2, R:1, done:0 };
  const [sortField, setSortField] = useState<SortField|null>(null);
  const [sortDir,   setSortDir]   = useState<"asc"|"desc">("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  // ── Manual override state ─────────────────────────────────────────────
  const [overrideMode, setOverrideMode] = useState(false);
  const [manualData, setManualData] = useState<CORManual>(EMPTY_MANUAL);
  const [draftManual, setDraftManual] = useState<CORManual>(EMPTY_MANUAL);

  // Load manualData from localStorage after mount (avoids SSR/hydration mismatch)
  // En modo histórico, usa el cor_manual del snapshot
  useEffect(() => {
    if (snapshotData) {
      setManualData(snapshotData.cor_manual ?? EMPTY_MANUAL);
      return;
    }
    // Modo live: cargar desde Supabase con migración automática desde localStorage
    fetch("/api/settings/cor-manual")
      .then(r => r.json())
      .then((remote: CORManual | null) => {
        if (remote && Object.values(remote).some(v => v !== "")) {
          setManualData(remote);
          try { localStorage.setItem(COR_MANUAL_KEY, JSON.stringify(remote)); } catch {}
        } else {
          // Supabase vacío → migrar desde localStorage
          try {
            const local = localStorage.getItem(COR_MANUAL_KEY);
            if (local) {
              const parsed: CORManual = JSON.parse(local);
              setManualData(parsed);
              fetch("/api/settings/cor-manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed),
              });
            }
          } catch {}
        }
      })
      .catch(() => {
        try {
          const s = localStorage.getItem(COR_MANUAL_KEY);
          if (s) setManualData(JSON.parse(s));
        } catch {}
      });
  }, [snapshotData]);
  const hasManual = Object.values(manualData).some(v => v !== "");

  const [confirmKPI,   setConfirmKPI]   = useState(false);
  const [kpiSuccess,   setKpiSuccess]   = useState(false);

  function openOverride() { setDraftManual({ ...manualData }); setOverrideMode(true); }
  function saveOverride() { setConfirmKPI(true); }
  function handleConfirmKPI() {
    setManualData(draftManual);
    try { localStorage.setItem(COR_MANUAL_KEY, JSON.stringify(draftManual)); } catch {}
    // Guardar en Supabase
    fetch("/api/settings/cor-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftManual),
    });
    setConfirmKPI(false);
    setOverrideMode(false);
    setKpiSuccess(true);
    setTimeout(() => setKpiSuccess(false), 3000);
  }
  function cancelOverride() { setOverrideMode(false); }
  function handleReportMonthChange(v: string) {
    const u = { ...manualData, reportMonth: v };
    setManualData(u);
    try { localStorage.setItem(COR_MANUAL_KEY, JSON.stringify(u)); } catch {}
    fetch("/api/settings/cor-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(u),
    });
  }
  function clearOverride() {
    setManualData(EMPTY_MANUAL);
    setDraftManual(EMPTY_MANUAL);
    try { localStorage.removeItem(COR_MANUAL_KEY); } catch {}
    fetch("/api/settings/cor-manual", { method: "DELETE" });
  }
  function setDM(k: keyof CORManual, v: string) { setDraftManual(d => ({ ...d, [k]: v })); }

  const today = new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day: "2-digit", month: "long", year: "numeric" });

  // ── Filter options ────────────────────────────────────────────────────
  const clientOpts  = useMemo(() => [...new Set(projects.map(p => p.client).filter(Boolean))].sort() as string[], [projects]);
  // Deduplicar líderes normalizando tildes y espacios para evitar duplicados por typos
  const leaderOpts  = useMemo(() => {
    const seen = new Map<string, string>();
    projects.forEach(p => {
      if (!p.leader) return;
      const key = p.leader.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (!seen.has(key)) seen.set(key, p.leader.trim());
    });
    return [...seen.values()].sort();
  }, [projects]);
  const managerOpts = useMemo(() => [...new Set(projects.map(p => p.manager).filter(Boolean))].sort() as string[], [projects]);
  const typeOpts    = useMemo(() => [...new Set(projects.map(p => p.serviceType).filter(Boolean))].sort() as string[], [projects]);

  const weatherStatusOpts = useMemo(() => [
    { value: "G",    label: `☀️ ${WEATHER.G.label}`    },
    { value: "A",    label: `⛅ ${WEATHER.A.label}`    },
    { value: "R",    label: `⛈️ ${WEATHER.R.label}`   },
    { value: "B",    label: `🌤️ ${WEATHER.B.label}`   },
    { value: "grey", label: `☁️ ${WEATHER.grey.label}` },
    { value: "done", label: `✅ ${WEATHER.done.label}` },
  ], [WEATHER]);

  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(p => {
      const status = reportData[p.id]?.overallStatus ?? "grey";
      if (fltStatus.length  && !fltStatus.includes(status))           return false;
      if (fltClient.length  && !fltClient.includes(p.client ?? ""))   return false;
      if (fltLeader.length  && !fltLeader.includes(p.leader ?? ""))   return false;
      if (fltManager.length && !fltManager.includes(p.manager ?? "")) return false;
      if (fltType.length    && !fltType.includes(p.serviceType ?? "")) return false;
      return true;
    });

    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      const rep_a = reportData[a.id];
      const rep_b = reportData[b.id];
      let va: string|number = "";
      let vb: string|number = "";

      if (sortField === "client")      { va = a.client ?? ""; vb = b.client ?? ""; }
      else if (sortField === "name")   { va = a.name ?? ""; vb = b.name ?? ""; }
      else if (sortField === "serviceType") { va = a.serviceType ?? ""; vb = b.serviceType ?? ""; }
      else if (sortField === "startDate") { va = a.startDate ?? ""; vb = b.startDate ?? ""; }
      else if (sortField === "endDate")   { va = a.endDate ?? ""; vb = b.endDate ?? ""; }
      else if (sortField === "leader") { va = a.leader ?? ""; vb = b.leader ?? ""; }
      else if (sortField === "ftes")   { va = parseFloat(rep_a?.ftes || String(a.teamSize||0))||0; vb = parseFloat(rep_b?.ftes || String(b.teamSize||0))||0; }
      else if (sortField === "revenue"){ va = a.revenue||0; vb = b.revenue||0; }
      else if (sortField === "margin") {
        va = rep_a?.marginYTD ? (parsePercent(rep_a.marginYTD)??-999) : a.revenue>0 ? Math.round((a.revenue-a.spent)/a.revenue*100) : -999;
        vb = rep_b?.marginYTD ? (parsePercent(rep_b.marginYTD)??-999) : b.revenue>0 ? Math.round((b.revenue-b.spent)/b.revenue*100) : -999;
      }
      else if (sortField === "tmd")  {
        const ma = rep_a?.marginYTD ? (parsePercent(rep_a.marginYTD)??null) : a.revenue>0 ? Math.round((a.revenue-a.spent)/a.revenue*100) : null;
        const mb = rep_b?.marginYTD ? (parsePercent(rep_b.marginYTD)??null) : b.revenue>0 ? Math.round((b.revenue-b.spent)/b.revenue*100) : null;
        va = ma !== null ? ma - 34 : -999; vb = mb !== null ? mb - 34 : -999;
      }
      else if (sortField === "otd")    { va = parsePercent(a.csvOtdPercent)??-1; vb = parsePercent(b.csvOtdPercent)??-1; }
      else if (sortField === "oqd")    { va = parsePercent(a.csvOqdPercent)??-1; vb = parsePercent(b.csvOqdPercent)??-1; }
      else if (sortField === "csat")   { va = parseFloat(csatFromHealth(rep_a?.healthGovernance))||0; vb = parseFloat(csatFromHealth(rep_b?.healthGovernance))||0; }
      else if (sortField === "status") { va = rep_a?.overallStatus??"grey"; vb = rep_b?.overallStatus??"grey"; }
      else if (sortField === "trend")  {
        va = rep_a ? (STATUS_RANK[rep_a.overallStatus??'grey']||3) - (STATUS_RANK[rep_a.previousStatus??'grey']||3) : 0;
        vb = rep_b ? (STATUS_RANK[rep_b.overallStatus??'grey']||3) - (STATUS_RANK[rep_b.previousStatus??'grey']||3) : 0;
      }

      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number)-(vb as number) : (vb as number)-(va as number);
    });
  }, [projects, reportData, fltStatus, fltClient, fltLeader, fltManager, fltType, sortField, sortDir]);

  const hasTableFilters = !!(fltStatus.length || fltClient.length || fltLeader.length || fltManager.length || fltType.length);

  function clearTableFilters() {
    setFltStatus([]); setFltClient([]); setFltLeader([]); setFltManager([]); setFltType([]);
  }

  // ── Calculated KPIs (from month-filtered project data) ─────────────────
  const corKPIsCalc = useMemo(() => {
    // Financial KPIs: all services active in the selected month
    const totalRevenue = kpiMonthProjects.reduce((s, p) => s + (p.revenue || 0), 0);
    const totalCost    = kpiMonthProjects.reduce((s, p) => s + (p.spent   || 0), 0);
    const grossMargin  = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    // OTD/OQD: only non-completed, non-terminated, non-on-hold within the month
    const live = kpiMonthProjects.filter(p => !["completed","terminated","on-hold","guarantee"].includes(p.status));
    const otdVals = live.map(p => parsePercent(p.csvOtdPercent)).filter((v): v is number => v !== null);
    const oqdVals = live.map(p => parsePercent(p.csvOqdPercent)).filter((v): v is number => v !== null);
    const avgOTD  = otdVals.length ? otdVals.reduce((s,v) => s+v, 0) / otdVals.length : null;
    const avgOQD  = oqdVals.length ? oqdVals.reduce((s,v) => s+v, 0) / oqdVals.length : null;
    // Weather counts: only live services
    const wc = { G: 0, A: 0, R: 0, grey: 0, done: 0 };
    live.forEach(p => { const k = reportData[p.id]?.overallStatus ?? "grey"; if (k in wc) wc[k as keyof typeof wc]++; });
    return { totalRevenue, totalCost, grossMargin, avgOTD, avgOQD, activeCount: live.length, wc };
  }, [kpiMonthProjects, reportData]);

  // ── KPIs applying manual overrides ────────────────────────────────────
  const corKPIs = useMemo(() => {
    const rev  = manualData.revenue ? parseFloat(manualData.revenue) : corKPIsCalc.totalRevenue;
    const cost = manualData.cost    ? parseFloat(manualData.cost)    : corKPIsCalc.totalCost;
    const gm   = rev > 0 ? ((rev - cost) / rev) * 100 : 0;
    const otd  = manualData.otd ? parseFloat(manualData.otd) : corKPIsCalc.avgOTD;
    const oqd  = manualData.oqd ? parseFloat(manualData.oqd) : corKPIsCalc.avgOQD;
    return { totalRevenue: rev, totalCost: cost, grossMargin: gm, avgOTD: otd, avgOQD: oqd, activeCount: corKPIsCalc.activeCount, wc: corKPIsCalc.wc };
  }, [manualData, corKPIsCalc]);

  // ── Chart data (calculated) ────────────────────────────────────────────
  const customerDataCalc = useMemo(() => {
    const map: Record<string,number> = {};
    projects.forEach(p => { const k = p.client||"Sin Cliente"; map[k] = (map[k]||0)+(p.revenue||0); });
    const total = Object.values(map).reduce((s,v)=>s+v,0);
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value, pct: total>0?Math.round(value/total*100):0 }));
  }, [projects]);

  const translateSvcType = (s: string) => {
    if (lang !== "en") return s;
    const svcMap: Record<string, string> = {
      "Soporte": "Support", "Otro": "Other", "Desarrollo": "Development",
      "Consultoría": "Consulting", "Implementación": "Implementation",
    };
    return svcMap[s] || s;
  };

  const modelDataCalc = useMemo(() => {
    const map: Record<string,number> = {};
    projects.forEach(p => { const k = translateSvcType(p.serviceType||"Otro"); map[k] = (map[k]||0)+(p.revenue||0); });
    const total = Object.values(map).reduce((s,v)=>s+v,0);
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value, pct: total>0?Math.round(value/total*100):0 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, lang]);

  const marginBarDataCalc = useMemo(() =>
    [...projects].filter(p=>p.revenue>0)
      .sort((a,b) => (b.revenue-b.spent)/b.revenue - (a.revenue-a.spent)/a.revenue)
      .map(p => ({
        name:   p.name.length>16?p.name.slice(0,14)+"…":p.name,
        fullName: p.name,
        margin: Math.round(parseFloat(reportData[p.id]?.marginYTD?.replace("%","")||String(Math.round((p.revenue-p.spent)/p.revenue*100)))),
      })),
  [projects, reportData]);

  // ── Display data (manual override takes priority) ──────────────────────
  const customerData = useMemo(() => {
    if (!manualData.customers) return customerDataCalc;
    const items = parseCORCSV(manualData.customers);
    const total = items.reduce((s,d)=>s+d.value,0);
    return items.map(d => ({ ...d, pct: total>0?Math.round(d.value/total*100):0 }));
  }, [manualData.customers, customerDataCalc]);

  const modelData = useMemo(() => {
    if (!manualData.models) return modelDataCalc;
    const items = parseCORCSV(manualData.models);
    const total = items.reduce((s,d)=>s+d.value,0);
    return items.map(d => ({ ...d, pct: total>0?Math.round(d.value/total*100):0 }));
  }, [manualData.models, modelDataCalc]);

  const revenueBarData = useMemo(() =>
    modelData.map(d => ({ name: d.name.length>16?d.name.slice(0,14)+"…":d.name, revenue: d.value })),
  [modelData]);

  const marginBarData = marginBarDataCalc;

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedId), [projects, selectedId]);
  const selectedReport  = useMemo(() => selectedId ? reportData[selectedId] : undefined, [reportData, selectedId]);

  // ── Save cell edit ────────────────────────────────────────────────────
  // Ref always points to latest editingCell to avoid stale-closure on onBlur
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;

  const commitCell = useCallback(() => {
    const cell = editingCellRef.current;
    if (!cell) return;
    const { id, field, value } = cell;
    if (field === "otd")    updateProject(id, { csvOtdPercent: value ? value+"%" : "" });
    if (field === "oqd")    updateProject(id, { csvOqdPercent: value ? value+"%" : "" });
    if (field === "margin") updateReport(id, { marginYTD: value ? value+"%" : "" });
    if (field === "ftes")   updateReport(id, { ftes: value });
    if (field === "csat")   updateReport(id, { healthGovernance: value });
    setEditingCell(null);
  }, [updateProject, updateReport]);

  function cellInput(id: string, field: string, currentVal: string, isSelect?: boolean) {
    if (isHistorical) return null; // solo lectura en modo histórico
    const active = editingCell?.id === id && editingCell?.field === field;
    if (active) {
      if (field === "trend") {
        return (
          <select
            autoFocus
            value={editingCell.value}
            onChange={e => {
              const v = e.target.value;
              updateReport(id, { statusTrend: v === "" ? undefined : v as "up"|"same"|"down" });
              setEditingCell(null);
            }}
            onBlur={() => setEditingCell(null)}
            className="text-[9px] border border-indigo-300 rounded p-0.5 bg-white w-full"
          >
            <option value="">⬚ Auto</option>
            <option value="up">↗ Mejora</option>
            <option value="same">→ Sin cambio</option>
            <option value="down">↘ Baja</option>
          </select>
        );
      }
      if (isSelect) {
        return (
          <select
            autoFocus
            value={editingCell.value}
            onChange={e => {
              const newVal = e.target.value;
              if (field === "status") updateReport(id, { overallStatus: newVal as HealthStatus });
              setEditingCell(null);
            }}
            onBlur={() => setEditingCell(null)}
            className="text-[9px] border border-indigo-300 rounded p-0.5 bg-white w-full"
          >
            <option value="G">☀️ On Track</option>
            <option value="A">⛅ At Risk</option>
            <option value="R">⛈️ Critical</option>
            <option value="grey">☁️ N/A</option>
            <option value="B">🌤️ Stable</option>
            <option value="done">✅ Done</option>
          </select>
        );
      }
      return (
        <input
          autoFocus
          type="text"
          value={editingCell.value}
          onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
          onBlur={commitCell}
          onKeyDown={e => { if (e.key==="Enter") (e.target as HTMLInputElement).blur(); if (e.key==="Escape") setEditingCell(null); }}
          className="w-14 text-center text-[9px] border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      );
    }
    return null;
  }

  return (
    <div className="space-y-4">

      {/* ── COR Header ─────────────────────────────────────────────────── */}
      <PrintHeader title={t.cor_title} subtitle={t.cor_subtitle} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.cor_title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t.cor_subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-muted/40 border border-border px-3 py-1.5 rounded-lg">{today}</span>
          <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium px-3 py-1.5 rounded-lg">
            {projects.length} {t.pf_services}
          </span>
          {snapshotStatus && <span className="text-[10px] text-emerald-600 font-medium">{snapshotStatus}</span>}

          {/* ── Selector histórico ──────────────────────────────────── */}
          <div className="flex items-center gap-1.5">
            <History className="w-3 h-3 text-muted-foreground" />
            <select
              value={activeSnapshotId}
              onChange={e => { setActiveSnapshotId(e.target.value); setSelectedId(null); }}
              className="text-[11px] border border-border rounded-lg px-2 py-1.5 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-400 max-w-[200px]"
              disabled={snapshotLoading}
            >
              <option value="live">📡 {t.live_data}</option>
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>{lang === "en" ? translateWeekLabel(s.week_label) : s.week_label}</option>
              ))}
            </select>
            {snapshotLoading && <span className="text-[10px] text-muted-foreground animate-pulse">…</span>}
          </div>

          {/* ── Menú desplegable de acciones ───────────────────────── */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              {t.pf_actions}
              <ChevronDown className="w-3 h-3" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                {!isHistorical && (
                  <button
                    onClick={() => { setShowNewModal(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-500" />
                    {t.pf_new_service}
                  </button>
                )}
                {!isHistorical && (
                  <button
                    onClick={() => { openOverride(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-indigo-500" />
                    {t.pf_edit_overview}
                  </button>
                )}
                {hasManual && !isHistorical && (
                  <button
                    onClick={() => { clearOverride(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    <span className="text-sm leading-none">📊</span>
                    {t.pf_clear_manual}
                  </button>
                )}
                <div className="border-t border-border">
                  <PrintButton asMenuItem />
                </div>
                <CsvUploadMenuItems onClose={() => setMenuOpen(false)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Banner modo histórico ──────────────────────────────────────── */}
      {isHistorical && snapshotData && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 print:hidden">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-semibold text-amber-800">{t.historical_mode} — {lang === "en" ? translateWeekLabel(snapshotData.week_label) : snapshotData.week_label}</span>
            <span className="text-[10px] text-amber-600 ml-2">{t.historical_readonly} {t.historical_banner_sub}</span>
          </div>
          <button
            onClick={() => { setActiveSnapshotId("live"); setSnapshotData(null); }}
            className="text-[10px] font-semibold text-amber-700 border border-amber-400 bg-white px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors"
          >
            {t.back_to_live}
          </button>
        </div>
      )}

      {/* ── Manual Override Panel ──────────────────────────────────────── */}
      {!isHistorical && overrideMode && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wide">📊 Ingreso Manual de Datos del Overview</h3>
              <p className="text-[10px] text-indigo-600 mt-0.5">Los datos manuales tienen prioridad sobre los calculados automáticamente. Deja en blanco para usar el valor calculado.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDraftManual(EMPTY_MANUAL)}
                className="px-3 py-1 text-[10px] font-semibold border border-red-300 text-red-600 bg-white rounded-lg hover:bg-red-50 transition-colors"
              >
                🗑️ Limpiar todo
              </button>
              <button
                onClick={saveOverride}
                className="px-3 py-1 text-[10px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t.cor_save_fields}
              </button>
              <button
                onClick={cancelOverride}
                className="px-3 py-1 text-[10px] font-semibold border border-gray-300 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t.cor_cancel_edit}
              </button>
            </div>
          </div>

          {/* KPI global inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: `${t.cor_revenue_total_kpi} (número)`, key: "revenue" as const, ph: `ej: ${corKPIsCalc.totalRevenue.toFixed(0)}` },
              { label: `Costo Total (número)`,                 key: "cost"    as const, ph: `ej: ${corKPIsCalc.totalCost.toFixed(0)}` },
              { label: `OTD % (0-100)`,                        key: "otd"     as const, ph: `ej: ${corKPIsCalc.avgOTD!==null?corKPIsCalc.avgOTD.toFixed(1):"N/D"}` },
              { label: `OQD % (0-100)`,                        key: "oqd"     as const, ph: `ej: ${corKPIsCalc.avgOQD!==null?corKPIsCalc.avgOQD.toFixed(1):"N/D"}` },
            ].map(({ label, key, ph }) => (
              <div key={key} className="bg-white rounded-lg border border-indigo-200 p-2.5">
                <label className="text-[9px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">{label}</label>
                <input
                  type="text"
                  value={draftManual[key]}
                  onChange={e => setDM(key, e.target.value)}
                  placeholder={ph}
                  className="w-full text-[11px] border border-indigo-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              </div>
            ))}
          </div>

          {/* Chart data textareas */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Customer Delivery", key: "customers" as const, hint: "Una línea por cliente: Cliente,Revenue\nEj: Transbank,500000" },
              { label: "Delivery Model",    key: "models"    as const, hint: "Una línea por modelo: Modelo,Revenue\nEj: Fixed Price,300000" },
            ].map(({ label, key, hint }) => (
              <div key={key} className="bg-white rounded-lg border border-indigo-200 p-2.5">
                <label className="text-[9px] font-semibold text-indigo-700 uppercase tracking-wide block mb-1">{label}</label>
                <p className="text-[9px] text-indigo-500 mb-1.5 whitespace-pre-line leading-relaxed">{hint}</p>
                <textarea
                  value={draftManual[key]}
                  onChange={e => setDM(key, e.target.value)}
                  rows={5}
                  placeholder={hint}
                  className="w-full text-[10px] font-mono border border-indigo-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white resize-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal confirmación KPIs manuales ───────────────────────────── */}
      {confirmKPI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-indigo-100">
            <h3 className="text-sm font-bold text-gray-800 mb-1">{lang === "en" ? "Confirm manual KPIs?" : "¿Confirmar KPIs manuales?"}</h3>
            <p className="text-xs text-muted-foreground mb-5">{lang === "en" ? "COR override values will be saved to Supabase." : "Se guardarán los valores de override del COR en Supabase."}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmKPI(false)}
                className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {lang === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                onClick={handleConfirmKPI}
                className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                {lang === "en" ? "Confirm & save" : "Confirmar y guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast éxito KPIs ────────────────────────────────────────────── */}
      {kpiSuccess && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {lang === "en" ? "KPIs saved successfully!" : "¡KPIs guardados con éxito!"}
        </div>
      )}

      {/* ── Global KPI Cards ───────────────────────────────────────────── */}
      {/* Month selector */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-muted-foreground font-medium">
          {lang === "en" ? "Month:" : "Mes:"}
        </span>
        <input
          type="month"
          value={kpiMonth}
          onChange={e => setKpiMonth(e.target.value)}
          className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        />
        <span className="text-xs text-muted-foreground">
          — {kpiMonthProjects.length} {lang === "en" ? "services" : "servicios"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Revenue */}
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-medium text-muted-foreground">{t.cor_revenue_total_kpi}</span>
          </div>
          <p className="text-lg font-bold text-foreground leading-none">{formatClpToUsd(corKPIs.totalRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{t.cor_cost_label} {formatClpToUsd(corKPIs.totalCost)}</p>
          <div className="mt-2 pt-1.5 border-t border-gray-100">
            <span className="text-[10px] text-muted-foreground capitalize">{kpiMonthLabel}</span>
          </div>
        </div>

        {/* Gross Margin */}
        <div className={`rounded-xl border p-3 ${corKPIs.grossMargin>=34?"bg-emerald-50 border-emerald-200":corKPIs.grossMargin>=25?"bg-amber-50 border-amber-200":"bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className={`w-3.5 h-3.5 ${corKPIs.grossMargin>=34?"text-emerald-600":corKPIs.grossMargin>=25?"text-amber-600":"text-red-600"}`} />
            <span className="text-[10px] font-medium text-muted-foreground">Gross Margin</span>
          </div>
          <p className={`text-lg font-bold leading-none ${corKPIs.grossMargin>=34?"text-emerald-700":corKPIs.grossMargin>=25?"text-amber-700":"text-red-700"}`}>
            {Math.round(corKPIs.grossMargin)}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{t.cor_target_40}</p>
          <div className="mt-2 pt-1.5 border-t border-gray-100">
            <span className="text-[10px] text-muted-foreground capitalize">{kpiMonthLabel}</span>
          </div>
        </div>

        {/* OTD */}
        <div className={`rounded-xl border p-3 ${corKPIs.avgOTD===null?"bg-gray-50 border-gray-200":corKPIs.avgOTD>=95?"bg-emerald-50 border-emerald-200":corKPIs.avgOTD>=80?"bg-amber-50 border-amber-200":"bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <Target className={`w-3.5 h-3.5 ${corKPIs.avgOTD===null?"text-gray-400":corKPIs.avgOTD>=95?"text-emerald-600":corKPIs.avgOTD>=80?"text-amber-600":"text-red-600"}`} />
            <span className="text-[10px] font-medium text-muted-foreground">{t.cor_otd_global}</span>
          </div>
          <p className={`text-lg font-bold leading-none ${corKPIs.avgOTD===null?"text-gray-400":corKPIs.avgOTD>=95?"text-emerald-700":corKPIs.avgOTD>=80?"text-amber-700":"text-red-700"}`}>
            {corKPIs.avgOTD!==null?`${Math.round(corKPIs.avgOTD)}%`:t.cor_nd}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Target ≥ 95%</p>
          <div className="mt-2 pt-1.5 border-t border-gray-100">
            <span className="text-[10px] text-muted-foreground capitalize">{kpiMonthLabel}</span>
          </div>
        </div>

        {/* OQD */}
        <div className={`rounded-xl border p-3 ${corKPIs.avgOQD===null?"bg-gray-50 border-gray-200":corKPIs.avgOQD>=95?"bg-emerald-50 border-emerald-200":corKPIs.avgOQD>=80?"bg-amber-50 border-amber-200":"bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className={`w-3.5 h-3.5 ${corKPIs.avgOQD===null?"text-gray-400":corKPIs.avgOQD>=95?"text-emerald-600":corKPIs.avgOQD>=80?"text-amber-600":"text-red-600"}`} />
            <span className="text-[10px] font-medium text-muted-foreground">{t.cor_oqd_global}</span>
          </div>
          <p className={`text-lg font-bold leading-none ${corKPIs.avgOQD===null?"text-gray-400":corKPIs.avgOQD>=95?"text-emerald-700":corKPIs.avgOQD>=80?"text-amber-700":"text-red-700"}`}>
            {corKPIs.avgOQD!==null?`${Math.round(corKPIs.avgOQD)}%`:t.cor_nd}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Target ≥ 95%</p>
          <div className="mt-2 pt-1.5 border-t border-gray-100">
            <span className="text-[10px] text-muted-foreground capitalize">{kpiMonthLabel}</span>
          </div>
        </div>

        {/* Weather summary */}
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Gauge className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-medium text-muted-foreground">{t.cor_overall_status}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm">☀️</span><span className="text-[11px] font-bold text-emerald-700">{corKPIs.wc.G}</span>
            <span className="text-sm">⛅</span><span className="text-[11px] font-bold text-amber-700">{corKPIs.wc.A}</span>
            <span className="text-sm">⛈️</span><span className="text-[11px] font-bold text-red-700">{corKPIs.wc.R}</span>
            <span className="text-sm">✅</span><span className="text-[11px] font-bold text-teal-700">{corKPIs.wc.done}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{corKPIs.activeCount} {t.cor_active_services}</p>
          <div className="mt-2 pt-1.5 border-t border-gray-100">
            <span className="text-[10px] text-muted-foreground capitalize">{kpiMonthLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Customer Delivery Pie */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold mb-1">Customer Delivery</h3>
          <p className="text-[10px] text-muted-foreground mb-2">{t.cor_revenue_by_client}</p>
          <div className="flex items-center gap-2">
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={customerData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                  {customerData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
                </Pie>
                <ReTT contentStyle={{ fontSize:10, padding:"3px 8px", borderRadius:6 }} formatter={(v:number)=>[formatClpToUsd(v),""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1 min-w-0">
              {customerData.slice(0,6).map((d,i) => (
                <div key={d.name} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i%CHART_COLORS.length] }} />
                    <span className="text-[9px] text-muted-foreground truncate">{d.name}</span>
                  </div>
                  <span className="text-[9px] font-bold flex-shrink-0">{d.pct}%</span>
                </div>
              ))}
              {customerData.length>6 && <p className="text-[9px] text-muted-foreground">+{customerData.length-6} más</p>}
            </div>
          </div>
        </div>

        {/* Delivery Model Pie */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold mb-1">Delivery Model</h3>
          <p className="text-[10px] text-muted-foreground mb-2">{t.cor_revenue_by_type}</p>
          <div className="flex items-center gap-2">
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={modelData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                  {modelData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
                </Pie>
                <ReTT contentStyle={{ fontSize:10, padding:"3px 8px", borderRadius:6 }} formatter={(v:number)=>[formatClpToUsd(v),""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1 min-w-0">
              {modelData.slice(0,6).map((d,i) => (
                <div key={d.name} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i%CHART_COLORS.length] }} />
                    <span className="text-[9px] text-muted-foreground truncate">{d.name}</span>
                  </div>
                  <span className="text-[9px] font-bold flex-shrink-0">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue per Model Bar */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold mb-1">{t.cor_revenue_by_model}</h3>
          <p className="text-[10px] text-muted-foreground mb-2">{t.cor_comparative}</p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={revenueBarData} layout="vertical" margin={{ top:0, right:4, bottom:0, left:4 }}>
              <XAxis type="number" tick={{ fontSize:8 }} tickFormatter={v=>`${Math.round(v/1000)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize:8 }} width={60} />
              <ReTT contentStyle={{ fontSize:10, padding:"3px 8px", borderRadius:6 }} formatter={(v:number)=>[formatClpToUsd(v),"Revenue"]} />
              <Bar dataKey="revenue" radius={[0,3,3,0]}>
                {revenueBarData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gross Margin Bar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold">{t.cor_margin_by_service}</h3>
          <div className="flex items-center gap-4 text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              Margen YTD %
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" /></svg>
              Target 34%
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={marginBarData} margin={{ top:4, right:12, bottom:48, left:-8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize:8, fill:"#6b7280" }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={56}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize:9, fill:"#6b7280" }}
              tickFormatter={v=>`${v}%`}
              axisLine={false}
              tickLine={false}
            />
            <ReTT
              contentStyle={{ fontSize:10, padding:"4px 10px", borderRadius:6, border:"1px solid #e5e7eb" }}
              formatter={(v:number, _:string, props: { payload?: { fullName?: string } }) => [`${v}%`, props.payload?.fullName || "Margen YTD"]}
            />
            <ReferenceLine
              y={34}
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="5 3"
              ifOverflow="extendDomain"
            />
            <Bar dataKey="margin" radius={[3,3,0,0]} maxBarSize={48}>
              {marginBarData.map((d,i) => (
                <Cell key={i} fill={d.margin>=34?"#10b981":"#f59e0b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── KPI Definitions ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold mb-3">{t.cor_kpi_def_title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
          {[
            { name: "TMD",                formula: lang === "en" ? "Target Margin Deviation: Actual Margin – Plan Margin (34%). + = savings / margin gain · – = overrun / margin loss" : "Target Margin Deviation: Margen Real – Margen Plan (34%). + = ahorro / ganancia de margen · – = sobrecosto / pérdida de margen" },
            { name: "Monthly Margin %",   formula: t.cor_formula_monthly },
            { name: "YTD Margin %",       formula: t.cor_formula_ytd     },
            { name: "OTD %",              formula: t.cor_formula_otd     },
            { name: "OQD %",              formula: t.cor_formula_oqd     },
            { name: "CSAT",               formula: t.cor_formula_csat    },
            { name: "Team Mood",          formula: t.cor_formula_mood    },
          ].map(({ name, formula }) => (
            <div key={name} className="flex flex-col">
              <span className="text-[10px] font-semibold text-foreground">{name}</span>
              <span className="text-[9px] text-muted-foreground leading-tight">{formula}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Projects Overview Table ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold">
            {t.cor_projects_overview}
            {hasTableFilters && (
              <span className="ml-2 font-normal text-muted-foreground">
                {filteredProjects.length} de {projects.length}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground print:hidden">{t.cor_click_detail}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2.5 border-b border-border flex flex-wrap gap-2 items-center print:hidden">
          <MultiFilter
            placeholder={t.cor_status_col}
            options={weatherStatusOpts}
            value={fltStatus}
            onChange={setFltStatus}
          />
          {clientOpts.length > 0 && (
            <MultiFilter
              placeholder={t.cor_client_label}
              options={clientOpts.map(c => ({ value: c, label: c }))}
              value={fltClient}
              onChange={setFltClient}
            />
          )}
          {leaderOpts.length > 0 && (
            <MultiFilter
              placeholder="Team Leader"
              options={leaderOpts.map(l => ({ value: l, label: l }))}
              value={fltLeader}
              onChange={setFltLeader}
            />
          )}
          {managerOpts.length > 0 && (
            <MultiFilter
              placeholder="BM"
              options={managerOpts.map(m => ({ value: m, label: m }))}
              value={fltManager}
              onChange={setFltManager}
            />
          )}
          {typeOpts.length > 0 && (
            <MultiFilter
              placeholder={t.cor_model_label}
              options={typeOpts.map(ty => ({ value: ty, label: ty }))}
              value={fltType}
              onChange={setFltType}
            />
          )}
          {hasTableFilters && (
            <button
              onClick={clearTableFilters}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
        </div>

        <div className="overflow-x-auto -mx-0">
          <table className="w-full min-w-[900px] text-[10px]">
            <thead>
              <tr className="bg-gray-800 text-white text-left select-none">
                <th className="px-3 py-2 font-medium w-5"></th>
                {([
                  { label: t.cor_client_label,    field: "client"      as const, align: ""        },
                  { label: lang === "en" ? "Project / Service" : "Proyecto / Servicio", field: "name"        as const, align: ""        },
                  { label: lang === "en" ? "Type" : "Tipo",                        field: "serviceType" as const, align: "center"  },
                  { label: lang === "en" ? "Start" : "Inicio",                     field: "startDate"   as const, align: "center"  },
                  { label: lang === "en" ? "End" : "Término",                      field: "endDate"     as const, align: "center"  },
                  { label: "TL",                  field: "leader"      as const, align: ""        },
                  { label: "FTEs",                field: "ftes"        as const, align: "center"  },
                  { label: "Revenue",             field: "revenue"     as const, align: "right"   },
                  { label: t.cor_margin_ytd_col,  field: "margin"      as const, align: "right"   },
                  { label: "TMD",                 field: "tmd"         as const, align: "center"  },
                  { label: "OTD",                 field: "otd"         as const, align: "center"  },
                  { label: "OQD",                 field: "oqd"         as const, align: "center"  },
                  { label: "CSAT",                field: "csat"        as const, align: "center"  },
                  { label: t.cor_status_col,      field: "status"      as const, align: "center"  },
                  { label: "Trend",               field: "trend"       as const, align: "center"  },
                ] as { label: string; field: SortField; align: string }[]).map(col => (
                  <th
                    key={col.field}
                    className={`px-3 py-2 font-medium cursor-pointer hover:bg-gray-700 transition-colors text-${col.align||"left"}`}
                    onClick={() => toggleSort(col.field)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <span className="text-gray-400 text-[9px]">
                        {sortField === col.field ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-8 text-center text-[10px] text-muted-foreground">
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              ) : filteredProjects.map((p, i) => {
                const rep      = reportData[p.id];
                const weather  = WEATHER[rep?.overallStatus ?? "grey"] ?? WEATHER.grey;
                const otdVal   = parsePercent(p.csvOtdPercent);
                const oqdVal   = parsePercent(p.csvOqdPercent);
                const marginPct = rep?.marginYTD
                  ? parsePercent(rep.marginYTD)
                  : p.revenue > 0 ? Math.round((p.revenue-p.spent)/p.revenue*100) : null;
                const ftes  = rep?.ftes || String(p.teamSize||"—");
                const csat  = csatFromHealth(rep?.healthGovernance);
                const tmd   = marginPct !== null ? Math.round(marginPct - 34) : null;
                const isOpen = selectedId === p.id;

                return (
                  <Fragment key={p.id}>
                    <tr
                      className={`cursor-pointer transition-colors border-t border-gray-100 ${isOpen?"bg-indigo-50":i%2===0?"bg-white hover:bg-gray-50":"bg-gray-50/50 hover:bg-gray-100/50"}`}
                      onClick={() => { if (!editingCell) setSelectedId(isOpen?null:p.id); }}
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[90px]">{p.client||"—"}</td>
                      <td className="px-3 py-2 font-medium max-w-[160px]">
                        <div className="truncate">{p.name}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">
                        {p.serviceType
                          ? p.serviceType.toLowerCase().includes("competence") ? "3"
                          : p.serviceType.toLowerCase().includes("service center") ? "4"
                          : p.serviceType.toLowerCase().includes("fixed") ? "5"
                          : <span className="text-gray-400">—</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground whitespace-nowrap">
                        {p.startDate ? new Date(p.startDate).toLocaleDateString(lang === "en" ? "en-US" : "es-CL",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {(() => {
                          if (!p.endDate) return <span className="text-muted-foreground">—</span>;
                          const end = new Date(p.endDate);
                          const now = new Date();
                          const diffMs = end.getTime() - now.getTime();
                          const diffDays = diffMs / (1000 * 60 * 60 * 24);
                          const dot = diffDays < 0 ? null
                            : diffDays <= 30  ? <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 align-middle" title="Ends within 1 month" />
                            : diffDays <= 60  ? <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1 align-middle" title="Ends within 2 months" />
                            : <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 align-middle" title="More than 2 months" />;
                          const textColor = diffDays < 0 ? "text-muted-foreground"
                            : diffDays <= 30 ? "text-red-600 font-semibold"
                            : diffDays <= 60 ? "text-amber-600 font-semibold"
                            : "text-muted-foreground";
                          return <span className={textColor}>{dot}{end.toLocaleDateString(lang === "en" ? "en-US" : "es-CL",{day:"2-digit",month:"2-digit",year:"2-digit"})}</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-semibold tracking-wide">
                        {p.leader ? p.leader.split(" ").map((w: string) => w[0]?.toUpperCase()||"").join("") : "—"}
                      </td>

                      {/* FTEs — inline edit */}
                      <td
                        className="px-3 py-2 text-center font-semibold group cursor-text"
                        onClick={e => { e.stopPropagation(); setEditingCell({ id:p.id, field:"ftes", value:ftes.replace("—","") }); }}
                      >
                        {cellInput(p.id,"ftes",ftes) || (
                          <div className="flex items-center justify-center gap-1">
                            {ftes}
                            <Pencil className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right font-medium">{formatClpToUsd(p.revenue||0)}</td>

                      {/* Margin YTD — inline edit */}
                      <td
                        className="px-3 py-2 text-right group cursor-text"
                        onClick={e => { e.stopPropagation(); setEditingCell({ id:p.id, field:"margin", value:marginPct!==null?String(marginPct):"" }); }}
                      >
                        {cellInput(p.id,"margin","") || (
                          <div className="flex items-center justify-end gap-1">
                            {marginPct!==null
                              ? <span className={`font-semibold ${marginPct>=34?"text-emerald-700":marginPct>=25?"text-amber-700":"text-red-600"}`}>{marginPct}%</span>
                              : <span className="text-gray-400">{t.cor_nd}</span>}
                            <Pencil className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* TMD */}
                      <td className="px-3 py-2 text-center">
                        {tmd !== null ? (
                          <span className={`font-semibold text-[9px] ${tmd >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {tmd > 0 ? "+" : ""}{tmd}pp
                          </span>
                        ) : <span className="text-gray-400">{t.cor_nd}</span>}
                      </td>

                      {/* OTD — inline edit */}
                      <td
                        className="px-3 py-2 text-center group cursor-text"
                        onClick={e => { e.stopPropagation(); setEditingCell({ id:p.id, field:"otd", value:otdVal!==null?String(Math.round(otdVal)):"" }); }}
                      >
                        {cellInput(p.id,"otd","") || (
                          <div className="flex items-center justify-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${pctBadge(otdVal)}`}>
                              {otdVal!==null?`${Math.round(otdVal)}%`:t.cor_nd}
                            </span>
                            <Pencil className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* OQD — inline edit */}
                      <td
                        className="px-3 py-2 text-center group cursor-text"
                        onClick={e => { e.stopPropagation(); setEditingCell({ id:p.id, field:"oqd", value:oqdVal!==null?String(Math.round(oqdVal)):"" }); }}
                      >
                        {cellInput(p.id,"oqd","") || (
                          <div className="flex items-center justify-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${pctBadge(oqdVal)}`}>
                              {oqdVal!==null?`${Math.round(oqdVal)}%`:t.cor_nd}
                            </span>
                            <Pencil className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* CSAT — inline edit */}
                      <td
                        className="px-3 py-2 text-center group cursor-text"
                        onClick={e => { e.stopPropagation(); setEditingCell({ id:p.id, field:"csat", value:csat==="N/D"?"":csat }); }}
                      >
                        {cellInput(p.id,"csat","") || (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-base leading-none">
                              {csat==="N/D"?"❓":parseFloat(csat)>=3.5?"😊":parseFloat(csat)>=2.5?"😐":"😟"}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <span className="text-[9px] text-muted-foreground">{csat}</span>
                              <Pencil className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status/Weather — inline edit */}
                      <td
                        className="px-3 py-2 text-center group cursor-pointer"
                        onClick={e => { e.stopPropagation(); setEditingCell({ id:p.id, field:"status", value:rep?.overallStatus??"grey" }); }}
                      >
                        {cellInput(p.id,"status","",true) || (
                          <div className="flex items-center justify-center gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-medium border ${weather.bg} ${weather.text} ${weather.border}`}>
                              <span className="text-base leading-none">{weather.icon}</span>
                              {weather.label}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status Trend — dropdown editable */}
                      <td
                        className="px-3 py-2 text-center cursor-pointer group"
                        onClick={e => { e.stopPropagation(); if (!isHistorical) setEditingCell({ id:p.id, field:"trend", value: rep?.statusTrend ?? "" }); }}
                      >
                        {cellInput(p.id,"trend","") || (() => {
                          const manual = rep?.statusTrend;
                          if (manual === "up")   return <span className="text-emerald-500 text-xl leading-none">↗</span>;
                          if (manual === "same") return <span className="text-gray-400 text-xl leading-none">→</span>;
                          if (manual === "down") return <span className="text-red-500 text-xl leading-none">↘</span>;
                          if (!rep?.previousStatus || rep.previousStatus === "grey")
                            return <span className="text-gray-300 text-sm group-hover:text-gray-400 transition-colors">↔</span>;
                          const diff = (STATUS_RANK[rep.overallStatus ?? "grey"]??3) - (STATUS_RANK[rep.previousStatus]??3);
                          if (diff > 0) return <span className="text-emerald-300 text-xl leading-none">↗</span>;
                          if (diff < 0) return <span className="text-red-300 text-xl leading-none">↘</span>;
                          return <span className="text-gray-300 text-xl leading-none">→</span>;
                        })()}
                      </td>
                    </tr>

                    {/* ── Expanded Detail ────────────────────────────────── */}
                    {isOpen && selectedProject && selectedProject.id === p.id && (
                      <tr>
                        <td colSpan={16} className="p-0 bg-indigo-50/60">
                          <ProjectDetailPanel
                            project={selectedProject}
                            report={selectedReport}
                            onSaveProject={isHistorical ? () => {} : changes => updateProject(p.id, changes)}
                            onSaveReport={isHistorical ? () => {} : changes => updateReport(p.id, changes)}
                            readOnly={isHistorical}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New Service Modal ──────────────────────────────────────────────── */}
      {showNewModal && (
        <NewServiceModal
          onClose={() => setShowNewModal(false)}
          onSave={project => addProject(project)}
        />
      )}
    </div>
  );
}

// ── Transformation View ────────────────────────────────────────────────────

function TransformationView() {
  return (
    <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-border">
      <div className="text-center">
        <p className="text-sm font-semibold text-muted-foreground">Transformation</p>
        <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
      </div>
    </div>
  );
}

// ── Financial KPI types ───────────────────────────────────────────────────────
interface ActividadCatalogo { cliente: string; codigo: string; descripcion: string; }
interface HeadcountEntry { nombre: string; dias: number; fte: number; costoDiario: number; costoMes: number; }
interface ActividadMes { mes: string; produccion: number; costos: number; margen: number; diasActividad: number; uf: number; workingDays: number; tarifaUF: number; costoNorm: number; irm: string; cliente: string; headcount: HeadcountEntry[]; }

// ── Financial KPI View ────────────────────────────────────────────────────────

const FY_MESES = ["2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02"];
const PROY_MESES = ["2026-03","2026-04","2026-05","2026-06"];
const MES_LABEL: Record<string,string> = {
  "2025-04":"Apr-25","2025-05":"May-25","2025-06":"Jun-25","2025-07":"Jul-25",
  "2025-08":"Aug-25","2025-09":"Sep-25","2025-10":"Oct-25","2025-11":"Nov-25",
  "2025-12":"Dec-25","2026-01":"Jan-26","2026-02":"Feb-26","2026-03":"Mar-26",
  "2026-04":"Apr-26","2026-05":"May-26","2026-06":"Jun-26",
};

const margenBg   = (p: number) => p >= 0.34 ? "#1b5e20" : p >= 0.30 ? "#8bc34a" : p >= 0.25 ? "#fdd835" : p >= 0 ? "#f44336" : "#b71c1c";
const margenTxt  = (p: number) => (p >= 0.25 && p < 0.30) ? "#333" : "#fff";
const fmtPctSgn  = (p: number) => p === 0 ? "" : `${p>0?"+":""}${(p*100).toFixed(1)}%`;
const fmtNum     = (n: number) => n === 0 ? "" : Math.abs(Math.round(n)).toLocaleString("es-CL");
const fmtNeg     = (n: number) => n === 0 ? "" : `(${Math.abs(Math.round(n)).toLocaleString("es-CL")})`;

function BuscadorActividad({ onSelect, selected, catalogo }: { onSelect: (a: ActividadCatalogo) => void; selected: ActividadCatalogo | null; catalogo: ActividadCatalogo[]; }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    return catalogo.filter(a =>
      a.codigo.toLowerCase().includes(lq) || a.descripcion.toLowerCase().includes(lq) || a.cliente.toLowerCase().includes(lq)
    ).slice(0, 10);
  }, [q, catalogo]);
  return (
    <div style={{position:"relative",maxWidth:640}}>
      <input
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Search by IFS code, client or description..."
        value={selected && !q ? `${selected.codigo} — ${selected.descripcion}` : q}
        onFocus={() => { setQ(""); setOpen(true); }}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:500,
          background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
          maxHeight:300,overflowY:"auto",boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
          {results.map(a => (
            <div key={a.codigo} onMouseDown={() => { onSelect(a); setQ(""); setOpen(false); }}
              style={{padding:"9px 14px",cursor:"pointer",
                borderBottom:"0.5px solid #eee",
                background:selected?.codigo===a.codigo?"#e3f2fd":"transparent"}}>
              <div style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#1565c0"}}>{a.codigo}</div>
              <div style={{fontSize:12,marginTop:1}}>{a.descripcion}</div>
              <div style={{fontSize:11,color:"#666",marginTop:1}}>{a.cliente}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline consultant search for edit mode ────────────────────────────────────
function ConsultantPicker({ allConsultants, existingNames, onAdd }: {
  allConsultants: Array<{nombre: string; costoDiario: number}>;
  existingNames: string[];
  onAdd: (nombre: string, costoDiario: number) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    return allConsultants
      .filter(c => !existingNames.includes(c.nombre) && c.nombre.toLowerCase().includes(lq))
      .slice(0, 10);
  }, [q, allConsultants, existingNames]);

  function updateRect() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  }

  return (
    <div style={{ width: 380 }}>
      <input
        ref={inputRef}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); updateRect(); }}
        onFocus={() => { setOpen(true); updateRect(); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search consultant to add..."
        style={{ width:"100%", boxSizing:"border-box", border:"1px solid #2e75b6",
          borderRadius:6, padding:"7px 10px", fontSize:12,
          background:"#fff", color:"#1565c0", outline:"none" }}
      />
      {open && results.length > 0 && rect && (
        <div style={{ position:"fixed", top: rect.bottom + 4, left: rect.left,
          width: rect.width, zIndex:99999, background:"#fff", border:"1px solid #2e75b6",
          borderRadius:8, maxHeight:260, overflowY:"auto",
          boxShadow:"0 6px 20px rgba(0,0,0,0.18)" }}>
          {results.map(c => (
            <div key={c.nombre}
              onMouseDown={e => { e.preventDefault(); onAdd(c.nombre, c.costoDiario); setQ(""); setOpen(false); }}
              style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"0.5px solid #eee",
                fontSize:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}
              onMouseEnter={e => (e.currentTarget.style.background="#e3f2fd")}
              onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
              <span style={{fontWeight:500}}>{c.nombre}</span>
              <span style={{ fontSize:10, color:"#888", marginLeft:8, flexShrink:0 }}>
                ${Math.round(c.costoDiario).toLocaleString("es-CL")}/día
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// proyDias: { "2026-03": { "Claudio": 20, "Brahin": 20 }, "2026-04": {...} }
// proyWD:   { "2026-03": 21, "2026-04": 20, ... }
// proyUFVal:{ "2026-03": 39900, ... }
function TablaActividad({ actividad, proyTarifas, onProyChange, proyDias, onProyDiasChange, proyWD, onProyWDChange, proyUFVal, onProyUFChange, actividadesMap,
  editMode = false, editRows = [], allConsultants = [],
  onChangeProduccion, onChangeDias, onAddConsultant, onRemoveConsultant,
}: {
  actividad: ActividadCatalogo; proyTarifas: Record<string,string>; onProyChange: (mes: string, v: string) => void;
  proyDias: Record<string, Record<string,number>>; onProyDiasChange: (mes: string, nombre: string, dias: number) => void;
  proyWD: Record<string,number>; onProyWDChange: (mes: string, wd: number) => void;
  proyUFVal: Record<string,number>; onProyUFChange: (mes: string, uf: number) => void;
  actividadesMap: Record<string, ActividadMes[]>;
  editMode?: boolean;
  editRows?: ActividadMes[];
  allConsultants?: Array<{nombre: string; costoDiario: number}>;
  onChangeProduccion?: (mes: string, val: number) => void;
  onChangeDias?: (mes: string, nombre: string, dias: number) => void;
  onAddConsultant?: (nombre: string, costoDiario: number) => void;
  onRemoveConsultant?: (nombre: string) => void;
}) {
  const historico: ActividadMes[] = editMode ? editRows : (actividadesMap[actividad.codigo] || []);
  const byMes: Record<string, ActividadMes> = {};
  historico.forEach(m => { byMes[m.mes] = m; });

  // Last month with real data (for projection reference and accumulated label)
  const lastRealMes = [...FY_MESES].reverse().find(m => byMes[m]?.produccion) || FY_MESES[FY_MESES.length - 1];
  const refMes = byMes[lastRealMes] || historico[historico.length - 1];

  // Accumulated = only FY_MESES months up to lastRealMes
  const conData = historico.filter(m => FY_MESES.includes(m.mes) && m.mes <= lastRealMes && (m.produccion !== 0 || m.costos !== 0));
  const acProd  = conData.reduce((a, m) => a + m.produccion, 0);
  const acCosto = conData.reduce((a, m) => a + m.costos, 0);
  const acMgn   = conData.reduce((a, m) => a + m.margen, 0);
  const acPct   = acProd > 0 ? acMgn / acProd : 0;

  // Build consultant list and costoDiario map from ALL historical months
  // (not just refMes, so consultants who left before the last real month are included)
  const consultoresOrden: string[] = [];
  const seen = new Set<string>();
  [...historico].reverse().forEach(m =>
    m.headcount?.forEach(h => { if (!seen.has(h.nombre)) { seen.add(h.nombre); consultoresOrden.push(h.nombre); } })
  );
  const consultCostMap = new Map<string, number>();
  historico.forEach(m => m.headcount?.forEach(h => {
    if (h.costoDiario > 0 && !consultCostMap.has(h.nombre)) consultCostMap.set(h.nombre, h.costoDiario);
  }));

  // Per-projection-month calculations — iterates ALL consultants, not just refMes.headcount
  const proyCalc = PROY_MESES.map(pm => {
    const uf     = parseFloat(proyTarifas[pm] || "") || 0;
    const ufVal  = proyUFVal[pm] ?? (refMes?.uf || 39875);
    const prod   = uf > 0 ? uf * ufVal : 0;
    const diasPm = proyDias[pm] || {};
    const wd     = proyWD[pm] ?? (refMes?.workingDays > 0 ? refMes.workingDays : 20.75);
    const totalCostos = consultoresOrden.reduce((s, nombre) => {
      const costoDiario  = consultCostMap.get(nombre) || 0;
      const defaultDias  = refMes?.headcount?.find(h => h.nombre === nombre)?.dias ?? 0;
      const d = diasPm[nombre] ?? defaultDias;
      return s + Math.round(d * costoDiario);
    }, 0);
    const costo = Math.round(totalCostos * 20.75 / wd);
    const mgn   = prod > 0 ? prod - costo : 0;
    const pct   = prod > 0 ? mgn / prod : 0;
    return { mes: pm, uf, ufVal, prod, costo, wd, mgn, pct };
  });
  const proyTotalProd = proyCalc.reduce((s, p) => s + p.prod, 0);
  const proyTotalMgn  = proyCalc.reduce((s, p) => s + p.mgn, 0);

  const BG_HDR  = "#17375e";
  const BG_REAL = "#2e6da4";
  const BG_PROY = "#5b9bd5";
  const BG_ACUM = "#17375e";
  const BG_EMPTY= "#dce6f4";
  const BG_HC   = "#1a3a5c";
  const EDIT_BG = "#fffde7";

  const thS = (bg = BG_HDR): React.CSSProperties => ({padding:"5px 8px",fontSize:10,fontWeight:700,color:"#fff",
    background:bg,border:"1px solid rgba(255,255,255,0.15)",whiteSpace:"nowrap",textAlign:"center"});
  const tdS = (bg: string|null, bold: boolean, align: "right"|"center" = "right"): React.CSSProperties => ({
    padding:"4px 8px",fontSize:11,fontWeight:bold?700:400,background:bg||"transparent",
    textAlign:align,borderRight:"0.5px solid #ddd",borderBottom:"0.5px solid #ddd",
    whiteSpace:"nowrap",color:"#111"});
  const labelS: React.CSSProperties = {padding:"5px 10px",fontSize:11,fontWeight:500,
    background:"#e8edf5",textAlign:"right",color:"#17375e",
    borderRight:"1px solid #c5cfe0",borderBottom:"0.5px solid #ddd",
    whiteSpace:"nowrap",minWidth:190,
    position:"sticky",left:0,zIndex:1};
  const inputS: React.CSSProperties = {border:"1px solid #2e75b6",borderRadius:3,
    padding:"1px 4px",fontSize:11,textAlign:"right",background:"#fff",color:"#1565c0",fontWeight:600};

  const KPI_ROWS = [
    {key:"uf",          label:"UF",                       bold:false},
    {key:"workingDays", label:"Working Days",              bold:false},
    {key:"produccion",  label:"Production (CLP)",          bold:false, editable:true},
    {key:"tarifaUF",    label:"Approx. Rate in UF (Net)",  bold:false},
    {key:"costoNorm",   label:"Normalized Cost 20.75",     bold:false},
    {key:"margen",      label:"Margin",                    bold:true},
    {key:"margenPct",   label:"Margin %",                  bold:true},
  ];

  const renderCell = (mes: string, key: string) => {
    const d = byMes[mes];
    if (!d) return <td key={mes} style={{...tdS(BG_EMPTY,false)}}></td>;
    const pct = d.produccion > 0 ? d.margen / d.produccion : 0;

    if (editMode && key === "produccion" && onChangeProduccion) {
      return (
        <td key={mes} style={{...tdS(EDIT_BG, false), padding:"2px 4px"}}>
          <input type="number" value={d.produccion || ""}
            onChange={e => onChangeProduccion(mes, Number(e.target.value))}
            style={{...inputS, width:88}} />
        </td>
      );
    }

    let txt: React.ReactNode = "";
    let bg: string|null = null;
    let color = "#111";
    let bold = false;

    switch (key) {
      case "uf":          txt = d.uf > 0 ? Math.round(d.uf).toLocaleString("es-CL") : ""; break;
      case "workingDays": txt = d.workingDays > 0 ? `${d.workingDays.toFixed(1)}` : ""; break;
      case "produccion":  txt = d.produccion !== 0 ? fmtNum(d.produccion) : ""; break;
      case "tarifaUF":    txt = d.tarifaUF > 0 ? d.tarifaUF.toFixed(1) : ""; break;
      case "costoNorm":   txt = d.costoNorm !== 0 ? fmtNeg(d.costoNorm) : ""; color = "#666"; break;
      case "margen":
        txt = d.margen !== 0 ? fmtNum(d.margen) : "";
        color = d.margen >= 0 ? "#1b5e20" : "#b71c1c"; bold = true; break;
      case "margenPct":
        if (pct !== 0) { txt = fmtPctSgn(pct); bg = margenBg(pct); color = margenTxt(pct); bold = true; }
        break;
    }
    return <td key={mes} style={{...tdS(bg,bold,key==="margenPct"?"center":"right"),color}}>{txt}</td>;
  };

  return (
    <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
        <thead>
          <tr>
            <th style={{...thS(),textAlign:"left",minWidth:190,position:"sticky",left:0,zIndex:2}} rowSpan={2}>KPI</th>
            <th style={{...thS(BG_REAL)}} colSpan={FY_MESES.length}>Real FY 25-26</th>
            <th style={{...thS(BG_PROY),minWidth:80}} colSpan={PROY_MESES.length}>Projection FY 25-26</th>
            <th style={{...thS(BG_ACUM)}} colSpan={2}>Accumulated</th>
          </tr>
          <tr>
            {FY_MESES.map(m => <th key={m} style={{...thS(BG_HDR),fontSize:10}}>{MES_LABEL[m]}</th>)}
            {PROY_MESES.map(m => <th key={m} style={{...thS(BG_PROY),fontSize:10,minWidth:100}}>{MES_LABEL[m]}</th>)}
            <th style={{...thS(BG_ACUM),fontSize:10}}>Real to {MES_LABEL[lastRealMes]}</th>
            <th style={{...thS(BG_ACUM),fontSize:10,background:"#ffc000",color:"#333"}}>Real + Proj.</th>
          </tr>
        </thead>
        <tbody>
          {KPI_ROWS.map(row => (
            <tr key={row.key}>
              <td style={labelS}>{row.label}{editMode && row.editable && <span style={{marginLeft:4,fontSize:9,color:"#2e75b6",fontWeight:700}}>✎</span>}</td>
              {FY_MESES.map(mes => renderCell(mes, row.key))}
              {proyCalc.map(p => (
                <td key={p.mes} style={{...tdS("#bdd7ee",false,row.key==="margenPct"?"center":"right")}}>
                  {row.key === "tarifaUF" ? (
                    <input type="number" step="0.5" value={proyTarifas[p.mes] || ""}
                      onChange={e => onProyChange(p.mes, e.target.value)}
                      style={{...inputS,width:58}}/>
                  ) : row.key === "uf" ? (
                      <input type="number" step="1" value={p.ufVal}
                        onChange={e => onProyUFChange(p.mes, Number(e.target.value))}
                        style={{...inputS, width:76, textAlign:"center"}}/>
                    )
                    : row.key === "workingDays" ? (
                      <input type="number" min={1} max={31} step={0.5} value={p.wd}
                        onChange={e => onProyWDChange(p.mes, Number(e.target.value))}
                        style={{...inputS, width:46, textAlign:"center"}}/>
                    )
                    : row.key === "produccion" ? (p.prod > 0 ? fmtNum(p.prod) : "")
                    : row.key === "costoNorm"   ? (p.costo > 0 ? fmtNeg(p.costo) : "")
                    : row.key === "margen" ? (p.mgn !== 0 ? <span style={{color:p.mgn>=0?"#1b5e20":"#b71c1c",fontWeight:700}}>{fmtNum(p.mgn)}</span> : "")
                    : row.key === "margenPct" ? (p.pct !== 0 ? <span style={{padding:"1px 6px",borderRadius:3,background:margenBg(p.pct),color:margenTxt(p.pct),fontWeight:700}}>{fmtPctSgn(p.pct)}</span> : "")
                    : ""}
                </td>
              ))}
              <td style={{...tdS("#f0f0f0",row.bold,row.key==="margenPct"?"center":"right")}}>
                {row.key==="produccion" ? fmtNum(acProd)
                 :row.key==="costoNorm" ? fmtNeg(acCosto)
                 :row.key==="margen"    ? <span style={{color:acMgn>=0?"#1b5e20":"#b71c1c",fontWeight:700}}>{fmtNum(acMgn)}</span>
                 :row.key==="margenPct" ? <span style={{padding:"1px 6px",borderRadius:3,fontWeight:700,background:margenBg(acPct),color:margenTxt(acPct)}}>{fmtPctSgn(acPct)}</span>
                 : ""}
              </td>
              <td style={{...tdS(row.key==="margenPct"?margenBg(acPct):"#ffc000",row.bold,row.key==="margenPct"?"center":"right"),
                color:row.key==="margenPct"?margenTxt(acPct):"#333"}}>
                {row.key==="produccion" ? fmtNum(acProd+proyTotalProd)
                 :row.key==="costoNorm" ? fmtNeg(acCosto)
                 :row.key==="margen"    ? <span style={{fontWeight:700}}>{fmtNum(acMgn+proyTotalMgn)}</span>
                 :row.key==="margenPct" ? (() => { const tp=acProd+proyTotalProd; const tm=acMgn+proyTotalMgn; const pp=tp>0?tm/tp:0; return <span style={{fontWeight:700}}>{fmtPctSgn(pp)}</span>; })()
                 : ""}
              </td>
            </tr>
          ))}

          <tr><td colSpan={FY_MESES.length+PROY_MESES.length+3} style={{height:6,background:"#f0f0f0"}}/></tr>

          {/* Headcount header */}
          <tr>
            <td style={{...labelS,background:BG_HC,color:"#fff",textAlign:"center",fontWeight:700}}>Headcount</td>
            {FY_MESES.map(mes => {
              const d = byMes[mes];
              const n = d?.headcount?.length || 0;
              return <td key={mes} style={{...tdS(BG_HC,true),color:"#fff",textAlign:"center"}}>{n}</td>;
            })}
            {PROY_MESES.map(pm => {
              const diasPm = proyDias[pm] || {};
              const n = consultoresOrden.filter(nombre => {
                const d = diasPm[nombre] ?? (refMes?.headcount?.find(h => h.nombre === nombre)?.dias ?? 0);
                return d > 0;
              }).length;
              return <td key={pm} style={{...tdS(BG_PROY,true),color:"#fff",textAlign:"center"}}>{n}</td>;
            })}
            <td colSpan={2} style={{background:BG_HC,borderBottom:"0.5px solid #ddd"}}/>
          </tr>

          {/* FTE row */}
          <tr>
            <td style={{...labelS,background:BG_HC,color:"#fff",textAlign:"center",fontWeight:700}}>FTE</td>
            {FY_MESES.map(mes => {
              const d = byMes[mes];
              const fte = d?.headcount?.reduce((a,h)=>a+h.fte,0)||0;
              return <td key={mes} style={{...tdS(BG_HC,false),color:"#fff",textAlign:"center"}}>{fte>0?fte.toFixed(1):"0.0"}</td>;
            })}
            {PROY_MESES.map(pm => {
              const diasPm = proyDias[pm] || {};
              const wd = proyWD[pm] ?? (refMes?.workingDays > 0 ? refMes.workingDays : 20.75);
              const fte = consultoresOrden.reduce((sum, nombre) => {
                const d = diasPm[nombre] ?? (refMes?.headcount?.find(h => h.nombre === nombre)?.dias ?? 0);
                return sum + (d > 0 ? d / wd : 0);
              }, 0);
              return <td key={pm} style={{...tdS(BG_PROY,false),color:"#fff",textAlign:"center"}}>{fte.toFixed(1)}</td>;
            })}
            <td colSpan={2} style={{background:BG_HC,borderBottom:"0.5px solid #ddd"}}/>
          </tr>

          {/* Consultant rows */}
          {consultoresOrden.map((nombre, idx) => (
            <tr key={nombre} style={{background:idx%2===0?"#f5f7fa":"transparent"}}>
              <td style={{padding:"4px 6px 4px 12px",fontSize:11,
                borderRight:"1px solid #ddd",borderBottom:"0.5px solid #eee",
                whiteSpace:"nowrap",color:"#111",display:"flex",alignItems:"center",gap:4,
                position:"sticky",left:0,background:idx%2===0?"#f5f7fa":"#fff",zIndex:1}}>
                {editMode && onRemoveConsultant && (
                  <button onClick={() => onRemoveConsultant(nombre)}
                    style={{flexShrink:0,width:16,height:16,borderRadius:"50%",border:"none",
                      background:"#fee2e2",color:"#dc2626",cursor:"pointer",fontSize:10,
                      display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>×</button>
                )}
                <span>{nombre}</span>
              </td>
              {FY_MESES.map(mes => {
                const d = byMes[mes];
                const hc = d?.headcount?.find(h => h.nombre === nombre);
                if (editMode && d && onChangeDias) {
                  return (
                    <td key={mes} style={{padding:"2px 4px",borderRight:"0.5px solid #ddd",
                      borderBottom:"0.5px solid #eee",background:EDIT_BG,textAlign:"center"}}>
                      <input type="number" min={0} max={d.workingDays||23}
                        value={hc ? hc.dias : 0}
                        onChange={e => onChangeDias(mes, nombre, Number(e.target.value))}
                        style={{...inputS, width:42, textAlign:"center"}} />
                    </td>
                  );
                }
                return (
                  <td key={mes} style={{padding:"4px 8px",fontSize:11,textAlign:"center",
                    borderRight:"0.5px solid #ddd",borderBottom:"0.5px solid #eee",
                    background:!d?BG_EMPTY:"transparent",
                    color:hc&&hc.dias>0?"#1565c0":"#bbb",
                    fontWeight:hc&&hc.dias>0?700:400}}>
                    {hc ? hc.dias : (d ? "0" : "")}
                  </td>
                );
              })}
              {PROY_MESES.map(pm => {
                const refHc = refMes?.headcount?.find(h => h.nombre === nombre);
                const simDias = proyDias[pm]?.[nombre] ?? refHc?.dias ?? 0;
                return (
                  <td key={pm} style={{padding:"2px 4px",borderRight:"0.5px solid #ddd",
                    borderBottom:"0.5px solid #eee",background:"#e8f0fb",textAlign:"center"}}>
                    <input type="number" min={0} max={31} value={simDias}
                      onChange={e => onProyDiasChange(pm, nombre, Number(e.target.value))}
                      style={{border:"1px solid #5b9bd5",borderRadius:3,padding:"1px 4px",
                        fontSize:11,textAlign:"center",background:"#fff",color:"#1565c0",
                        fontWeight:600,width:42}} />
                  </td>
                );
              })}
              <td colSpan={2}/>
            </tr>
          ))}

        </tbody>
      </table>
      {/* Consultant picker OUTSIDE the scrollable table to avoid overflow clipping */}
      {editMode && onAddConsultant && (
        <div style={{padding:"10px 0 4px",borderTop:"1px dashed #2e75b6",marginTop:4}}>
          <div style={{fontSize:11,color:"#2e75b6",fontWeight:600,marginBottom:6}}>+ Add consultant</div>
          <ConsultantPicker
            allConsultants={allConsultants}
            existingNames={consultoresOrden}
            onAdd={onAddConsultant}
          />
        </div>
      )}
    </div>
  );
}

type ProjData = { tarifas: Record<string,string>; dias: Record<string,Record<string,number>>; wd: Record<string,number>; ufVal: Record<string,number>; editedRows?: ActividadMes[] };

function FinancialKPIView() {
  const [actSel, setActSel]         = useState<ActividadCatalogo | null>(null);
  const [proyTarifas, setProyTarifas] = useState<Record<string,string>>({});
  const [proyDias,    setProyDias]    = useState<Record<string,Record<string,number>>>({});
  const [proyWD,      setProyWD]      = useState<Record<string,number>>({});
  const [proyUFVal,   setProyUFVal]   = useState<Record<string,number>>({});
  const [savedProj,   setSavedProj]   = useState<Record<string, ProjData>>({});
  const [catalogo, setCatalogo]     = useState<ActividadCatalogo[]>([]);
  const [actMap, setActMap]         = useState<Record<string, ActividadMes[]>>({});
  const [loading, setLoading]       = useState(true);
  const [editMode, setEditMode]     = useState(false);
  const [editRows, setEditRows]     = useState<ActividadMes[]>([]);
  const [allConsultants, setAllConsultants] = useState<Array<{nombre: string; costoDiario: number}>>([]);

  useEffect(() => {
    // Chain: load JSON first, then load Supabase edits, apply both together
    fetch("/actividades-data.json")
      .then(r => r.json())
      .then(d => {
        setCatalogo(d.CATALOGO_ACTIVIDADES || []);
        const rawMap = d.ACTIVIDADES_FULL || {};
        const fixedMap: Record<string, ActividadMes[]> = {};
        const consultMap = new Map<string, number>();
        for (const [code, months] of Object.entries(rawMap)) {
          fixedMap[code] = (months as ActividadMes[]).map(m => {
            const hc = m.headcount || [];
            const totalCostos = hc.reduce((s, h) => s + h.costoMes, 0);
            const wd = (m.workingDays || 0) > 0 ? m.workingDays : 20.75;
            const costoNorm = Math.round(totalCostos * 20.75 / wd);
            hc.forEach(h => { if (!consultMap.has(h.nombre) && h.costoDiario > 0) consultMap.set(h.nombre, h.costoDiario); });
            return { ...m, costos: -totalCostos, costoNorm, margen: m.produccion - costoNorm };
          });
        }
        setAllConsultants([...consultMap.entries()]
          .map(([nombre, costoDiario]) => ({ nombre, costoDiario }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)));
        // Load Supabase edits and overlay them on top of the JSON map
        return fetch("/api/settings/fin-kpi-proy")
          .then(r => r.json())
          .then((stored: Record<string, ProjData> | null) => {
            if (stored && typeof stored === "object") {
              setSavedProj(stored);
              // Apply any saved editedRows over the base JSON data
              for (const [code, data] of Object.entries(stored)) {
                if (data.editedRows?.length) fixedMap[code] = data.editedRows;
              }
            }
            setActMap(fixedMap);
            setLoading(false);
          })
          .catch(() => { setActMap(fixedMap); setLoading(false); });
      })
      .catch(() => setLoading(false));
  }, []);

  // Reset edit mode when activity changes; restore saved projection data + edited rows
  useEffect(() => {
    setEditMode(false);
    setEditRows([]);
    if (actSel) {
      const saved = savedProj[actSel.codigo];
      setProyTarifas(saved?.tarifas ?? {});
      setProyDias(saved?.dias ?? {});
      setProyWD(saved?.wd ?? {});
      setProyUFVal(saved?.ufVal ?? {});
      // Apply saved editedRows (may include added consultants not in JSON)
      if (saved?.editedRows?.length) {
        setActMap(prev => ({ ...prev, [actSel.codigo]: saved.editedRows! }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actSel]);

  const historico: ActividadMes[] = actSel ? (actMap[actSel.codigo] || []) : [];
  const displayRows = editMode ? editRows : historico;
  const ultimo = displayRows[displayRows.length - 1];

  function startEdit() {
    setEditRows(JSON.parse(JSON.stringify(historico)));
    setEditMode(true);
  }
  function cancelEdit() { setEditMode(false); setEditRows([]); }
  function saveEdit() {
    if (!actSel) return;
    setActMap(prev => ({ ...prev, [actSel.codigo]: editRows }));
    // Persist projection + edited historical rows to Supabase
    const projEntry: ProjData = { tarifas: proyTarifas, dias: proyDias, wd: proyWD, ufVal: proyUFVal, editedRows: editRows };
    const updated = { ...savedProj, [actSel.codigo]: projEntry };
    setSavedProj(updated);
    fetch("/api/settings/fin-kpi-proy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => {});
    setEditMode(false);
    setEditRows([]);
  }
  // costoNorm = round(totalCostos / workingDays * 20.75)  — normalized to a 20.75-day month
  // Uses workingDays of the month (e.g. 21 for April), NOT sum of consultant days
  // margen = produccion - costoNorm  (matches Excel formula)
  function recalc(r: ActividadMes, hc: typeof r.headcount, produccion?: number): ActividadMes {
    const totalCostos = hc.reduce((s, h) => s + h.costoMes, 0);
    const wd          = r.workingDays > 0 ? r.workingDays : 20.75;
    const costoNorm   = Math.round(totalCostos * 20.75 / wd);
    const prod        = produccion ?? r.produccion;
    return { ...r, headcount: hc, produccion: prod, costos: -totalCostos, costoNorm, margen: prod - costoNorm };
  }

  function handleChangeProduccion(mes: string, val: number) {
    setEditRows(rows => rows.map(r => r.mes !== mes ? r : recalc(r, r.headcount, val)));
  }
  function handleChangeDias(mes: string, nombre: string, dias: number) {
    setEditRows(rows => rows.map(r => {
      if (r.mes !== mes) return r;
      const existing = r.headcount.find(h => h.nombre === nombre);
      let hc;
      if (existing) {
        // Consultant already in this month's headcount — update dias
        hc = r.headcount.map(h => {
          if (h.nombre !== nombre) return h;
          const costoMes = Math.round(dias * h.costoDiario);
          const fte = r.workingDays > 0 ? parseFloat((dias / r.workingDays).toFixed(2)) : 0;
          return { ...h, dias, costoMes, fte };
        });
      } else {
        // Consultant not in this month — add them (lookup costoDiario from allConsultants)
        const costoDiario = allConsultants.find(c => c.nombre === nombre)?.costoDiario ?? 0;
        const costoMes = Math.round(dias * costoDiario);
        const fte = r.workingDays > 0 ? parseFloat((dias / r.workingDays).toFixed(2)) : 0;
        hc = [...r.headcount, { nombre, dias, fte, costoDiario, costoMes }];
      }
      return recalc(r, hc);
    }));
  }
  function handleAddConsultant(nombre: string, costoDiario: number) {
    setEditRows(rows => rows.map(r => {
      if (r.headcount.find(h => h.nombre === nombre)) return r;
      return recalc(r, [...r.headcount, { nombre, dias: 0, fte: 0, costoDiario, costoMes: 0 }]);
    }));
  }
  function handleRemoveConsultant(nombre: string) {
    setEditRows(rows => rows.map(r => recalc(r, r.headcount.filter(h => h.nombre !== nombre))));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">SII Group Chile</div>
        <h2 className="text-xl font-medium text-foreground mb-1">Activity Detail & Calculator</h2>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${catalogo.length} activities · FY 2025-2026 · Margin spreadsheet replica`}
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Activity</div>
        <BuscadorActividad onSelect={a => { setActSel(a); }} selected={actSel} catalogo={catalogo} />
        {actSel && (
          <button className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setActSel(null)}>× Clear</button>
        )}
      </div>

      {!actSel ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {loading ? "Loading activity data..." : "Select an activity to view monthly KPIs with headcount and projection"}
          </p>
          {!loading && (
            <div className="flex gap-2 justify-center flex-wrap">
              {catalogo.slice(0, 6).map(a => (
                <button key={a.codigo} onClick={() => setActSel(a)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/40 transition-colors">
                  {a.codigo.slice(-10)} · {a.cliente.slice(0, 22)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Activity header */}
          <div style={{background:"#17375e",color:"#fff",padding:"12px 18px",
            display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:9,opacity:0.65,textTransform:"uppercase",letterSpacing:"0.06em"}}>IFS Code</div>
              <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700}}>{actSel.codigo}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,opacity:0.7}}>{actSel.cliente}</div>
              <div style={{fontSize:14,fontWeight:500,marginTop:2}}>{actSel.descripcion}</div>
            </div>
            {ultimo && (
              <div style={{fontSize:11,opacity:0.75,textAlign:"right"}}>
                <div>IRM: {ultimo.irm}</div>
                <div>Last: {MES_LABEL[ultimo.mes] || ultimo.mes}</div>
              </div>
            )}
            {/* Edit controls */}
            <div style={{display:"flex",gap:8}}>
              {!editMode ? (
                <button onClick={startEdit}
                  style={{padding:"5px 14px",background:"#fff",color:"#17375e",border:"none",
                    borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  ✎ Edit
                </button>
              ) : (
                <>
                  <button onClick={saveEdit}
                    style={{padding:"5px 14px",background:"#16a34a",color:"#fff",border:"none",
                      borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    ✓ Save
                  </button>
                  <button onClick={cancelEdit}
                    style={{padding:"5px 14px",background:"rgba(255,255,255,0.15)",color:"#fff",
                      border:"1px solid rgba(255,255,255,0.4)",borderRadius:6,fontWeight:600,fontSize:12,cursor:"pointer"}}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          {editMode && (
            <div style={{background:"#fffde7",borderBottom:"0.5px solid #ffc107",
              padding:"6px 14px",fontSize:11,color:"#856404"}}>
              ✎ Edit mode — modify production values and consultant days. Margin recalculates automatically.
            </div>
          )}
          {!editMode && (
            <div style={{background:"#fff3cd",borderBottom:"0.5px solid #ffc107",
              padding:"6px 14px",fontSize:11,color:"#856404"}}>
              ⚡ Projection columns ({PROY_MESES.map(m => MES_LABEL[m]).join(", ")}) — enter UF rate to project margin.
            </div>
          )}

          {historico.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No FY 2025-2026 data available for this activity.
            </div>
          ) : (
            <div className="p-4">
              <TablaActividad
                actividad={actSel} proyTarifas={proyTarifas} onProyChange={(mes, v) => setProyTarifas(prev => ({...prev, [mes]: v}))}
                proyDias={proyDias} onProyDiasChange={(mes, nombre, dias) => setProyDias(prev => ({...prev, [mes]: {...(prev[mes]||{}), [nombre]: dias}}))}
                proyWD={proyWD} onProyWDChange={(mes, wd) => setProyWD(prev => ({...prev, [mes]: wd}))}
                proyUFVal={proyUFVal} onProyUFChange={(mes, uf) => setProyUFVal(prev => ({...prev, [mes]: uf}))}
                actividadesMap={actMap}
                editMode={editMode} editRows={editRows} allConsultants={allConsultants}
                onChangeProduccion={handleChangeProduccion}
                onChangeDias={handleChangeDias}
                onAddConsultant={handleAddConsultant}
                onRemoveConsultant={handleRemoveConsultant}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { projects } = useData();
  const t = useT();
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState<"cor" | "transformation" | "financial-kpi" | "career-path">("cor");

  const today = new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="space-y-4">

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["cor","transformation","financial-kpi","career-path"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-xs font-semibold rounded-t-lg transition-colors -mb-px ${
              activeTab===tab
                ? "bg-white border border-b-white border-border text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {tab==="cor" ? "COR" : tab==="transformation" ? "Transformation" : tab==="financial-kpi" ? "Financial KPI" : "Career Path"}
          </button>
        ))}
      </div>

      {/* ── COR Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "cor" && <CORView />}

      {/* ── Transformation Tab ───────────────────────────────────────────── */}
      {activeTab === "transformation" && <TransformationView />}

      {/* ── Financial KPI Tab ────────────────────────────────────────────── */}
      {activeTab === "financial-kpi" && <FinancialKPIView />}

      {/* ── Career Path Tab ──────────────────────────────────────────────── */}
      {activeTab === "career-path" && <CareerPathTab />}

    </div>
  );
}
