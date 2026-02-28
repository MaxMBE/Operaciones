"use client";

import { useMemo, useState, useEffect, useCallback, Fragment } from "react";
import { useData } from "@/lib/data-context";
import { useT } from "@/lib/i18n";
import {
  PieChart, Pie, Cell, Tooltip as ReTT,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { Project, ProjectReport, HealthStatus } from "@/types";
import {
  CheckCircle2, TrendingUp, DollarSign,
  ChevronDown, ChevronRight, Target, Gauge, Pencil,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────


const CHART_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6"];

// ── COR manual override ────────────────────────────────────────────────────────

const COR_MANUAL_KEY = "cor_manual_data";

interface CORManual {
  revenue: string; cost: string; otd: string; oqd: string;
  customers: string; models: string; margins: string;
}

const EMPTY_MANUAL: CORManual = { revenue:"", cost:"", otd:"", oqd:"", customers:"", models:"", margins:"" };

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

const WEATHER_KEYS = ["G","A","R","grey","B"] as const;
type WeatherKey = typeof WEATHER_KEYS[number];

function makeWeather(t: ReturnType<typeof useT>) {
  return {
    G:    { icon: "☀️",  label: t.cor_weather_on_track, bg: "bg-green-50",  text: "text-green-700",  border: "border-green-300" },
    A:    { icon: "⛅",  label: t.cor_weather_at_risk,  bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-300" },
    R:    { icon: "⛈️", label: t.cor_weather_critical, bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300"   },
    grey: { icon: "☁️",  label: t.cor_weather_na,       bg: "bg-gray-50",   text: "text-gray-500",   border: "border-gray-200"  },
    B:    { icon: "🌤️", label: t.cor_weather_stable,   bg: "bg-blue-50",   text: "text-blue-600",   border: "border-blue-200"  },
  } as Record<WeatherKey, { icon: string; label: string; bg: string; text: string; border: string }>;
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
  const w = (makeWeather as unknown as (t: { cor_weather_on_track: string; cor_weather_at_risk: string; cor_weather_critical: string; cor_weather_na: string; cor_weather_stable: string }) => ReturnType<typeof makeWeather>)({ cor_weather_on_track: "On Track", cor_weather_at_risk: "At Risk", cor_weather_critical: "Critical", cor_weather_na: "N/A", cor_weather_stable: "Stable" })[value as WeatherKey] ?? { icon: "☁️", label: "N/A", text: "text-gray-500" };
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
        </select>
      ) : (
        <span className={`text-[10px] font-medium ${w.text}`}>{w.icon} {w.label}</span>
      )}
    </div>
  );
}

// ── Project Detail Panel ──────────────────────────────────────────────────────

function ProjectDetailPanel({
  project: p,
  report: rep,
  onSaveProject,
  onSaveReport,
}: {
  project: Project;
  report?: ProjectReport;
  onSaveProject: (changes: Partial<Project>) => void;
  onSaveReport:  (changes: Partial<ProjectReport>) => void;
}) {
  const t = useT();

  const [editMode, setEditMode] = useState(false);

  // Split draft into project fields and report fields
  const [draftP, setDraftP] = useState({
    client:        p.client       || "",
    manager:       p.manager      || "",
    leader:        p.leader       || "",
    serviceType:   p.serviceType  || "",
    serviceLevel:  p.serviceLevel || "",
    bu:            p.bu           || "",
    teamSize:      String(p.teamSize || ""),
    revenue:       String(p.revenue  || ""),
    budget:        String(p.budget   || ""),
    spent:         String(p.spent    || ""),
    progress:      String(p.progress || ""),
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
    marginYTD:        (rep?.marginYTD        || "").replace("%",""),
    marginActual:     (rep?.marginActual     || "").replace("%",""),
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
  });

  function setP(k: keyof typeof draftP, v: string) { setDraftP(d => ({ ...d, [k]: v })); }
  function setR(k: keyof typeof draftR, v: string) { setDraftR(d => ({ ...d, [k]: v })); }

  function handleSave() {
    onSaveProject({
      client:        draftP.client,
      manager:       draftP.manager,
      leader:        draftP.leader,
      serviceType:   draftP.serviceType,
      serviceLevel:  draftP.serviceLevel,
      bu:            draftP.bu,
      teamSize:      parseInt(draftP.teamSize) || p.teamSize,
      revenue:       parseFloat(draftP.revenue) || p.revenue,
      budget:        parseFloat(draftP.budget)  || p.budget,
      spent:         parseFloat(draftP.spent)   || p.spent,
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
      marginYTD:        draftR.marginYTD ? draftR.marginYTD + "%" : rep?.marginYTD,
      marginActual:     draftR.marginActual ? draftR.marginActual + "%" : rep?.marginActual,
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
      healthGovernance: draftR.csat || rep?.healthGovernance || "",
    });
    setEditMode(false);
  }

  function handleCancel() {
    setDraftP({
      client: p.client||"", manager: p.manager||"", leader: p.leader||"",
      serviceType: p.serviceType||"", serviceLevel: p.serviceLevel||"",
      bu: p.bu||"", teamSize: String(p.teamSize||""),
      revenue: String(p.revenue||""), budget: String(p.budget||""),
      spent: String(p.spent||""), progress: String(p.progress||""),
      expectedProgress: String(p.expectedProgress??""),
      startDate: p.startDate||"", endDate: p.endDate||"",
      csvOtdPercent: (p.csvOtdPercent||"").replace("%",""),
      csvOqdPercent: (p.csvOqdPercent||"").replace("%",""),
      shortComment: p.shortComment||"", csvRisks: p.csvRisks||"",
      csvMitigation: p.csvMitigation||"", csvNextActions: p.csvNextActions||"",
    });
    setDraftR({
      ftes: rep?.ftes||"", marginYTD: (rep?.marginYTD||"").replace("%",""),
      marginActual: (rep?.marginActual||"").replace("%",""),
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
    });
    setEditMode(false);
  }

  const weather = makeWeather(t);
  const otdVal  = parsePercent(draftP.csvOtdPercent || undefined);
  const oqdVal  = parsePercent(draftP.csvOqdPercent || undefined);
  const marginYTDNum = parsePercent(draftR.marginYTD || undefined);
  const marginNum = marginYTDNum ?? (parseFloat(draftP.revenue) > 0
    ? Math.round((parseFloat(draftP.revenue) - parseFloat(draftP.spent)) / parseFloat(draftP.revenue) * 100)
    : null);
  const budgetDev = parseFloat(draftP.budget) > 0
    ? Math.round((parseFloat(draftP.revenue) - parseFloat(draftP.budget)) / parseFloat(draftP.budget) * 100)
    : null;
  const marginDev = marginNum !== null ? Math.round(marginNum - 34) : null;
  const fmtDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="p-4 border-t border-indigo-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
          {p.name}
        </h4>
        <div className="flex items-center gap-2">
          {editMode ? (
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

      <div className="grid grid-cols-3 gap-4">

        {/* ── Left: General Info + Highlights ──────────────────────────── */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">{t.cor_general_info}</h4>
              {!editMode && <span className="text-sm">{weather[draftR.overallStatus as WeatherKey]?.icon ?? "☁️"}</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <EF label={t.cor_client_label} value={draftP.client}      editMode={editMode} onChange={v => setP("client", v)} />
              <EF label="PM"                  value={draftP.manager}     editMode={editMode} onChange={v => setP("manager", v)} />
              <EF label="Leader"              value={draftP.leader}      editMode={editMode} onChange={v => setP("leader", v)} />
              <EF label={t.cor_phase_label}   value={draftR.phase}       editMode={editMode} onChange={v => setR("phase", v)} />
              <EF label={t.cor_model_label}   value={draftP.serviceType} editMode={editMode} onChange={v => setP("serviceType", v)} />
              <EF label="FTEs"                value={draftR.ftes || draftP.teamSize} editMode={editMode} onChange={v => setR("ftes", v)} />
              <EF label="BU"                  value={draftP.bu}          editMode={editMode} onChange={v => setP("bu", v)} />
              <EF label={t.cor_svc_level}     value={draftP.serviceLevel} editMode={editMode} onChange={v => setP("serviceLevel", v)} />
              <EF label={t.cor_start_label}   value={editMode ? draftP.startDate : fmtDate(draftP.startDate)} editMode={editMode} onChange={v => setP("startDate", v)} type="date" />
              <EF label={t.cor_end_label}     value={editMode ? draftP.endDate   : fmtDate(draftP.endDate)}   editMode={editMode} onChange={v => setP("endDate", v)} type="date" />
              {editMode && (
                <SEF label={t.cor_status_col} value={draftR.overallStatus} editMode={editMode} onChange={v => setR("overallStatus", v)} />
              )}
              <EF label="CSAT (1-4)"          value={draftR.csat}        editMode={editMode} onChange={v => setR("csat", v)} />
            </div>
          </div>

          {/* Highlights */}
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide mb-2">Highlights</h4>
            <div className="space-y-2">
              {editMode ? (
                <>
                  <EF label={t.cor_achievements_label} value={draftR.achievements} editMode={editMode} onChange={v => setR("achievements", v)} textarea />
                  <EF label={t.cor_issues_label}        value={draftR.currentIssues} editMode={editMode} onChange={v => setR("currentIssues", v)} textarea />
                  <EF label="Comentario"                value={draftP.shortComment}  editMode={editMode} onChange={v => setP("shortComment", v)} textarea />
                </>
              ) : (
                <>
                  {draftR.achievements && (
                    <div>
                      <p className="text-[9px] font-semibold text-emerald-700 mb-0.5">{t.cor_achievements_label}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{draftR.achievements}</p>
                    </div>
                  )}
                  {draftR.currentIssues && (
                    <div>
                      <p className="text-[9px] font-semibold text-amber-700 mb-0.5">{t.cor_issues_label}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{draftR.currentIssues}</p>
                    </div>
                  )}
                  {draftP.shortComment && !draftR.currentIssues && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{draftP.shortComment}</p>
                  )}
                  {!draftR.achievements && !draftR.currentIssues && !draftP.shortComment && (
                    <p className="text-[10px] text-muted-foreground italic">—</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Center: Financial KPIs + Improvement Plan ─────────────────── */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide mb-2">Financial KPIs</h4>
            {editMode ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <EF label="Revenue"         value={draftP.revenue}    editMode={editMode} onChange={v => setP("revenue", v)} />
                <EF label="Budget/Forecast" value={draftP.budget}     editMode={editMode} onChange={v => setP("budget", v)} />
                <EF label="Costo/Gasto"     value={draftP.spent}      editMode={editMode} onChange={v => setP("spent", v)} />
                <EF label="Margen YTD %"    value={draftR.marginYTD}  editMode={editMode} onChange={v => setR("marginYTD", v)} />
                <EF label="Margen Actual %"  value={draftR.marginActual} editMode={editMode} onChange={v => setR("marginActual", v)} />
                {draftP.serviceType === "Fixed Price" && <>
                  <EF label="Avance %"        value={draftP.progress}   editMode={editMode} onChange={v => setP("progress", v)} />
                  <EF label="Avance Plan %"   value={draftP.expectedProgress} editMode={editMode} onChange={v => setP("expectedProgress", v)} />
                </>}
              </div>
            ) : (
              <table className="w-full text-[9px]">
                <thead>
                  <tr>
                    <th className="text-left font-semibold text-muted-foreground py-1 pr-2 border-b border-gray-200">KPI</th>
                    <th className="text-right font-semibold text-muted-foreground py-1 px-1 border-b border-gray-200">{t.pf_forecast_col}</th>
                    <th className="text-right font-semibold text-muted-foreground py-1 px-1 border-b border-gray-200">{t.cor_ytd_actual_col}</th>
                    <th className="text-right font-semibold text-muted-foreground py-1 pl-1 border-b border-gray-200">{t.cor_dev_col}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-1 pr-2 font-medium">Revenue</td>
                    <td className="py-1 px-1 text-right">{formatCurrency(parseFloat(draftP.budget)||0)}</td>
                    <td className="py-1 px-1 text-right font-semibold">{formatCurrency(parseFloat(draftP.revenue)||0)}</td>
                    <td className={`py-1 pl-1 text-right font-semibold ${budgetDev!==null?(budgetDev>=0?"text-emerald-700":"text-red-600"):"text-gray-400"}`}>
                      {budgetDev!==null?`${budgetDev>0?"+":""}${budgetDev}%`:"—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium">{t.cor_total_cost_kpi}</td>
                    <td className="py-1 px-1 text-right">{formatCurrency(parseFloat(draftP.budget)*0.6||0)}</td>
                    <td className="py-1 px-1 text-right font-semibold">{formatCurrency(parseFloat(draftP.spent)||0)}</td>
                    <td className="py-1 pl-1 text-right text-gray-400">—</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium">Gross Margin</td>
                    <td className="py-1 px-1 text-right">34%</td>
                    <td className={`py-1 px-1 text-right font-semibold ${marginNum!==null?(marginNum>=34?"text-emerald-700":marginNum>=25?"text-amber-700":"text-red-600"):"text-gray-400"}`}>
                      {marginNum!==null?`${marginNum}%`:"—"}
                    </td>
                    <td className={`py-1 pl-1 text-right font-semibold ${marginDev!==null?(marginDev>=0?"text-emerald-700":"text-red-600"):"text-gray-400"}`}>
                      {marginDev!==null?`${marginDev>0?"+":""}${marginDev}pp`:"—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium">FTE Man-days</td>
                    <td className="py-1 px-1 text-right">{draftP.teamSize||"—"}</td>
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
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide mb-2">Improvement Plan</h4>
            {editMode ? (
              <div className="space-y-2">
                <EF label="Actions in Progress" value={draftR.actionsInProgress} editMode={editMode} onChange={v => setR("actionsInProgress", v)} textarea />
                <EF label="Next Steps"           value={draftR.nextSteps}         editMode={editMode} onChange={v => setR("nextSteps", v)} textarea />
                <EF label="Next Actions (CSV)"   value={draftP.csvNextActions}    editMode={editMode} onChange={v => setP("csvNextActions", v)} textarea />
              </div>
            ) : (
              <div className="space-y-1.5">
                {(draftR.actionsInProgress || draftR.nextSteps || draftP.csvNextActions)
                  ? (draftR.actionsInProgress || draftR.nextSteps || draftP.csvNextActions)
                      .split(/[;\n]/)
                      .filter(Boolean)
                      .slice(0, 6)
                      .map((action, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-[9px] font-bold text-indigo-500 flex-shrink-0 mt-0.5">{String(i+1).padStart(2,"0")}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{action.trim()}</span>
                        </div>
                      ))
                  : <p className="text-[10px] text-muted-foreground italic">—</p>
                }
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
          <div className="bg-white rounded-lg border border-indigo-200 p-3">
            <h4 className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">Key Risks</h4>
            {editMode ? (
              <div className="space-y-2">
                <EF label="Key Risks (Reporte)"   value={draftR.keyRisks}      editMode onChange={v => setR("keyRisks", v)} textarea />
                <EF label="Key Risks (CSV)"        value={draftP.csvRisks}      editMode onChange={v => setP("csvRisks", v)} textarea />
                <EF label={t.cor_mitigation_label + " (Reporte)"} value={draftR.mitigation}    editMode onChange={v => setR("mitigation", v)} textarea />
                <EF label={t.cor_mitigation_label + " (CSV)"}     value={draftP.csvMitigation} editMode onChange={v => setP("csvMitigation", v)} textarea />
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {draftR.keyRisks || draftP.csvRisks || "—"}
                </p>
                {(draftR.mitigation || draftP.csvMitigation) && (
                  <>
                    <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mt-2 mb-1">{t.cor_mitigation_label}</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {draftR.mitigation || draftP.csvMitigation}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// ── COR View ─────────────────────────────────────────────────────────────────

function CORView() {
  const { projects, reportData, updateProject, updateReport } = useData();
  const t = useT();
  const WEATHER = useMemo(() => makeWeather(t), [t]);

  const [selectedId, setSelectedId]  = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);

  // ── Manual override state ─────────────────────────────────────────────
  const [overrideMode, setOverrideMode] = useState(false);
  const [manualData, setManualData] = useState<CORManual>(EMPTY_MANUAL);
  const [draftManual, setDraftManual] = useState<CORManual>(EMPTY_MANUAL);

  // Load manualData from localStorage after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    try {
      const s = localStorage.getItem(COR_MANUAL_KEY);
      if (s) setManualData(JSON.parse(s));
    } catch {}
  }, []);
  const hasManual = Object.values(manualData).some(v => v !== "");

  function openOverride() { setDraftManual({ ...manualData }); setOverrideMode(true); }
  function saveOverride() {
    setManualData(draftManual);
    try { localStorage.setItem(COR_MANUAL_KEY, JSON.stringify(draftManual)); } catch {}
    setOverrideMode(false);
  }
  function cancelOverride() { setOverrideMode(false); }
  function clearOverride() {
    setManualData(EMPTY_MANUAL);
    setDraftManual(EMPTY_MANUAL);
    try { localStorage.removeItem(COR_MANUAL_KEY); } catch {}
  }
  function setDM(k: keyof CORManual, v: string) { setDraftManual(d => ({ ...d, [k]: v })); }

  const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

  // ── Calculated KPIs (from project data) ────────────────────────────────
  const corKPIsCalc = useMemo(() => {
    const active = projects.filter(p => p.status !== "on-hold");
    const totalRevenue = active.reduce((s, p) => s + (p.revenue || 0), 0);
    const totalCost    = active.reduce((s, p) => s + (p.spent   || 0), 0);
    const grossMargin  = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    const otdVals = active.map(p => parsePercent(p.csvOtdPercent)).filter((v): v is number => v !== null);
    const oqdVals = active.map(p => parsePercent(p.csvOqdPercent)).filter((v): v is number => v !== null);
    const avgOTD  = otdVals.length ? otdVals.reduce((s,v) => s+v, 0) / otdVals.length : null;
    const avgOQD  = oqdVals.length ? oqdVals.reduce((s,v) => s+v, 0) / oqdVals.length : null;
    const wc = { G: 0, A: 0, R: 0, grey: 0 };
    active.forEach(p => { const k = reportData[p.id]?.overallStatus ?? "grey"; if (k in wc) wc[k as keyof typeof wc]++; });
    return { totalRevenue, totalCost, grossMargin, avgOTD, avgOQD, activeCount: active.length, wc };
  }, [projects, reportData]);

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

  const modelDataCalc = useMemo(() => {
    const map: Record<string,number> = {};
    projects.forEach(p => { const k = p.serviceType||"Otro"; map[k] = (map[k]||0)+(p.revenue||0); });
    const total = Object.values(map).reduce((s,v)=>s+v,0);
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value, pct: total>0?Math.round(value/total*100):0 }));
  }, [projects]);

  const marginBarDataCalc = useMemo(() =>
    [...projects].filter(p=>p.revenue>0)
      .sort((a,b) => (b.revenue-b.spent)/b.revenue - (a.revenue-a.spent)/a.revenue)
      .slice(0,10)
      .map(p => ({
        name:   p.name.length>14?p.name.slice(0,12)+"…":p.name,
        margin: parseFloat(reportData[p.id]?.marginYTD?.replace("%","")||String(Math.round((p.revenue-p.spent)/p.revenue*100))),
        target: 34,
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

  const marginBarData = useMemo(() => {
    if (!manualData.margins) return marginBarDataCalc;
    return parseCORCSV(manualData.margins).map(d => ({
      name: d.name.length>14?d.name.slice(0,12)+"…":d.name, margin: d.value, target: 34,
    }));
  }, [manualData.margins, marginBarDataCalc]);

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedId), [projects, selectedId]);
  const selectedReport  = useMemo(() => selectedId ? reportData[selectedId] : undefined, [reportData, selectedId]);

  // ── Save cell edit ────────────────────────────────────────────────────
  const commitCell = useCallback(() => {
    if (!editingCell) return;
    const { id, field, value } = editingCell;
    if (field === "otd")    updateProject(id, { csvOtdPercent: value ? value+"%" : "" });
    if (field === "oqd")    updateProject(id, { csvOqdPercent: value ? value+"%" : "" });
    if (field === "margin") updateReport(id, { marginYTD: value ? value+"%" : "" });
    if (field === "ftes")   updateReport(id, { ftes: value });
    if (field === "status") updateReport(id, { overallStatus: value as HealthStatus });
    if (field === "csat")   updateReport(id, { healthGovernance: value });
    setEditingCell(null);
  }, [editingCell, updateProject, updateReport]);

  function cellInput(id: string, field: string, currentVal: string, isSelect?: boolean) {
    const active = editingCell?.id === id && editingCell?.field === field;
    if (active) {
      if (isSelect) {
        return (
          <select
            autoFocus
            value={editingCell.value}
            onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
            onBlur={commitCell}
            className="text-[9px] border border-indigo-300 rounded p-0.5 bg-white w-full"
          >
            <option value="G">☀️ On Track</option>
            <option value="A">⛅ At Risk</option>
            <option value="R">⛈️ Critical</option>
            <option value="grey">☁️ N/A</option>
            <option value="B">🌤️ Stable</option>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.cor_title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t.cor_subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-muted/40 border border-border px-3 py-1.5 rounded-lg">{today}</span>
          <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium px-3 py-1.5 rounded-lg">
            {projects.length} {t.pf_services}
          </span>
          {hasManual && !overrideMode && (
            <span className="flex items-center gap-1.5 bg-violet-50 border border-violet-300 text-violet-700 font-medium px-2.5 py-1.5 rounded-lg">
              <span className="text-base leading-none">📊</span>
              <span>Datos manuales</span>
              <button onClick={clearOverride} title="Limpiar datos manuales" className="ml-1 text-violet-400 hover:text-red-500 transition-colors font-bold leading-none">×</button>
            </span>
          )}
          {!overrideMode && (
            <button
              onClick={openOverride}
              className="flex items-center gap-1.5 bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Editar overview
            </button>
          )}
        </div>
      </div>

      {/* ── Manual Override Panel ──────────────────────────────────────── */}
      {overrideMode && (
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
          <div className="grid grid-cols-4 gap-3">
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
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Customer Delivery", key: "customers" as const, hint: "Una línea por cliente: Cliente,Revenue\nEj: Transbank,500000" },
              { label: "Delivery Model",    key: "models"    as const, hint: "Una línea por modelo: Modelo,Revenue\nEj: Fixed Price,300000" },
              { label: "Gross Margin por Servicio", key: "margins" as const, hint: "Una línea por servicio: Servicio,Margen%\nEj: Proyecto ABC,45" },
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

      {/* ── Global KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {/* Revenue */}
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-medium text-muted-foreground">{t.cor_revenue_total_kpi}</span>
          </div>
          <p className="text-lg font-bold text-foreground leading-none">{formatCurrency(corKPIs.totalRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{t.cor_cost_label} {formatCurrency(corKPIs.totalCost)}</p>
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
        </div>

        {/* Weather summary */}
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Gauge className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-medium text-muted-foreground">{t.cor_overall_status}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm">☀️</span><span className="text-[11px] font-bold text-emerald-700">{corKPIs.wc.G}</span>
            <span className="text-sm">⛅</span><span className="text-[11px] font-bold text-amber-700">{corKPIs.wc.A}</span>
            <span className="text-sm">⛈️</span><span className="text-[11px] font-bold text-red-700">{corKPIs.wc.R}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{corKPIs.activeCount} {t.cor_active_services}</p>
        </div>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

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
                <ReTT contentStyle={{ fontSize:10, padding:"3px 8px", borderRadius:6 }} formatter={(v:number)=>[formatCurrency(v),""]} />
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
                <ReTT contentStyle={{ fontSize:10, padding:"3px 8px", borderRadius:6 }} formatter={(v:number)=>[formatCurrency(v),""]} />
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
              <ReTT contentStyle={{ fontSize:10, padding:"3px 8px", borderRadius:6 }} formatter={(v:number)=>[formatCurrency(v),"Revenue"]} />
              <Bar dataKey="revenue" radius={[0,3,3,0]}>
                {revenueBarData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gross Margin Bar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold">{t.cor_margin_by_service}</h3>
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />{t.cor_ytd_margin_legend}</div>
            <div className="flex items-center gap-1"><svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="4 2" /></svg>{t.cor_target_40}</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={marginBarData} margin={{ top:4, right:8, bottom:28, left:-10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:8 }} interval={0} angle={-35} textAnchor="end" height={44} />
            <YAxis domain={[0,100]} tick={{ fontSize:9 }} tickFormatter={v=>`${v}%`} />
            <ReTT contentStyle={{ fontSize:10, padding:"3px 8px", borderRadius:6 }} formatter={(v:number,name:string)=>[`${v}%`,name==="margin"?"Margen":"Target"]} />
            <Bar dataKey="margin" radius={[3,3,0,0]}>
              {marginBarData.map((d,i) => <Cell key={i} fill={d.margin>=34?"#10b981":d.margin>=25?"#f59e0b":"#ef4444"} />)}
            </Bar>
            <Line type="monotone" dataKey="target" stroke="#f97316" strokeWidth={2} strokeDasharray="5 3" dot={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Projects Overview Table ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold">{t.cor_projects_overview}</h3>
          <p className="text-[10px] text-muted-foreground">{t.cor_click_detail}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-gray-800 text-white text-left">
                <th className="px-3 py-2 font-medium w-5"></th>
                <th className="px-3 py-2 font-medium">{t.cor_client_label}</th>
                <th className="px-3 py-2 font-medium">Proyecto / Servicio</th>
                <th className="px-3 py-2 font-medium">PM</th>
                <th className="px-3 py-2 font-medium text-center">FTEs <Pencil className="w-2.5 h-2.5 inline opacity-50" /></th>
                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                <th className="px-3 py-2 font-medium text-right">{t.cor_margin_ytd_col} <Pencil className="w-2.5 h-2.5 inline opacity-50" /></th>
                <th className="px-3 py-2 font-medium text-center">OTD <Pencil className="w-2.5 h-2.5 inline opacity-50" /></th>
                <th className="px-3 py-2 font-medium text-center">OQD <Pencil className="w-2.5 h-2.5 inline opacity-50" /></th>
                <th className="px-3 py-2 font-medium text-center">CSAT <Pencil className="w-2.5 h-2.5 inline opacity-50" /></th>
                <th className="px-3 py-2 font-medium text-center">{t.cor_status_col} <Pencil className="w-2.5 h-2.5 inline opacity-50" /></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => {
                const rep      = reportData[p.id];
                const weather  = WEATHER[rep?.overallStatus ?? "grey"] ?? WEATHER.grey;
                const otdVal   = parsePercent(p.csvOtdPercent);
                const oqdVal   = parsePercent(p.csvOqdPercent);
                const marginPct = rep?.marginYTD
                  ? parsePercent(rep.marginYTD)
                  : p.revenue > 0 ? Math.round((p.revenue-p.spent)/p.revenue*100) : null;
                const ftes  = rep?.ftes || String(p.teamSize||"—");
                const csat  = csatFromHealth(rep?.healthGovernance);
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
                        {p.serviceType && <div className="text-[9px] text-muted-foreground font-normal">{p.serviceType}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[80px]">{p.manager||"—"}</td>

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

                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.revenue||0)}</td>

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
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium border ${weather.bg} ${weather.text} ${weather.border}`}>
                              {weather.icon} {weather.label}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* ── Expanded Detail ────────────────────────────────── */}
                    {isOpen && selectedProject && selectedProject.id === p.id && (
                      <tr>
                        <td colSpan={11} className="p-0 bg-indigo-50/60">
                          <ProjectDetailPanel
                            project={selectedProject}
                            report={selectedReport}
                            onSaveProject={changes => updateProject(p.id, changes)}
                            onSaveReport={changes => updateReport(p.id, changes)}
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

      {/* ── KPI Definitions ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold mb-3">{t.cor_kpi_def_title}</h3>
        <div className="grid grid-cols-3 gap-x-8 gap-y-2">
          {[
            { name: "Monthly Margin %",  formula: t.cor_formula_monthly },
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { projects } = useData();
  const t = useT();
  const [activeTab, setActiveTab] = useState<"cor" | "transformation">("cor");

  const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Advanced Project Plan &amp; Portfolio Management
          </h1>
          <span className="text-xs text-muted-foreground">
            Portfolio Visibility · Planning · Tracking · Reporting
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-muted/40 border border-border px-3 py-1.5 rounded-lg">{today}</span>
          <span className="bg-blue-50 border border-blue-200 text-blue-700 font-medium px-3 py-1.5 rounded-lg">
            {projects.length} {t.pf_services}
          </span>
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["cor","transformation"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-xs font-semibold rounded-t-lg transition-colors -mb-px ${
              activeTab===tab
                ? "bg-white border border-b-white border-border text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {tab==="cor"?"COR":"Transformation"}
          </button>
        ))}
      </div>

      {/* ── COR Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "cor" && <CORView />}

      {/* ── Transformation Tab ───────────────────────────────────────────── */}
      {activeTab === "transformation" && <TransformationView />}

    </div>
  );
}
