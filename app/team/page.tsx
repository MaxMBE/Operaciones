"use client";

import { useState, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useData } from "@/lib/data-context";
import type { MemberRole, ProjectStatus, TeamMember, Project } from "@/types";
import {
  Pencil, Check, ChevronDown, ChevronRight, X,
  AlertTriangle, Clock, CheckCircle2, UserX, Search,
  Trash2, Download, UserPlus,
} from "lucide-react";
import { useT, useLang } from "@/lib/i18n";
import { PrintButton } from "@/components/print-button";
import { PrintHeader } from "@/components/print-header";

const ALL_ROLES: MemberRole[] = [
  "BM", "PM", "Product Owner", "Team Lead", "Developer", "Architect", "Data Engineer",
  "DevOps", "QA", "Security", "Analyst", "Designer", "Support",
];

const roleColors: Record<MemberRole, string> = {
  "BM":             "bg-rose-100 text-rose-700",
  "PM":             "bg-violet-100 text-violet-700",
  "Product Owner":  "bg-purple-100 text-purple-700",
  "Team Lead":      "bg-indigo-100 text-indigo-700",
  "Developer":      "bg-blue-100 text-blue-700",
  "Architect":      "bg-cyan-100 text-cyan-700",
  "Data Engineer":  "bg-teal-100 text-teal-700",
  "DevOps":         "bg-sky-100 text-sky-700",
  "QA":             "bg-yellow-100 text-yellow-700",
  "Security":       "bg-red-100 text-red-700",
  "Analyst":        "bg-emerald-100 text-emerald-700",
  "Designer":       "bg-pink-100 text-pink-700",
  "Support":        "bg-orange-100 text-orange-700",
};

// ── Bench risk types ──────────────────────────────────────────────────────────

type BenchRisk = "bench" | "critical" | "medium" | "low";

interface MemberBenchInfo {
  memberId: string;
  name: string;
  avatar: string;
  role: MemberRole;
  projectIds: string[];
  comments: string;
  activeServices: { id: string; name: string; client?: string; endDate: string; daysLeft: number }[];
  lastEndDate: string | null;
  daysUntilBench: number | null;
  risk: BenchRisk;
}

const BENCH_STATUSES = new Set(["completed", "guarantee"]);

