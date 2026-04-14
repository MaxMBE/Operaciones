"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { useData } from "@/lib/data-context";
import { BurndownChart } from "@/components/metrics/burndown-chart";
import { ServicesTimelineChart } from "@/components/metrics/services-timeline-chart";
import { formatClpToUsd } from "@/lib/utils";
import type { Project, ProjectStatus, HealthStatus, ProjectReport } from "@/types";
import { Search, X, Pencil, Check, FileText, Trash2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { PrintButton } from "@/components/print-button";
import { PrintHeader } from "@/components/print-header";
import { MultiFilter } from "@/components/multi-filter";
import { Plus } from "lucide-react";

// ── Weekly Report Panel helpers ────────────────────────────────────────────────

const HEALTH_META: Record<HealthStatus, { label: string; bg: string; text: string; border: string }> = {
  G:    { label: "G",  bg: "bg-emerald-500", text: "text-white",    border: "border-emerald-600" },
  A:    { label: "A",  bg: "bg-amber-400",   text: "text-white",    border: "border-amber-500"   },
  R:    { label: "R",  bg: "bg-red-500",     text: "text-white",    border: "border-red-600"     },
  grey: { label: "—",  bg: "bg-gray-300",    text: "text-gray-600", border: "border-gray-400"    },
  B:    { label: "B",  bg: "bg-blue-500",    text: "text-white",    border: "border-blue-600"    },
  done: { label: "✅", bg: "bg-teal-500",    text: "text-white",    border: "border-teal-600"    },
};

const RISK_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  G:    { label: "LOW",      bg: "bg-emerald-100", text: "text-emerald-700" },
  A:    { label: "ELEVATED", bg: "bg-amber-100",   text: "text-amber-700"   },
  R:    { label: "CRITICAL", bg: "bg-red-100",     text: "text-red-700"     },
  grey: { label: "N/A",      bg: "bg-gray-100",    text: "text-gray-500"    },
  B:    { label: "STABLE",   bg: "bg-blue-100",    text: "text-blue-700"    },
  done: { label: "DONE",     bg: "bg-teal-100",    text: "text-teal-700"    },
};

const WEATHER_ICON: Record<string, string> = {
  G: "☀️", A: "⛅", R: "⛈️", grey: "☁️", B: "🌤️", done: "✅",
};

const TREND_ICON: Record<string, { icon: string; cls: string }> = {
  up:   { icon: "↑", cls: "text-emerald-300" },
  same: { icon: "→", cls: "text-gray-300"    },
  down: { icon: "↓", cls: "text-red-300"     },
};

const HEALTH_OPTIONS: HealthStatus[] = ["G", "A", "R", "grey", "B", "done"];

const INDICATORS: { key: string; label: string; field: keyof ProjectReport }[] = [
  { key: "T", label: "Compliance with expected deadlines", field: "milestonesStatus" },
  { key: "Q", label: "Compliance with expected quality",   field: "issuesStatus"     },
  { key: "C", label: "Estimated customer satisfaction",    field: "currentStatus"    },
  { key: "M", label: "Team Mood",                          field: "teamMood"         },
  { key: "P", label: "Productivity",                       field: "resourcesStatus"  },
  { key: "S", label: "Skill Level",                        field: "risksStatus"      },
];

