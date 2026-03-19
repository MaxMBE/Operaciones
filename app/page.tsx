"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useData } from "@/lib/data-context";
import { BurndownChart } from "@/components/metrics/burndown-chart";
import { ServicesTimelineChart } from "@/components/metrics/services-timeline-chart";
import { formatClpToUsd } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";
import { Search, X, Pencil, Check, FileText, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { PrintButton } from "@/components/print-button";
import { PrintHeader } from "@/components/print-header";
import { MultiFilter } from "@/components/multi-filter";
import { CsvUploadMenuItems } from "@/components/csv-upload-menu-items";

export default function OverviewPage() {
  const { projects, teamMembers, isDefaultData, csvFileName, rowCount, updateProject, deleteProject } = useData();
  const router = useRouter();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const statusConfig: Record<ProjectStatus, { label: string; class: string }> = {
    active:      { label: t.status_active,    class: "bg-blue-100 text-blue-700"      },
    completed:   { label: t.status_completed, class: "bg-emerald-100 text-emerald-700" },
    "at-risk":   { label: t.status_at_risk,   class: "bg-red-100 text-red-700"        },
    "on-hold":   { label: t.status_on_hold,   class: "bg-yellow-100 text-yellow-700"  },
    guarantee:   { label: t.status_guarantee,   class: "bg-purple-100 text-purple-700"  },
    delayed:     { label: t.status_delayed,     class: "bg-orange-100 text-orange-700"  },
    terminated:  { label: t.status_terminated,  class: "bg-slate-100 text-slate-600"    },
  };

  const statusBar: Record<ProjectStatus, string> = {
    active:    "bg-blue-500",
    completed: "bg-emerald-500",
    "at-risk": "bg-red-500",
    "on-hold": "bg-yellow-500",
    guarantee:  "bg-purple-500",
    delayed:    "bg-orange-500",
    terminated: "bg-slate-400",
  };

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
              Acciones
              <ChevronDown className="w-3 h-3" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                <PrintButton asMenuItem />
                <CsvUploadMenuItems onClose={() => setMenuOpen(false)} />
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
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                {[t.table_service, t.table_start_end, t.table_status, t.table_progress, t.table_type, t.table_bm, t.table_leader, ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground pb-3 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {t.no_services}
                  </td>
                </tr>
              ) : filtered.map((p) => {
                const isEditing = editId === p.id;
                const cfg = statusConfig[p.status];
                return (
                  <tr key={p.id} className={`group border-b border-border last:border-0 transition-colors ${isEditing ? "bg-primary/5" : "hover:bg-muted/40"}`}>

                    {/* Servicio + Cliente */}
                    <td className="py-2 pr-3 font-medium max-w-[180px]">
                      {isEditing ? (
                        <div className="space-y-1">
                          {field("name")}
                          {field("client")}
                        </div>
                      ) : (
                        <button
                          onClick={() => router.push(`/project/${p.id}`)}
                          className="text-left w-full group/name"
                        >
                          <p className="truncate text-sm group-hover/name:text-primary group-hover/name:underline transition-colors">{p.name}</p>
                          {p.client && <p className="text-xs text-muted-foreground truncate">{p.client}</p>}
                        </button>
                      )}
                    </td>

                    {/* Fechas */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? (
                        <div className="space-y-1">
                          {field("startDate")}
                          {field("endDate")}
                        </div>
                      ) : (
                        p.startDate ? <span>{p.startDate} → {p.endDate}</span> : "—"
                      )}
                    </td>

                    {/* Estado */}
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <select
                          value={editDraft.status}
                          onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value as ProjectStatus }))}
                          className={inputCls}
                        >
                          <option value="active">{t.status_active}</option>
                          <option value="at-risk">{t.status_at_risk}</option>
                          <option value="on-hold">{t.status_on_hold_alt}</option>
                          <option value="completed">{t.status_completed}</option>
                          <option value="guarantee">{t.status_guarantee}</option>
                          <option value="delayed">{t.status_delayed}</option>
                          <option value="terminated">{t.status_terminated}</option>
                        </select>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.class}`}>{cfg.label}</span>
                      )}
                    </td>

                    {/* Progreso */}
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input
                          type="number" min={0} max={100}
                          value={editDraft.progress ?? 0}
                          onChange={(e) => setEditDraft((d) => ({ ...d, progress: Number(e.target.value) }))}
                          className={`${inputCls} w-16`}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${statusBar[p.status]} rounded-full`} style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{p.progress}%</span>
                        </div>
                      )}
                    </td>

                    {/* Tipo */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("serviceType") : <span className="truncate block">{p.serviceType ?? "—"}</span>}
                    </td>

                    {/* Manager */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("manager") : <span className="truncate block">{p.manager || "—"}</span>}
                    </td>

                    {/* Líder */}
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {isEditing ? field("leader") : <span className="truncate block">{p.leader ?? "—"}</span>}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal eliminar */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold text-foreground">Eliminar servicio</h2>
              <p className="text-sm text-muted-foreground mt-1">
                ¿Estás seguro que deseas eliminar{" "}
                <span className="font-medium text-foreground">"{deleteTarget.name}"</span>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-muted/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