function daysFromToday(dateStr: string): number {
  if (!dateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function riskFromDays(days: number | null): BenchRisk {
  if (days === null || days < 0) return "bench";
  if (days <= 30) return "critical";
  if (days <= 60) return "medium";
  return "low";
}

const RISK_STYLE: Record<BenchRisk, {
  bg: string; text: string; border: string; icon: React.ReactNode;
}> = {
  bench:    { bg: "bg-gray-100",    text: "text-gray-600",    border: "border-gray-200",    icon: <UserX         className="w-3.5 h-3.5" /> },
  critical: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  medium:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   icon: <Clock         className="w-3.5 h-3.5" /> },
  low:      { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", icon: <CheckCircle2  className="w-3.5 h-3.5" /> },
};

// ── Capacity Chart ────────────────────────────────────────────────────────────

function CapacityChart({ teamMembers, projects }: { teamMembers: TeamMember[]; projects: Project[] }) {
  const ACTIVE_STATUSES = new Set(["completed", "guarantee"]);
  const t = useT();
  const { lang } = useLang();

  const data = useMemo(() => {
    const locale = lang === "en" ? "en-US" : "es-CL";
    const today = new Date();
    const months: { month: string; assigned: number; unassigned: number }[] = [];

    for (let i = -1; i <= 5; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const label = d.toLocaleDateString(locale, { month: "short", year: "2-digit" });

      let assigned = 0;
      let unassigned = 0;

      for (const m of teamMembers) {
        const activeProjects = (m.projectIds ?? [])
          .map(pid => projects.find(p => p.id === pid))
          .filter(p => p && !ACTIVE_STATUSES.has(p.status)) as Project[];

        const hasAssignment = activeProjects.some(p => {
          const endDate = m.projectEndDates?.[p.id] ?? p.endDate ?? "";
          return endDate >= d.toISOString().slice(0, 10);
        });

        if (hasAssignment) assigned++;
        else unassigned++;
      }

      months.push({ month: label, assigned, unassigned });
    }
    return months;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers, projects, lang]);

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <h3 className="text-xs font-semibold text-foreground mb-4">{t.capacity_chart_title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="assigned"   name={t.capacity_assigned}   stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="unassigned" name={t.capacity_unassigned}   stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Bench view ────────────────────────────────────────────────────────────────

function BenchView({ teamMembersOverride, projectsOverride, isHistorical }: {
  teamMembersOverride?: TeamMember[];
  projectsOverride?: Project[];
  isHistorical?: boolean;
}) {
  const { projects: liveProjects, teamMembers: liveTeamMembers, updateMember, deleteMember } = useData();
  const projects    = projectsOverride    ?? liveProjects;
  const teamMembers = teamMembersOverride ?? liveTeamMembers;
  const t = useT();
  const { lang } = useLang();

  const riskConfig: Record<BenchRisk, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
    bench:    { label: t.bench_in_bench,      ...RISK_STYLE.bench    },
    critical: { label: t.bench_critical_risk, ...RISK_STYLE.critical },
    medium:   { label: t.bench_medium_risk,   ...RISK_STYLE.medium   },
    low:      { label: t.bench_no_risk,       ...RISK_STYLE.low      },
  };

  // Filters
  const [searchName,   setSearchName]   = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterRisk,   setFilterRisk]   = useState<BenchRisk | "all">("all");

  // Modal state
  const [modalMemberId,   setModalMemberId]   = useState<string | null>(null);
  const [modalRole,       setModalRole]       = useState<MemberRole>("Developer");
  const [modalProjectIds, setModalProjectIds] = useState<string[]>([]);
  const [modalDates,      setModalDates]      = useState<Record<string, string>>({});
  const [modalComments,   setModalComments]   = useState("");
  const [modalSearch,     setModalSearch]     = useState("");

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Comment tooltip state
  const [commentTooltip, setCommentTooltip] = useState<{ text: string; top: number; left: number } | null>(null);

  // ESC to close modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setModalMemberId(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Bench data ──────────────────────────────────────────────────────────────
  const benchData = useMemo<MemberBenchInfo[]>(() => {
    return teamMembers.map((m) => {
      const assigned = projects.filter(p => m.projectIds?.includes(p.id));
      const active   = assigned.filter(p => !BENCH_STATUSES.has(p.status));

      const activeServices = active
        .map(p => {
          const effDate = m.projectEndDates?.[p.id] ?? p.endDate ?? "";
          return { id: p.id, name: p.name, client: p.client, endDate: effDate, daysLeft: daysFromToday(effDate) };
        })
        .filter(s => s.endDate)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      const lastEndDate = active.reduce<string | null>((latest, p) => {
        const effDate = m.projectEndDates?.[p.id] ?? p.endDate ?? "";
        if (!effDate) return latest;
        return !latest || effDate > latest ? effDate : latest;
      }, null);

      const daysUntilBench = lastEndDate ? daysFromToday(lastEndDate) : null;

      return {
        memberId: m.id,
        name: m.name,
        avatar: m.avatar,
        role: m.role,
        comments: m.comments ?? "",
        projectIds: m.projectIds ?? [],
        activeServices,
        lastEndDate,
        daysUntilBench,
        risk: active.length === 0 ? "bench" : riskFromDays(daysUntilBench),
      };
    }).sort((a, b) => {
      const order = { bench: 0, critical: 1, medium: 2, low: 3 };
      if (order[a.risk] !== order[b.risk]) return order[a.risk] - order[b.risk];
      return (a.daysUntilBench ?? -Infinity) - (b.daysUntilBench ?? -Infinity);
    });
  }, [projects, teamMembers]);

  // Unique clients from all active services
  const uniqueClients = useMemo(() => {
    const s = new Set<string>();
    benchData.forEach(m => m.activeServices.forEach(sv => { if (sv.client) s.add(sv.client); }));
    return Array.from(s).sort();
  }, [benchData]);

  const counts = useMemo(() => ({
    bench:    benchData.filter(m => m.risk === "bench").length,
    critical: benchData.filter(m => m.risk === "critical").length,
    medium:   benchData.filter(m => m.risk === "medium").length,
    low:      benchData.filter(m => m.risk === "low").length,
  }), [benchData]);

  // Apply all filters
  const filtered = useMemo(() => {
    return benchData
      .filter(m => filterRisk === "all" || m.risk === filterRisk)
      .filter(m => !searchName.trim() || m.name.toLowerCase().includes(searchName.toLowerCase()))
      .filter(m => !filterClient || m.activeServices.some(s => s.client === filterClient));
  }, [benchData, filterRisk, searchName, filterClient]);

  // ── Modal helpers ────────────────────────────────────────────────────────────
  function openModal(m: MemberBenchInfo) {
    setModalMemberId(m.memberId);
    setModalRole(m.role);
    setModalProjectIds([...m.projectIds]);
    setModalComments(m.comments);
    setModalSearch("");
    const rawMember = teamMembers.find(tm => tm.id === m.memberId);
    const dates: Record<string, string> = {};
    projects.forEach(p => {
      if (m.projectIds.includes(p.id))
        dates[p.id] = rawMember?.projectEndDates?.[p.id] ?? p.endDate ?? "";
    });
    setModalDates(dates);
  }

  function saveModal() {
    if (!modalMemberId) return;
    const rawMember = teamMembers.find(m => m.id === modalMemberId);
    const newProjectEndDates: Record<string, string> = { ...(rawMember?.projectEndDates ?? {}) };
    modalProjectIds.forEach(pid => { newProjectEndDates[pid] = modalDates[pid] ?? ""; });
    updateMember(modalMemberId, {
      role: modalRole,
      projectIds: modalProjectIds,
      comments: modalComments,
      projectEndDates: newProjectEndDates,
    });
    setModalMemberId(null);
  }

  function toggleModalProject(pid: string) {
    setModalProjectIds(prev => {
      const next = prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid];
      if (!prev.includes(pid)) {
        const p = projects.find(pr => pr.id === pid);
        setModalDates(d => ({ ...d, [pid]: p?.endDate ?? "" }));
      }
      return next;
    });
  }

  // Delete helpers
  function requestDelete(id: string) { setConfirmDeleteId(id); }
  function confirmDelete(id: string) { deleteMember(id); setConfirmDeleteId(null); }

  // Export filtered bench data as PDF (print dialog)
  function exportPDF() {
    const riskColors: Record<BenchRisk, string> = {
      bench:    "#6b7280",
      critical: "#dc2626",
      medium:   "#d97706",
      low:      "#059669",
    };
    const rows = filtered.map(m => {
      const services = m.activeServices.length === 0
        ? `<em>${t.bench_no_services}</em>`
        : m.activeServices.map(s =>
            `${s.name}${s.client ? ` <span style="color:#888">(${s.client})</span>` : ""} <span style="color:#888">${s.daysLeft < 0 ? t.bench_expired : s.daysLeft + "d"}</span>`
          ).join("<br>");
      const daysCell = m.daysUntilBench === null ? "—"
        : m.daysUntilBench < 0 ? t.bench_expired_cap
        : `<strong>${m.daysUntilBench}d</strong>`;
      return `<tr>
        <td><strong>${m.name}</strong><br><span style="font-size:10px;color:#666">${m.role}</span></td>
        <td style="font-size:11px">${services}</td>
        <td>${m.lastEndDate ? new Date(m.lastEndDate + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day:"2-digit", month:"short", year:"numeric" }) : "—"}</td>
        <td style="text-align:center">${daysCell}</td>
        <td><span style="color:${riskColors[m.risk]};font-weight:600">${riskConfig[m.risk].label}</span></td>
        <td style="font-size:11px;color:#555">${m.comments || "—"}</td>
      </tr>`;
    }).join("");

    const w = window.open("", "_blank", "width=1100,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Bench</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:32px;color:#111}
  h1{font-size:18px;margin-bottom:4px}
  p.sub{font-size:12px;color:#666;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f3f4f6;text-align:left;padding:8px 10px;font-size:11px;color:#555;border-bottom:2px solid #e5e7eb}
  td{padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  tr:last-child td{border-bottom:none}
  @media print{body{padding:0}}
</style></head><body>
<h1>${t.bench_pdf_title}</h1>
<p class="sub">${t.bench_pdf_generated} ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day:"2-digit", month:"long", year:"numeric" })} · ${filtered.length} ${t.bench_pdf_consultants_n}</p>
<table>
  <thead><tr>
    <th>${t.bench_pdf_col1}</th>
    <th>${t.bench_pdf_col2}</th>
    <th>${t.bench_pdf_col3}</th>
    <th style="text-align:center">${t.bench_pdf_col4}</th>
    <th>${t.bench_pdf_col5}</th>
    <th>${t.bench_col_comments}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  const hasFilters = searchName || filterClient || filterRisk !== "all";
  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day: "2-digit", month: "short", year: "numeric" });

  const modalMember = benchData.find(m => m.memberId === modalMemberId) ?? null;

  return (
    <div className="space-y-5">
      <PrintHeader title={t.nav_team} subtitle={t.capacity_subtitle} />
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t.nav_team}</h1>
        </div>
        <PrintButton />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["bench", "critical", "medium", "low"] as BenchRisk[]).map(risk => {
          const cfg = riskConfig[risk];
          const active = filterRisk === risk;
          return (
            <button
              key={risk}
              onClick={() => setFilterRisk(f => f === risk ? "all" : risk)}
              className={`rounded-xl border p-3.5 text-left transition-all ${cfg.bg} ${cfg.border} ${cfg.text}
                ${active ? "ring-2 ring-current ring-offset-1" : "hover:brightness-95"}`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                {cfg.icon}
                <span className="text-xs font-medium">{cfg.label}</span>
              </div>
              <span className="text-2xl font-bold">{counts[risk]}</span>
            </button>
          );
        })}
      </div>

      {/* Capacity chart */}
      <CapacityChart teamMembers={teamMembers} projects={projects} />

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            placeholder={t.bench_search}
            className="w-full pl-8 pr-8 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          />
          {searchName && (
            <button onClick={() => setSearchName("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        >
          <option value="">{t.bench_all_clients}</option>
          {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterRisk}
          onChange={e => setFilterRisk(e.target.value as BenchRisk | "all")}
          className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        >
          <option value="all">{t.bench_all_statuses}</option>
          <option value="bench">{t.bench_in_bench}</option>
          <option value="critical">{t.bench_critical_risk}</option>
          <option value="medium">{t.bench_medium_risk}</option>
          <option value="low">{t.bench_no_risk}</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearchName(""); setFilterClient(""); setFilterRisk("all"); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl bg-white hover:bg-muted/30 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t.action_clear}
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} {t.bench_of_consultants} {benchData.length} {t.bench_consultants_label}
        </span>
        <button
          onClick={exportPDF}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {t.action_export_pdf}
        </button>
      </div>

      {/* Criteria legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 flex flex-wrap gap-x-6 gap-y-1">
        <span className="font-semibold w-full">{t.bench_criterion_title}</span>
        <span>• <strong>{t.bench_in_bench}</strong>: {t.bench_criterion_bench}</span>
        <span>• <strong>{t.bench_critical_risk}</strong>: {t.bench_criterion_critical}</span>
        <span>• <strong>{t.bench_medium_risk}</strong>: {t.bench_criterion_medium}</span>
        <span>• <strong>{t.bench_no_risk}</strong>: {t.bench_criterion_low}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/20 border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{t.bench_col_consultant}</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">{t.bench_col_services}</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap">{t.bench_col_last_end}</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap">{t.bench_col_days}</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">{t.bench_col_status}</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">{t.bench_col_comments}</th>
              <th className="w-20 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t.no_services}
                </td>
              </tr>
            )}

            {filtered.map((m) => {
              const cfg = riskConfig[m.risk];
              return (
                <tr
                  key={m.memberId}
                  className="group border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  {/* Consultor / Rol */}
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {m.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{m.name}</p>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${roleColors[m.role] ?? roleColors.Developer}`}>
                          {m.role}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Servicios activos */}
                  <td className="px-3 py-3 align-top w-[260px] max-w-[300px]">
                    {m.activeServices.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">{t.bench_no_services}</span>
                    ) : (
                      <div className="space-y-1">
                        {m.activeServices.map(s => (
                          <div key={s.id} className="flex items-start gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                            <span>
                              <span className="font-medium text-gray-700">{s.name}</span>
                              {s.client && <span className="text-muted-foreground"> · {s.client}</span>}
                              <span className={`ml-1 ${s.daysLeft < 0 ? "text-gray-400" : s.daysLeft <= 30 ? "text-red-500" : s.daysLeft <= 60 ? "text-amber-500" : "text-muted-foreground"}`}>
                                ({s.daysLeft < 0 ? t.bench_expired : `${s.daysLeft}d`})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Último término */}
                  <td className="px-3 py-3 align-top whitespace-nowrap">
                    {m.lastEndDate ? (
                      <span className="text-sm text-gray-700">{formatDate(m.lastEndDate)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Días sin asignación */}
                  <td className="px-3 py-3 align-top">
                    {m.daysUntilBench === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : m.daysUntilBench < 0 ? (
                      <span className="text-sm font-bold text-gray-500">{Math.abs(m.daysUntilBench)}d</span>
                    ) : (
                      <span className={`text-sm font-bold ${cfg.text}`}>{m.daysUntilBench}d</span>
                    )}
                  </td>

                  {/* Estado / Riesgo */}
                  <td className="px-3 py-3 align-top">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </td>

                  {/* Comentarios */}
                  <td
                    className="px-3 py-3 align-top max-w-[180px]"
                    onMouseEnter={m.comments ? (e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setCommentTooltip({ text: m.comments, top: rect.bottom + 6, left: rect.left });
                    } : undefined}
                    onMouseLeave={() => setCommentTooltip(null)}
                  >
                    {m.comments ? (
                      <p className="text-xs text-gray-600 line-clamp-2 cursor-default">{m.comments}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3 align-top">
                    {confirmDeleteId === m.memberId ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">{t.action_confirm_delete}</span>
                        <button onClick={() => confirmDelete(m.memberId)} title="Confirmar"
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} title="Cancelar"
                          className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(m)} title="Edit"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => requestDelete(m.memberId)} title="Eliminar"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {modalMemberId && modalMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setModalMemberId(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {modalMember.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{modalMember.name}</p>
                  <p className="text-xs text-muted-foreground">{t.bench_edit_info}</p>
                </div>
              </div>
              <button
                onClick={() => setModalMemberId(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Rol */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t.bench_label_role}</label>
                <select
                  value={modalRole}
                  onChange={e => setModalRole(e.target.value as MemberRole)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Servicios asignados */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t.bench_label_services}</label>
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder={t.bench_search_service_ph}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                />
                <div className="border border-border rounded-lg max-h-52 overflow-y-auto divide-y divide-border/40">
                  {[...projects]
                    .sort((a, b) => {
                      const aChecked = modalProjectIds.includes(a.id) ? 0 : 1;
                      const bChecked = modalProjectIds.includes(b.id) ? 0 : 1;
                      return aChecked - bChecked;
                    })
                    .filter(p => !modalSearch.trim() ||
                      p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                      (p.client ?? "").toLowerCase().includes(modalSearch.toLowerCase()))
                    .map(p => {
                      const checked  = modalProjectIds.includes(p.id);
                      const isActive = !BENCH_STATUSES.has(p.status);
                      return (
                        <div key={p.id} className={`transition-colors ${checked ? "bg-violet-50" : "hover:bg-gray-50"}`}>
                          <label className="flex items-start gap-2 px-3 py-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleModalProject(p.id)}
                              className="mt-0.5 accent-violet-600 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{p.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {p.client && <span className="text-[10px] text-muted-foreground truncate">{p.client}</span>}
                                {!isActive && (
                                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">{t.service_ended}</span>
                                )}
                              </div>
                            </div>
                          </label>
                          {checked && (
                            <div className="pl-9 pr-3 pb-2">
                              <label className="text-[10px] text-violet-600 font-medium block mb-0.5">{t.col_end_date}</label>
                              <input
                                type="date"
                                value={modalDates[p.id] ?? ""}
                                onChange={e => setModalDates(d => ({ ...d, [p.id]: e.target.value }))}
                                className="w-full text-xs border border-violet-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Comentarios */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t.bench_label_comments}</label>
                <textarea
                  value={modalComments}
                  onChange={e => setModalComments(e.target.value)}
                  placeholder={t.bench_notes_ph}
                  rows={3}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-border">
              <button
                onClick={() => setModalMemberId(null)}
                className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                {t.action_cancel}
              </button>
              <button
                onClick={saveModal}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t.action_save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment tooltip */}
      {commentTooltip && (
        <div
          className="fixed z-[200] max-w-xs rounded-xl bg-gray-900 text-white text-xs px-3 py-2 shadow-xl pointer-events-none whitespace-pre-wrap leading-relaxed"
          style={{ top: commentTooltip.top, left: commentTooltip.left }}
        >
          {commentTooltip.text}
        </div>
      )}
    </div>
  );
}

// ── Leaders view ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ProjectStatus, { bg: string; text: string }> = {
  "active":     { bg: "bg-blue-100",    text: "text-blue-700"    },
  "at-risk":    { bg: "bg-red-100",     text: "text-red-700"     },
  "on-hold":    { bg: "bg-yellow-100",  text: "text-yellow-700"  },
  "completed":  { bg: "bg-emerald-100", text: "text-emerald-700" },
  "guarantee":  { bg: "bg-purple-100",  text: "text-purple-700"  },
  "delayed":    { bg: "bg-orange-100",  text: "text-orange-700"  },
  "terminated": { bg: "bg-slate-100",   text: "text-slate-600"   },
};

function LeadersView() {
  const { projects, updateProject } = useData();
  const t = useT();
  const { lang } = useLang();

  const statusLabel: Record<ProjectStatus, string> = {
    "active":     t.status_in_progress,
    "at-risk":    t.status_at_risk,
    "on-hold":    t.status_on_hold,
    "completed":  t.status_completed,
    "guarantee":  t.status_guarantee,
    "delayed":    t.status_delayed,
    "terminated": t.status_terminated,
  };

  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [editSvcId,   setEditSvcId]   = useState<string | null>(null);
  const [editSvcDraft, setEditSvcDraft] = useState<Partial<{ name: string; status: ProjectStatus; progress: number; endDate: string; serviceType: string }>>({});

  const inputCls = "w-full text-xs border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white";

  function startSvcEdit(p: typeof projects[0]) {
    setEditSvcId(p.id);
    setEditSvcDraft({ name: p.name, status: p.status, progress: p.progress, endDate: p.endDate ?? "", serviceType: p.serviceType ?? "" });
  }
  function saveSvcEdit() {
    if (!editSvcId) return;
    updateProject(editSvcId, { ...editSvcDraft, progress: Number(editSvcDraft.progress) || 0 });
    setEditSvcId(null);
  }

  const leaderGroups = useMemo(() => {
    const map = new Map<string, typeof projects>();
    projects.forEach(p => {
      const key = p.leader?.trim() || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries())
      .map(([key, svcs]) => {
        const byStatus = svcs.reduce<Partial<Record<ProjectStatus, number>>>((acc, p) => {
          acc[p.status] = (acc[p.status] ?? 0) + 1;
          return acc;
        }, {});
        return { key, leader: key === "__none__" ? null : key, services: svcs, byStatus };
      })
      .sort((a, b) => b.services.length - a.services.length);
  }, [projects]);

  const hasLeaders = leaderGroups.some(g => g.leader !== null);

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const formatDate = (d?: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  if (!hasLeaders) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-8 text-center">
        <p className="text-sm text-amber-700 font-medium">{t.leader_no_data}</p>
      </div>
    );
  }

  const totalLeaders   = leaderGroups.filter(g => g.leader).length;
  const totalServices  = projects.length;
  const totalActive    = projects.filter(p => p.status === "active" || p.status === "at-risk" || p.status === "on-hold" || p.status === "delayed").length;
  const totalGuarantee = projects.filter(p => p.status === "guarantee").length;
  const totalCompleted = projects.filter(p => p.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalLeaders}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.tab_leaders}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalServices}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.services_label}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalActive}</p>
          <p className="text-xs text-blue-600 mt-1">{t.status_in_progress}</p>
        </div>
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{totalGuarantee}</p>
          <p className="text-xs text-purple-600 mt-1">{t.status_guarantee}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalCompleted}</p>
          <p className="text-xs text-emerald-600 mt-1">{t.status_completed}</p>
        </div>
      </div>

      {/* Leader cards */}
      {leaderGroups.map(({ key, leader, services, byStatus }) => {
        const isOpen   = expanded.has(key);
        const initials = leader ? leader.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";

        return (
          <div key={key} className="bg-white rounded-xl border border-border overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${leader ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"}`}>
                  {initials}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">
                    {leader || <span className="italic text-muted-foreground">{t.leader_no_leader}</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(Object.entries(byStatus) as [ProjectStatus, number][])
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => (
                        <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[status].bg} ${STATUS_STYLE[status].text}`}>
                          {statusLabel[status]} · {count}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{services.length}</p>
                  <p className="text-xs text-muted-foreground">{t.services_label}</p>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </div>
            </button>

            {/* Expanded service list */}
            {isOpen && (
              <div className="border-t border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">{t.table_service}</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{t.col_client}</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{t.table_type}</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{t.table_status}</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">{t.table_progress}</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">{t.col_end_date}</th>
                      <th className="w-8 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {services.map(p => {
                      const isEditingSvc = editSvcId === p.id;
                      return (
                        <tr key={p.id} className={`group border-b border-border last:border-0 transition-colors ${isEditingSvc ? "bg-indigo-50/40" : "hover:bg-muted/10"}`}>
                          {/* Nombre */}
                          <td className="px-4 py-2 text-xs font-medium text-foreground max-w-[180px]">
                            {isEditingSvc
                              ? <input value={editSvcDraft.name ?? ""} onChange={e => setEditSvcDraft(d => ({ ...d, name: e.target.value }))} className={inputCls} />
                              : <span className="line-clamp-1">{p.name}</span>}
                          </td>
                          {/* Cliente */}
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{p.client || "—"}</td>
                          {/* Tipo */}
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {isEditingSvc
                              ? <input value={editSvcDraft.serviceType ?? ""} onChange={e => setEditSvcDraft(d => ({ ...d, serviceType: e.target.value }))} className={inputCls} />
                              : <span className="line-clamp-1">{p.serviceType || "—"}</span>}
                          </td>
                          {/* Estado */}
                          <td className="px-3 py-2">
                            {isEditingSvc ? (
                              <select value={editSvcDraft.status} onChange={e => setEditSvcDraft(d => ({ ...d, status: e.target.value as ProjectStatus }))} className={inputCls}>
                                <option value="active">{t.status_active}</option>
                                <option value="at-risk">{t.status_at_risk}</option>
                                <option value="on-hold">{t.status_on_hold}</option>
                                <option value="delayed">{t.status_delayed}</option>
                                <option value="guarantee">{t.status_guarantee}</option>
                                <option value="completed">{t.status_completed}</option>
                              </select>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[p.status].bg} ${STATUS_STYLE[p.status].text}`}>
                                {statusLabel[p.status]}
                              </span>
                            )}
                          </td>
                          {/* Progreso */}
                          <td className="px-3 py-2">
                            {isEditingSvc ? (
                              <input type="number" min={0} max={100} value={editSvcDraft.progress ?? 0} onChange={e => setEditSvcDraft(d => ({ ...d, progress: Number(e.target.value) }))} className={`${inputCls} w-16`} />
                            ) : (
                              <div className="flex items-center gap-2 min-w-[72px]">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${p.progress}%` }} />
                                </div>
                                <span className="text-[10px] text-muted-foreground">{p.progress}%</span>
                              </div>
                            )}
                          </td>
                          {/* Fecha término */}
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {isEditingSvc
                              ? <input type="date" value={editSvcDraft.endDate ?? ""} onChange={e => setEditSvcDraft(d => ({ ...d, endDate: e.target.value }))} className={inputCls} />
                              : formatDate(p.endDate)}
                          </td>
                          {/* Actions */}
                          <td className="px-3 py-2">
                            {isEditingSvc ? (
                              <div className="flex items-center gap-1">
                                <button onClick={saveSvcEdit} className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                                  <Check className="w-3 h-3" />
                                </button>
                                <button onClick={() => setEditSvcId(null)} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startSvcEdit(p)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section helper (definido fuera para no recrearse en cada render) ──────────
function DirectorySection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-xl border ${color} overflow-hidden`}>
      <div className={`px-5 py-3 border-b ${color} bg-opacity-30`}>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// ── People Directory (Team Leaders, BMs, Consultores) ─────────────────────────

function PeopleDirectoryView() {
  const {
    knownLeaders, knownManagers, teamMembers,
    addKnownLeader, removeKnownLeader,
    addKnownManager, removeKnownManager,
    addMember, deleteMember, updateMember,
  } = useData();

  const [newLeader,  setNewLeader]  = useState("");
  const [newManager, setNewManager] = useState("");
  const [newConsultant, setNewConsultant] = useState("");
  const [newConsultantRole, setNewConsultantRole] = useState<MemberRole>("Developer");
  const [editConsultantId, setEditConsultantId] = useState<string | null>(null);
  const [editConsultantName, setEditConsultantName] = useState("");

  const inputCls = "flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400";

  function handleAddLeader() {
    const name = newLeader.trim();
    if (!name) return;
    // evitar duplicados (case-insensitive)
    if (knownLeaders.some(l => l.toLowerCase() === name.toLowerCase())) {
      setNewLeader("");
      return;
    }
    addKnownLeader(name);
    setNewLeader("");
  }
  function handleAddManager() {
    const name = newManager.trim();
    if (!name) return;
    if (knownManagers.some(m => m.toLowerCase() === name.toLowerCase())) {
      setNewManager("");
      return;
    }
    addKnownManager(name);
    setNewManager("");
  }
  function handleAddConsultant() {
    if (!newConsultant.trim()) return;
    addMember({
      id: `m-${Date.now()}`,
      name: newConsultant.trim(),
      role: newConsultantRole,
      avatar: newConsultant.trim().split(" ").map(w => w[0]?.toUpperCase() || "").join("").slice(0, 2),
      projectIds: [],
      hourlyRate: 0,
      hoursWorked: 0,
      projectsCount: 0,
      utilization: 0,
    });
    setNewConsultant("");
  }

  return (
    <div className="space-y-4">
      {/* Team Leaders */}
      <DirectorySection title="Team Leaders" color="border-indigo-200">
        <div className="flex gap-2">
          <input
            value={newLeader}
            onChange={e => setNewLeader(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddLeader(); }}
            placeholder="Team Leader name"
            className={inputCls}
          />
          <button
            onClick={handleAddLeader}
            disabled={!newLeader.trim()}
            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
        <div className="space-y-1.5">
          {knownLeaders.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No Team Leaders registered</p>
          )}
          {knownLeaders.map(l => (
            <div key={l} className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {l.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-foreground">{l}</span>
              </div>
              <button
                onClick={() => removeKnownLeader(l)}
                className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </DirectorySection>

      {/* BMs */}
      <DirectorySection title="BMs (Business Managers)" color="border-rose-200">
        <div className="flex gap-2">
          <input
            value={newManager}
            onChange={e => setNewManager(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddManager(); }}
            placeholder="BM name"
            className={inputCls}
          />
          <button
            onClick={handleAddManager}
            disabled={!newManager.trim()}
            className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
        <div className="space-y-1.5">
          {knownManagers.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No BMs registered</p>
          )}
          {knownManagers.map(m => (
            <div key={m} className="flex items-center justify-between bg-rose-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {m.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-foreground">{m}</span>
              </div>
              <button
                onClick={() => removeKnownManager(m)}
                className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </DirectorySection>

      {/* Consultores / FTEs */}
      <DirectorySection title="Consultants / FTEs" color="border-violet-200">
        <div className="flex gap-2">
          <input
            value={newConsultant}
            onChange={e => setNewConsultant(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddConsultant(); }}
            placeholder="Consultant name"
            className={inputCls}
          />
          <select
            value={newConsultantRole}
            onChange={e => setNewConsultantRole(e.target.value as MemberRole)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={handleAddConsultant}
            disabled={!newConsultant.trim()}
            className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
        <div className="space-y-1.5">
          {teamMembers.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No consultants registered</p>
          )}
          {teamMembers.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {m.avatar || m.name.slice(0, 2).toUpperCase()}
                </div>
                {editConsultantId === m.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      value={editConsultantName}
                      onChange={e => setEditConsultantName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          if (editConsultantName.trim()) updateMember(m.id, { name: editConsultantName.trim() });
                          setEditConsultantId(null);
                        }
                        if (e.key === "Escape") setEditConsultantId(null);
                      }}
                      className="text-xs border border-violet-300 rounded px-2 py-0.5 flex-1 focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => { if (editConsultantName.trim()) updateMember(m.id, { name: editConsultantName.trim() }); setEditConsultantId(null); }} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditConsultantId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{m.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${roleColors[m.role] ?? "bg-gray-100 text-gray-600"}`}>{m.role}</span>
                  </div>
                )}
              </div>
              {editConsultantId !== m.id && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setEditConsultantId(m.id); setEditConsultantName(m.name); }} className="p-1 rounded text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteMember(m.id)} className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </DirectorySection>
    </div>
  );
}

// ── Snapshot types ─────────────────────────────────────────────────────────────

interface SnapMeta { id: string; snapshot_date: string; week_label: string; }
interface SnapFull extends SnapMeta { projects: Project[]; cor_manual: { teamMembers?: TeamMember[] } | null; }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { projects: liveProjects, teamMembers: liveTeamMembers, updateMember, addMember, deleteMember } = useData();
  const t = useT();
  const { lang } = useLang();

  const [snapshots,        setSnapshots]        = useState<SnapMeta[]>([]);
  const [activeSnapId,     setActiveSnapId]     = useState<string>("live");
  const [snapData,         setSnapData]         = useState<SnapFull | null>(null);
  const [snapLoading,      setSnapLoading]      = useState(false);

  // Derived: live or historical data
  const projects    = snapData ? snapData.projects                        : liveProjects;
  const teamMembers = snapData ? (snapData.cor_manual?.teamMembers ?? liveTeamMembers) : liveTeamMembers;
  const isHistorical = activeSnapId !== "live";

  // Load snapshot list on mount
  useEffect(() => {
    fetch("/api/snapshots").then(r => r.json()).then(setSnapshots).catch(() => {});
  }, []);

  // Load full snapshot when selection changes
  useEffect(() => {
    if (activeSnapId === "live") { setSnapData(null); return; }
    setSnapLoading(true);
    fetch(`/api/snapshots/${activeSnapId}`)
      .then(r => r.json())
      .then((d: SnapFull) => setSnapData(d))
      .catch(() => setSnapData(null))
      .finally(() => setSnapLoading(false));
  }, [activeSnapId]);

  const [tab,       setTab]       = useState<"equipo" | "bench" | "leaders">("equipo");
  const [confirmDeleteEquipoId, setConfirmDeleteEquipoId] = useState<string | null>(null);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editRole,  setEditRole]  = useState<MemberRole>("Developer");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Add consultant form state
  const [addingToProjectId, setAddingToProjectId] = useState<string | null>(null);
  const [newName,    setNewName]    = useState("");
  const [newRole,    setNewRole]    = useState<MemberRole>("Developer");
  const [newEndDate, setNewEndDate] = useState("");

  // Inline end date edit state (per member + project)
  const [editDateProjectId, setEditDateProjectId] = useState<string | null>(null);
  const [editDateMemberId,  setEditDateMemberId]  = useState<string | null>(null);
  const [editDateValue,     setEditDateValue]     = useState("");

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEdit(id: string, role: MemberRole) {
    setEditId(id);
    setEditRole(role);
  }

  function saveEdit(id: string) {
    updateMember(id, { role: editRole });
    setEditId(null);
  }

  const groups = projects
    .map(proj => ({
      projectId: proj.id,
      projectName: proj.name,
      client: proj.client,
      members: teamMembers.filter(m => m.projectIds?.includes(proj.id)),
    }))
    .filter(g => g.members.length > 0);

  const unassigned = teamMembers.filter(m => !m.projectIds || m.projectIds.length === 0);

  const roleCount = ALL_ROLES.reduce((acc, r) => {
    const n = teamMembers.filter(m => m.role === r).length;
    if (n > 0) acc.push({ role: r, count: n });
    return acc;
  }, [] as { role: MemberRole; count: number }[]);

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es-CL", { day: "2-digit", month: "short", year: "numeric" });

  function handleSaveDate(projectId: string, memberId: string) {
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
      updateMember(memberId, {
        projectEndDates: { ...(member.projectEndDates ?? {}), [projectId]: editDateValue },
      });
    }
    setEditDateProjectId(null);
    setEditDateMemberId(null);
  }

  function handleAddMember(projectId: string) {
    if (!newName.trim()) return;
    const member: import("@/types").TeamMember = {
      id: `m-${Date.now()}`,
      name: newName.trim(),
      role: newRole,
      avatar: newName.trim()[0].toUpperCase(),
      hourlyRate: 0,
      hoursWorked: 0,
      projectsCount: 1,
      utilization: 0,
      projectIds: [projectId],
      ...(newEndDate ? { projectEndDates: { [projectId]: newEndDate } } : {}),
    };
    addMember(member);
    setAddingToProjectId(null);
    setNewName("");
    setNewRole("Developer");
    setNewEndDate("");
  }

  // Shared row renderer for Equipo tab
  function renderMemberRow(m: typeof teamMembers[0], projectId?: string, projectEndDate?: string) {
    const isEditing    = editId === m.id;
    const isConfirm    = confirmDeleteEquipoId === m.id;
    const isEditDate   = editDateProjectId === projectId && editDateMemberId === m.id && !!projectId;
    // Member-specific date takes precedence over project-level date
    const memberEndDate = projectId ? (m.projectEndDates?.[projectId] ?? projectEndDate ?? "") : "";
    return (
      <tr key={m.id} className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
        {/* Persona */}
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {m.avatar}
            </div>
            <span className="text-sm font-medium">{m.name}</span>
          </div>
        </td>
        {/* Rol */}
        <td className="px-3 py-2.5">
          {isEditing ? (
            <select
              value={editRole}
              onChange={e => setEditRole(e.target.value as MemberRole)}
              className="px-2 py-0.5 text-xs border border-primary rounded focus:outline-none bg-white"
              autoFocus
            >
              {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[m.role] ?? roleColors.Developer}`}>
              {m.role}
            </span>
          )}
        </td>
        {/* Fecha de término */}
        {projectId && (
          <td className="px-3 py-2.5 whitespace-nowrap">
            {isEditDate ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={editDateValue}
                  onChange={e => setEditDateValue(e.target.value)}
                  className="text-xs border border-primary/40 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30 bg-white"
                  autoFocus
                />
                <button onClick={() => handleSaveDate(projectId, m.id)} className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => { setEditDateProjectId(null); setEditDateMemberId(null); }} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditDateProjectId(projectId); setEditDateMemberId(m.id); setEditDateValue(memberEndDate); }}
                className="group/date flex items-center gap-1 text-xs text-gray-600 hover:text-primary transition-colors"
                title="Editar fecha de término"
              >
                <span>{memberEndDate ? formatDate(memberEndDate) : <span className="text-muted-foreground italic">{t.no_date}</span>}</span>
                <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/date:opacity-60 transition-opacity" />
              </button>
            )}
          </td>
        )}
        {/* Actions */}
        <td className="px-3 py-2.5 text-right">
          {isEditing ? (
            <button onClick={() => saveEdit(m.id)} className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
          ) : isConfirm ? (
            <div className="flex items-center gap-1 justify-end">
              <span className="text-[10px] text-red-600 font-medium">{t.action_confirm_delete}</span>
              <button onClick={() => { deleteMember(m.id); setConfirmDeleteEquipoId(null); }}
                className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirmDeleteEquipoId(null)}
                className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(m.id, m.role)} title="Edit"
                className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setConfirmDeleteEquipoId(m.id); setEditId(null); }} title="Eliminar"
                className="p-1 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.nav_team}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {teamMembers.length} {t.team_subtitle_people} · {groups.length} {t.team_subtitle_services}
            </p>
          </div>
          <select
            value={activeSnapId}
            onChange={e => setActiveSnapId(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="live">{t.live_data}</option>
            {snapshots.map(s => (
              <option key={s.id} value={s.id}>{s.week_label}</option>
            ))}
          </select>
        </div>
        {isHistorical && (
          <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {t.historical_mode} — {snapData?.week_label}. {t.historical_readonly}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-border">
          {([
            { key: "equipo",   label: t.tab_team    },
            { key: "leaders",  label: "Directorio" },
            { key: "bench",    label: t.tab_bench   },
          ] as const).map(({ key: tabKey, label }) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
                ${tab === tabKey
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Equipo tab ── */}
      {tab === "equipo" && (
        <>
          <div className="flex flex-wrap gap-2">
            {roleCount.map(({ role, count }) => (
              <div key={role} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${roleColors[role]}`}>
                <span>{role}</span>
                <span className="opacity-60">·</span>
                <span>{count}</span>
              </div>
            ))}
          </div>

          {groups.map(({ projectId, projectName, client, members }) => {
            const isOpen   = !collapsed.has(projectId);
            const project  = projects.find(p => p.id === projectId);
            const endDate  = project?.endDate ?? "";
            const isAdding = addingToProjectId === projectId;
            return (
              <div key={projectId} className="bg-white rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleCollapse(projectId)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen
                      ? <ChevronDown  className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    }
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{projectName}</p>
                      {client && <p className="text-xs text-muted-foreground">{client}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {members.length} {members.length === 1 ? t.person_singular : t.person_plural}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2">{t.col_person}</th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{t.col_role}</th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">{t.col_end_date}</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(m => renderMemberRow(m, projectId, endDate))}

                        {/* Inline add consultant form */}
                        {isAdding && (
                          <tr className="bg-violet-50/60 border-b border-border last:border-0">
                            <td className="px-5 py-2">
                              <input
                                autoFocus
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleAddMember(projectId); if (e.key === "Escape") setAddingToProjectId(null); }}
                                placeholder={t.consultant_name_ph}
                                className="w-full text-sm border border-violet-300 rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={newRole}
                                onChange={e => setNewRole(e.target.value as MemberRole)}
                                className="text-xs border border-violet-300 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                              >
                                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={newEndDate}
                                onChange={e => setNewEndDate(e.target.value)}
                                className="text-xs border border-violet-300 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => handleAddMember(projectId)}
                                  disabled={!newName.trim()}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                                  title="Agregar"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setAddingToProjectId(null)}
                                  className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Agregar consultor button */}
                    {!isAdding && (
                      <div className="px-5 py-2.5 border-t border-border/50">
                        <button
                          onClick={() => {
                            setAddingToProjectId(projectId);
                            setNewName("");
                            setNewRole("Developer");
                            setNewEndDate(endDate);
                          }}
                          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {t.add_consultant}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {unassigned.length > 0 && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-muted/20">
                <p className="text-sm font-semibold text-muted-foreground">{t.unassigned_label} ({unassigned.length})</p>
              </div>
              <table className="w-full text-sm">
                <tbody>{unassigned.map(m => renderMemberRow(m))}</tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Directorio tab ── */}
      {tab === "leaders" && <PeopleDirectoryView />}

      {/* ── Bench tab ── */}
      {tab === "bench" && (
        <BenchView
          teamMembersOverride={isHistorical ? (snapData?.cor_manual?.teamMembers ?? liveTeamMembers) : undefined}
          projectsOverride={isHistorical ? snapData?.projects : undefined}
          isHistorical={isHistorical}
        />
      )}
    </div>
  );
}