function HDot({ value }: { value: string }) {
  const m = HEALTH_META[value as HealthStatus] ?? HEALTH_META.grey;
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded font-bold text-xs border ${m.bg} ${m.text} ${m.border}`}>
      {m.label}
    </span>
  );
}

function WBullets({ text, placeholder = "—" }: { text: string; placeholder?: string }) {
  if (!text?.trim()) return <p className="text-xs text-muted-foreground italic">{placeholder}</p>;
  const items = text.split(/\n|(?<=\S)\s*•\s*|;\s*/).map(s => s.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);
  if (items.length <= 1) return <p className="text-xs text-foreground whitespace-pre-wrap">{text}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-xs flex items-start gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function emptyWeeklyReport(): ProjectReport {
  return {
    marginYTD: "", marginActual: "", ftes: "", commitmentLevel: "", phase: "",
    hitoPago: "", reportDate: new Date().toISOString().slice(0, 10),
    overallStatus: "grey", currentStatus: "grey", previousStatus: "grey",
    milestonesStatus: "grey", resourcesStatus: "grey", issuesStatus: "grey", risksStatus: "grey",
    currentIssues: "", actionsInProgress: "", healthDelivery: "", healthGovernance: "", healthTeam: "",
    scopeService: "", scopeType: "", achievements: "", valueToClient: "",
    keyRisks: "", mitigation: "", nextSteps: "", focus: "", statusNote: "",
    projectScope: "", projectCurrentStatus: "", actualProgress: "", plannedProgress: "",
    otd: "grey", oqd: "", milestones: [],
  };
}

function prefillReport(p: Project): ProjectReport {
  return {
    ...emptyWeeklyReport(),
    keyRisks:        p.csvRisks      ?? "",
    mitigation:      p.csvMitigation ?? "",
    nextSteps:       p.csvNextActions ?? "",
    statusNote:      p.shortComment  ?? "",
    ftes:            String(p.teamSize || ""),
    commitmentLevel: p.serviceLevel  ?? "",
  };
}

function WeeklyReportPanel({
  project: p,
  report: savedReport,
  onSaveReport,
}: {
  project: Project;
  report: ProjectReport | undefined;
  onSaveReport: (changes: Partial<ProjectReport>) => void;
}) {
  const data: ProjectReport = savedReport ?? prefillReport(p);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [secDraft,    setSecDraft]    = useState<Partial<ProjectReport>>({});

  function openSec(key: string) {
    setSecDraft({ ...data });
    setEditSection(key);
  }

  function saveSec() {
    onSaveReport(secDraft);
    setEditSection(null);
    setSecDraft({});
  }

  function setS<K extends keyof ProjectReport>(k: K, v: ProjectReport[K]) {
    setSecDraft(d => ({ ...d, [k]: v }));
  }

  const riskMeta    = RISK_LABEL[data.risksStatus]          ?? RISK_LABEL.grey;
  const trendMeta   = TREND_ICON[data.statusTrend ?? "same"] ?? TREND_ICON.same;
  const weatherIcon = WEATHER_ICON[data.overallStatus]       ?? "☁️";

  return (
    <div className="px-4 py-3">
      {/* Modal overlay */}
      {editSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditSection(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>

            {editSection === "header" && <>
              <h2 className="font-semibold text-sm text-foreground">Edit Status & Header Info</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Overall Status</label>
                  <select value={String(secDraft.overallStatus ?? "grey")} onChange={e => setS("overallStatus", e.target.value as HealthStatus)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none">
                    {HEALTH_OPTIONS.map(s => <option key={s} value={s}>{WEATHER_ICON[s]} {s === "grey" ? "N/A" : s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status Trend</label>
                  <select value={String(secDraft.statusTrend ?? "same")} onChange={e => setS("statusTrend", e.target.value as "up" | "same" | "down")}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none">
                    <option value="up">↑ Improving</option>
                    <option value="same">→ Stable</option>
                    <option value="down">↓ Worsening</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Risk Level</label>
                  <select value={String(secDraft.risksStatus ?? "grey")} onChange={e => setS("risksStatus", e.target.value as HealthStatus)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none">
                    {HEALTH_OPTIONS.map(s => <option key={s} value={s}>{RISK_LABEL[s]?.label ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">FTEs</label>
                  <input value={String(secDraft.ftes ?? "")} onChange={e => setS("ftes", e.target.value)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none" placeholder="5" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Commitment Mode</label>
                  <input value={String(secDraft.commitmentLevel ?? "")} onChange={e => setS("commitmentLevel", e.target.value)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none" placeholder="Fixed Price / CC" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Phase</label>
                  <input value={String(secDraft.phase ?? "")} onChange={e => setS("phase", e.target.value)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none" placeholder="Design / Dev / UAT" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Short Description</label>
                  <input value={String(secDraft.statusNote ?? "")} onChange={e => setS("statusNote", e.target.value)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none" placeholder="Brief project description" />
                </div>
              </div>
            </>}

            {editSection === "indicators" && <>
              <h2 className="font-semibold text-sm text-foreground">Edit Indicators</h2>
              <div className="space-y-3">
                {INDICATORS.map(ind => (
                  <div key={ind.key} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-500 w-6 flex-shrink-0">[{ind.key}]</span>
                    <span className="text-xs text-gray-600 flex-1">{ind.label}</span>
                    <select
                      value={String((secDraft[ind.field] as string) ?? (data[ind.field] as string) ?? "grey")}
                      onChange={e => setS(ind.field, e.target.value as HealthStatus)}
                      className="text-xs border rounded-lg px-2 py-1 w-20 focus:outline-none"
                    >
                      {HEALTH_OPTIONS.map(s => <option key={s} value={s}>{s === "grey" ? "—" : s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>}

            {editSection === "content" && <>
              <h2 className="font-semibold text-sm text-foreground">Edit Report Content</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Progress & Highlights</label>
                  <textarea value={String(secDraft.achievements ?? "")} onChange={e => setS("achievements", e.target.value)}
                    rows={3} className="w-full text-xs border rounded-lg px-2 py-1.5 resize-none focus:outline-none" placeholder="• Achievement 1&#10;• Achievement 2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Focus Points</label>
                  <textarea value={String(secDraft.focus ?? "")} onChange={e => setS("focus", e.target.value)}
                    rows={3} className="w-full text-xs border rounded-lg px-2 py-1.5 resize-none focus:outline-none" placeholder="• Focus 1&#10;• Focus 2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Expected Actions / Decisions</label>
                  <textarea value={String(secDraft.nextSteps ?? "")} onChange={e => setS("nextSteps", e.target.value)}
                    rows={3} className="w-full text-xs border rounded-lg px-2 py-1.5 resize-none focus:outline-none" placeholder="• Action 1&#10;• Action 2" />
                </div>
              </div>
            </>}

            <div className="flex justify-end gap-2 pt-1 border-t border-border">
              <button onClick={() => setEditSection(null)}
                className="px-3 py-1.5 text-xs border border-border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveSec}
                className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white">

        {/* Header band */}
        <div className="bg-[#0a2463] text-white flex items-stretch flex-wrap">
          {/* Title */}
          <div className="px-4 py-3 flex flex-col justify-center border-r border-blue-800 min-w-[150px]">
            <p className="text-[9px] uppercase tracking-widest text-blue-300 font-semibold">Weekly Report</p>
            <p className="text-[11px] text-blue-100 mt-0.5">{data.reportDate || "—"}</p>
          </div>
          {/* Status | Trend | Risk */}
          <div className="flex items-stretch divide-x divide-blue-800">
            <div className="flex flex-col items-center justify-center px-5 py-2 gap-0.5">
              <p className="text-[9px] text-blue-300 uppercase tracking-wide">Status</p>
              <span className="text-2xl leading-none mt-0.5">{weatherIcon}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-5 py-2 gap-0.5">
              <p className="text-[9px] text-blue-300 uppercase tracking-wide">Status trend</p>
              <span className={`text-xl font-bold leading-none mt-0.5 ${trendMeta.cls}`}>{trendMeta.icon}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-5 py-2 gap-0.5">
              <p className="text-[9px] text-blue-300 uppercase tracking-wide">Risk level</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded mt-0.5 ${riskMeta.bg} ${riskMeta.text}`}>
                {riskMeta.label}
              </span>
            </div>
          </div>
          {/* Project meta */}
          <div className="flex items-stretch divide-x divide-blue-800 ml-auto">
            <div className="flex flex-col justify-center px-4 py-2">
              <p className="text-[9px] text-blue-300">Project ID</p>
              <p className="text-xs font-semibold mt-0.5">{p.ifsCode || "—"}</p>
            </div>
            <div className="flex flex-col justify-center px-4 py-2">
              <p className="text-[9px] text-blue-300">Commitment mode</p>
              <p className="text-xs font-semibold mt-0.5">{data.commitmentLevel || p.serviceLevel || p.serviceType || "—"}</p>
            </div>
            <div className="flex flex-col justify-center px-4 py-2">
              <p className="text-[9px] text-blue-300">Current size</p>
              <p className="text-xs font-semibold mt-0.5">{data.ftes || String(p.teamSize || "—")} FTE</p>
            </div>
            <button
              onClick={() => openSec("header")}
              className="flex items-center justify-center px-3 text-blue-400 hover:text-white hover:bg-blue-800 transition-colors border-l border-blue-800"
              title="Edit header"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Project info row */}
        <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50 text-xs">
          <div className="px-4 py-2">
            <p className="text-[9px] text-gray-400 uppercase font-medium mb-0.5">Project name</p>
            <p className="font-semibold text-gray-800">{p.name}</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-[9px] text-gray-400 uppercase font-medium mb-0.5">Customer</p>
            <p className="font-medium text-gray-700">{p.client || "—"}</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-[9px] text-gray-400 uppercase font-medium mb-0.5">Short description</p>
            <p className="text-gray-600 leading-snug">{p.shortComment || data.statusNote || "—"}</p>
          </div>
        </div>

        {/* Main area */}
        <div className="grid grid-cols-5 divide-x divide-gray-200 border-b border-gray-200" style={{ minHeight: 160 }}>
          {/* Indicators */}
          <div className="col-span-2 p-3">
            <div className="flex items-center justify-between pb-1 mb-2 border-b border-gray-200">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Detailed indicators</p>
              <button onClick={() => openSec("indicators")}
                className="text-gray-300 hover:text-primary transition-colors" title="Edit indicators">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {INDICATORS.map(ind => (
                <div key={ind.key} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 w-5 flex-shrink-0">[{ind.key}]</span>
                  <span className="text-[10px] text-gray-600 flex-1 leading-tight">{ind.label}</span>
                  <HDot value={String((data[ind.field] as string) || "grey")} />
                </div>
              ))}
            </div>
          </div>
          {/* Progress & highlights */}
          <div className="col-span-3 p-3">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide border-b border-gray-200 pb-1 mb-2">
              Progress & highlights
            </p>
            <WBullets text={data.achievements} placeholder="No highlights yet…" />
          </div>
        </div>

        {/* Bottom area */}
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          <div className="p-3">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide border-b border-gray-200 pb-1 mb-2">
              Focus points
            </p>
            <WBullets text={data.focus} placeholder="No focus points…" />
          </div>
          <div className="p-3">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide border-b border-gray-200 pb-1 mb-2">
              Expected actions / decisions
            </p>
            <WBullets text={data.nextSteps} placeholder="No actions planned…" />
          </div>
        </div>

        {/* Edit content footer */}
        <div className="border-t border-gray-100 px-3 py-1.5 flex justify-end bg-gray-50">
          <button onClick={() => openSec("content")}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors">
            <Pencil className="w-3 h-3" />
            Edit content
          </button>
        </div>

      </div>
    </div>
  );
}

// ── OverviewPage ──────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { projects, teamMembers, isDefaultData, csvFileName, rowCount, addProject, updateProject, deleteProject, reportData, updateReport } = useData();
  const router = useRouter();
  const t = useT();
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [showNewModal,  setShowNewModal]  = useState(false);
  const [newDraft, setNewDraft] = useState({
    name: "", client: "", startDate: "", endDate: "",
    status: "active" as ProjectStatus, progress: 0,
    serviceType: "", manager: "", leader: "", bu: "",
    ifsCode: "", serviceLevel: "", teamSize: 0,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);


  const statusBar: Record<ProjectStatus, string> = {
    active:    "bg-blue-500",
    completed: "bg-emerald-500",
    "at-risk": "bg-red-500",
    "on-hold": "bg-yellow-500",
    guarantee:  "bg-purple-500",
    delayed:    "bg-orange-500",
    terminated: "bg-slate-400",
  };

  function fmtRevenue(v?: number) {
    if (!v) return "—";
    if (v >= 1_000_000) return `USD ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `USD ${Math.round(v / 1_000)}K`;
    return `USD ${v}`;
  }
  function calcMargin(rev?: number, cost?: number): number | null {
    if (!rev) return null;
    return Math.round(((rev - (cost ?? 0)) / rev) * 100);
  }

  const inputCls = "w-full px-1.5 py-0.5 text-xs border border-primary rounded focus:outline-none bg-white";

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<string[]>([]);
  const [filterClient,  setFilterClient]  = useState<string[]>([]);
  const [filterType,    setFilterType]    = useState<string[]>([]);
  const [filterManager, setFilterManager] = useState<string[]>([]);
  const [filterLeader,  setFilterLeaderState] = useState<string[]>([]);
  const [filterBU,      setFilterBU]      = useState<string[]>([]);

  // Restore persisted leader filter after mount
  useEffect(() => {
    const saved = sessionStorage.getItem("overview_filterLeader");
    if (saved) {
      try { setFilterLeaderState(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  function setFilterLeader(value: string[]) {
    setFilterLeaderState(value);
    if (value.length) sessionStorage.setItem("overview_filterLeader", JSON.stringify(value));
    else sessionStorage.removeItem("overview_filterLeader");
  }

  // ── Nuevo servicio ────────────────────────────────────────────────────────
  function handleCreateService() {
    if (!newDraft.name.trim()) return;
    const newProject: Project = {
      id:          `proj-${Date.now()}`,
      name:        newDraft.name.trim(),
      client:      newDraft.client.trim()      || undefined,
      startDate:   newDraft.startDate          || "",
      endDate:     newDraft.endDate            || "",
      status:      newDraft.status,
      progress:    newDraft.progress,
      serviceType: newDraft.serviceType.trim() || undefined,
      manager:     newDraft.manager.trim()     || "",
      leader:      newDraft.leader.trim()      || undefined,
      bu:          newDraft.bu.trim()          || undefined,
      ifsCode:     newDraft.ifsCode.trim()     || undefined,
      serviceLevel:newDraft.serviceLevel.trim()|| undefined,
      teamSize:    newDraft.teamSize || 0,
      budget: 0, spent: 0, revenue: 0, tasksTotal: 0, tasksDone: 0,
    };
    addProject(newProject);
    setNewDraft({ name: "", client: "", startDate: "", endDate: "",
      status: "active", progress: 0, serviceType: "", manager: "",
      leader: "", bu: "", ifsCode: "", serviceLevel: "", teamSize: 0 });
    setShowNewModal(false);
    setMenuOpen(false);
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  function confirmDelete() {
    if (deleteTarget) { deleteProject(deleteTarget.id); setDeleteTarget(null); }
  }

  // ── Edición ───────────────────────────────────────────────────────────────
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Project>>({});

  function startEdit(p: Project) {
    setEditId(p.id);
    setEditDraft({
      name:        p.name,
      client:      p.client      ?? "",
      startDate:   p.startDate   ?? "",
      endDate:     p.endDate     ?? "",
      status:      p.status,
      progress:    p.progress,
      serviceType: p.serviceType ?? "",
      manager:     p.manager     ?? "",
      leader:      p.leader      ?? "",
    });
  }

  function saveEdit(id: string) {
    updateProject(id, {
      ...editDraft,
      progress: Number(editDraft.progress) || 0,
    });
    setEditId(null);
  }

  function field(key: keyof Project, type: "text" | "number" | "date" = "text") {
    return (
      <input
        type={type}
        value={String(editDraft[key] ?? "")}
        onChange={(e) => setEditDraft((d) => ({ ...d, [key]: e.target.value }))}
        className={inputCls}
      />
    );
  }

  const clientOptions  = useMemo(() => [...new Set(projects.map((p) => p.client).filter(Boolean))].sort() as string[], [projects]);
  const typeOptions    = useMemo(() => [...new Set(projects.map((p) => p.serviceType).filter(Boolean))].sort() as string[], [projects]);
  const managerOptions = useMemo(() => [...new Set(projects.map((p) => p.manager).filter(Boolean))].sort() as string[], [projects]);
  const leaderOptions  = useMemo(() => [...new Set(projects.map((p) => p.leader).filter(Boolean))].sort() as string[], [projects]);
  const buOptions      = useMemo(() => [...new Set(projects.map((p) => p.bu).filter(Boolean))].sort() as string[], [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filterStatus.length  && !filterStatus.includes(p.status))          return false;
      if (filterClient.length  && !filterClient.includes(p.client ?? ""))    return false;
      if (filterType.length    && !filterType.includes(p.serviceType ?? "")) return false;
      if (filterManager.length && !filterManager.includes(p.manager ?? "")) return false;
      if (filterLeader.length  && !filterLeader.includes(p.leader ?? ""))   return false;
      if (filterBU.length      && !filterBU.includes(p.bu ?? ""))           return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.name} ${p.client ?? ""} ${p.manager} ${p.leader ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projects, filterStatus, filterClient, filterType, filterManager, filterLeader, filterBU, search]);

  const hasFilters = !!(search || filterStatus.length || filterClient.length || filterType.length || filterManager.length || filterLeader.length || filterBU.length);

  function clearFilters() {
    setSearch("");
    setFilterStatus([]); setFilterClient([]); setFilterType([]);
    setFilterManager([]); setFilterLeader([]); setFilterBU([]);
    sessionStorage.removeItem("overview_filterLeader");
  }

  const statusOptions = [
    { value: "active",     label: t.status_active     },
    { value: "at-risk",    label: t.status_at_risk    },
    { value: "on-hold",    label: t.status_on_hold_alt },
    { value: "completed",  label: t.status_completed  },
    { value: "guarantee",  label: t.status_guarantee  },
    { value: "delayed",    label: t.status_delayed    },
    { value: "terminated", label: t.status_terminated },
  ];

  // ── KPIs ────────────────────────────────────────────────────────────────
  const active       = projects.filter((p) => p.status === "active").length;
  const atRisk       = projects.filter((p) => p.status === "at-risk").length;
  const totalRevenue = projects.reduce((s, p) => s + p.revenue, 0);
  const totalCosts   = projects.reduce((s, p) => s + p.spent, 0);
  const grossMargin  = totalRevenue > 0
    ? (((totalRevenue - totalCosts) / totalRevenue) * 100).toFixed(1)
    : "—";

  // ── Monthly KPI selector ────────────────────────────────────────────────
  const monthRange = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 18 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }).replace(". ", "-").replace(".", ""),
        firstDay: new Date(d.getFullYear(), d.getMonth(), 1),
        lastDay:  new Date(d.getFullYear(), d.getMonth() + 1, 0),
      };
    });
  }, []);

  const currentMonthIdx = useMemo(() => {
    const now = new Date();
    const idx = monthRange.findIndex(m => m.year === now.getFullYear() && m.month === now.getMonth());
    return idx >= 0 ? idx : monthRange.length - 1;
  }, [monthRange]);

  const [selMonthIdx, setSelMonthIdx] = useState<number | null>(null);
  const effectiveIdx = selMonthIdx ?? currentMonthIdx;
  const selMonth = monthRange[effectiveIdx];

  const monthServices = useMemo(() => {
    if (!selMonth) return [];
    return projects.filter(p => {
      const start = p.startDate ? new Date(p.startDate + "T00:00:00") : null;
      const end   = p.endDate   ? new Date(p.endDate   + "T00:00:00") : null;
      const started  = !start || start <= selMonth.lastDay;
      const notEnded = !end   || end   >= selMonth.firstDay;
      return started && notEnded;
    });
  }, [projects, selMonth]);

  const monthRevenue = useMemo(() => monthServices.reduce((s, p) => s + (p.revenueMonthly || 0), 0), [monthServices]);
  const monthCost    = useMemo(() => monthServices.reduce((s, p) => s + (p.costMonthly    || 0), 0), [monthServices]);
  const monthMargin  = monthRevenue > 0 ? ((monthRevenue - monthCost) / monthRevenue * 100) : null;

  function parseKpiPct(val?: string): number | null {
    if (!val) return null;
    const n = parseFloat(val.replace("%", "").replace(",", ".").trim());
    return isNaN(n) ? null : n;
  }
  const otdValues = useMemo(() => monthServices.map(p => parseKpiPct(p.csvOtdPercent)).filter((v): v is number => v !== null), [monthServices]);
  const oqdValues = useMemo(() => monthServices.map(p => parseKpiPct(p.csvOqdPercent)).filter((v): v is number => v !== null), [monthServices]);
  const avgOtd = otdValues.length ? otdValues.reduce((s, v) => s + v, 0) / otdValues.length : null;
  const avgOqd = oqdValues.length ? oqdValues.reduce((s, v) => s + v, 0) / oqdValues.length : null;

  function fmtM(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  return (
    <div className="space-y-6">
      <PrintHeader title="Overview" subtitle={t.overview_subtitle} />
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.overview_subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {!isDefaultData && (
            <div className="text-right">
              <p className="text-xs font-medium text-emerald-600">{csvFileName}</p>
              <p className="text-xs text-muted-foreground">{rowCount} {t.csv_services_loaded}</p>
            </div>
          )}
          {isDefaultData && (
            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded-lg">
              {t.overview_example_data}
            </span>
          )}
          {/* Acciones dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              Actions
              <ChevronDown className="w-3 h-3" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => { setShowNewModal(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-foreground hover:bg-muted/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  New service
                </button>
                <PrintButton asMenuItem />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.kpi_active_services, value: active,          sub: `${atRisk} ${t.kpi_at_risk_suffix}`,        color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: t.kpi_total_projects,  value: projects.length, sub: `${projects.filter(p => p.status === "completed").length} ${t.kpi_completed_suffix}`, color: "text-violet-600", bg: "bg-violet-50" },
          { label: t.kpi_gross_margin,    value: totalRevenue > 0 ? `${grossMargin}%` : t.kpi_no_finance_data, sub: totalRevenue > 0 ? `Revenue ${formatClpToUsd(totalRevenue)}` : t.kpi_enter_finance, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: t.kpi_team,            value: teamMembers.length, sub: t.kpi_people_identified, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-5 flex items-start gap-4">
            <div className={`${s.bg} rounded-lg w-10 h-10 flex items-center justify-center flex-shrink-0`}>
              <span className={`text-base font-bold ${s.color}`}>{typeof s.value === "number" ? s.value : "—"}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BurndownChart />
        <ServicesTimelineChart />
      </div>

      {/* Tabla con filtros */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground">
            {t.services_label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {hasFilters ? `${filtered.length} de ${projects.length}` : projects.length}
            </span>
          </h3>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t.action_clear_filters}
            </button>
          )}
        </div>

        {/* Fila de filtros */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={t.search_service}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-muted/30"
            />
          </div>
          <MultiFilter
            placeholder={t.filter_all_statuses}
            options={statusOptions}
            value={filterStatus}
            onChange={setFilterStatus}
          />
          {clientOptions.length > 0 && (
            <MultiFilter
              placeholder={t.filter_all_clients}
              options={clientOptions.map(c => ({ value: c, label: c }))}
              value={filterClient}
              onChange={setFilterClient}
            />
          )}
          {typeOptions.length > 0 && (
            <MultiFilter
              placeholder={t.filter_all_types}
              options={typeOptions.map(ty => ({ value: ty, label: ty }))}
              value={filterType}
              onChange={setFilterType}
            />
          )}
          {managerOptions.length > 0 && (
            <MultiFilter
              placeholder={t.filter_all_bm}
              options={managerOptions.map(m => ({ value: m, label: m }))}
              value={filterManager}
              onChange={setFilterManager}
            />
          )}
          {leaderOptions.length > 0 && (
            <MultiFilter
              placeholder={t.filter_all_leaders}
              options={leaderOptions.map(l => ({ value: l, label: l }))}
              value={filterLeader}
              onChange={setFilterLeader}
            />
          )}
          {buOptions.length > 0 && (
            <MultiFilter
              placeholder={t.filter_all_bu}
              options={buOptions.map(b => ({ value: b, label: b }))}
              value={filterBU}
              onChange={setFilterBU}
            />
          )}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[17%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[5%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[3%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                {["Client", "Project / Service", "Model", "Start", "End", "TL", "FTEs", "Revenue", "Monthly Margin", "TMD", "OTD", "OQD", ""].map((h, i) => (
                  <th key={i} className="text-left text-xs font-medium text-muted-foreground pb-3 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-sm text-muted-foreground">
                    {t.no_services}
                  </td>
                </tr>
              ) : filtered.map((p) => {
                const isEditing  = editId === p.id;
                const isExpanded = expandedId === p.id;
                return (
                  <Fragment key={p.id}>
                  <tr className={`group border-b border-border last:border-0 transition-colors ${isEditing ? "bg-primary/5" : isExpanded ? "bg-slate-50" : "hover:bg-muted/40"}`}>

                    {/* Cliente */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("client") : <span className="truncate block">{p.client ?? "—"}</span>}
                    </td>

                    {/* Proyecto / Servicio */}
                    <td className="py-2 pr-3 font-medium">
                      {isEditing ? field("name") : (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          className="text-left w-full group/name"
                        >
                          <div className="flex items-center gap-1">
                            {isExpanded
                              ? <ChevronDown  className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                              : <ChevronRight className="w-3 h-3 flex-shrink-0 text-muted-foreground" />}
                            <p className="truncate text-sm group-hover/name:text-primary transition-colors">{p.name}</p>
                          </div>
                        </button>
                      )}
                    </td>

                    {/* Modelo */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("serviceType") : <span className="truncate block">{p.serviceType ?? "—"}</span>}
                    </td>

                    {/* Start */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("startDate") : <span>{p.startDate || "—"}</span>}
                    </td>

                    {/* End */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("endDate") : (
                        p.endDate ? (
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusBar[p.status]}`} />
                            {p.endDate}
                          </span>
                        ) : "—"
                      )}
                    </td>

                    {/* TL */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("leader") : <span className="truncate block">{p.leader ?? "—"}</span>}
                    </td>

                    {/* FTEs */}
                    <td className="py-2 pr-3 text-xs text-center">
                      <span className="font-medium text-foreground">{reportData[p.id]?.ftes ?? "—"}</span>
                    </td>

                    {/* Revenue */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {fmtRevenue(p.revenueMonthly)}
                    </td>

                    {/* Monthly Margin */}
                    <td className="py-2 pr-3 text-xs">
                      {(() => {
                        const m = calcMargin(p.revenueMonthly, p.costMonthly);
                        if (m === null) return <span className="text-muted-foreground">—</span>;
                        const cls = m >= 20 ? "text-emerald-600" : m >= 10 ? "text-amber-600" : "text-red-600";
                        return <span className={`font-medium ${cls}`}>{m}%</span>;
                      })()}
                    </td>

                    {/* TMD */}
                    <td className="py-2 pr-3 text-xs">
                      {(() => {
                        const tmd = reportData[p.id]?.marginImprovement;
                        if (!tmd) return <span className="text-muted-foreground">—</span>;
                        const cls = tmd.startsWith("+") ? "text-emerald-600" : "text-red-600";
                        return <span className={`font-medium ${cls}`}>{tmd}</span>;
                      })()}
                    </td>

                    {/* OTD */}
                    <td className="py-2 pr-3 text-xs text-center">
                      {p.csvOtdPercent
                        ? <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{p.csvOtdPercent}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* OQD */}
                    <td className="py-2 pr-3 text-xs text-center">
                      {p.csvOqdPercent
                        ? <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{p.csvOqdPercent}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Acciones */}
                    <td className="py-2 text-right whitespace-nowrap">
                      {isEditing ? (
                        <button onClick={() => saveEdit(p.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => router.push(`/project/${p.id}`)}
                            title={t.action_edit}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            title={t.action_delete}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {/* Fila expandida: weekly report */}
                  {isExpanded && (
                    <tr key={`${p.id}-expanded`}>
                      <td colSpan={13} className="p-0 border-b border-border bg-slate-50">
                        <WeeklyReportPanel
                          project={p}
                          report={reportData[p.id]}
                          onSaveReport={changes => updateReport(p.id, { ...(reportData[p.id] ?? prefillReport(p)), ...changes })}
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
      {/* Modal nuevo servicio */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> New service
              </h2>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 overflow-y-auto max-h-[70vh]">
              {/* Fila 1: Nombre + Cliente */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Service name <span className="text-red-500">*</span></label>
                  <input value={newDraft.name} onChange={e => setNewDraft(d => ({ ...d, name: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Service name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Client</label>
                  <input value={newDraft.client} onChange={e => setNewDraft(d => ({ ...d, client: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Client" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">IFS Code</label>
                  <input value={newDraft.ifsCode} onChange={e => setNewDraft(d => ({ ...d, ifsCode: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="IFS Code" />
                </div>
              </div>
              {/* Fila 2: Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Start date</label>
                  <input type="date" value={newDraft.startDate} onChange={e => setNewDraft(d => ({ ...d, startDate: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">End date</label>
                  <input type="date" value={newDraft.endDate} onChange={e => setNewDraft(d => ({ ...d, endDate: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              {/* Fila 3: Status + Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
                  <select value={newDraft.status} onChange={e => setNewDraft(d => ({ ...d, status: e.target.value as ProjectStatus }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="active">{t.status_active}</option>
                    <option value="at-risk">{t.status_at_risk}</option>
                    <option value="on-hold">{t.status_on_hold_alt}</option>
                    <option value="completed">{t.status_completed}</option>
                    <option value="guarantee">{t.status_guarantee}</option>
                    <option value="delayed">{t.status_delayed}</option>
                    <option value="terminated">{t.status_terminated}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                  <input value={newDraft.serviceType} onChange={e => setNewDraft(d => ({ ...d, serviceType: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="CC / SC / Fixed Price" />
                </div>
              </div>
              {/* Fila 4: BM + Leader */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">BM</label>
                  <input value={newDraft.manager} onChange={e => setNewDraft(d => ({ ...d, manager: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Business Manager" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Team Leader</label>
                  <input value={newDraft.leader} onChange={e => setNewDraft(d => ({ ...d, leader: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Team Leader" />
                </div>
              </div>
              {/* Fila 5: BU + FTEs + Commitment */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">BU</label>
                  <input value={newDraft.bu} onChange={e => setNewDraft(d => ({ ...d, bu: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Business Unit" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">FTEs</label>
                  <input type="number" min={0} value={newDraft.teamSize || ""}
                    onChange={e => setNewDraft(d => ({ ...d, teamSize: Number(e.target.value) }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Commitment</label>
                  <input value={newDraft.serviceLevel} onChange={e => setNewDraft(d => ({ ...d, serviceLevel: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="CC / SC / FP" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
              <button onClick={() => setShowNewModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateService} disabled={!newDraft.name.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Create service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold text-foreground">Delete service</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">"{deleteTarget.name}"</span>?
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
