"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useData } from "@/lib/data-context";
import type { HealthStatus, ProjectReport, Milestone } from "@/types";
import { ArrowLeft, Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { PrintHeader } from "@/components/print-header";

// ── Constants ─────────────────────────────────────────────────────────────────

const healthMeta: Record<HealthStatus, { label: string; bg: string; text: string; border: string }> = {
  G:    { label: "G",   bg: "bg-emerald-500", text: "text-white",    border: "border-emerald-600" },
  A:    { label: "A",   bg: "bg-amber-400",   text: "text-white",    border: "border-amber-500"   },
  R:    { label: "R",   bg: "bg-red-500",     text: "text-white",    border: "border-red-600"     },
  grey: { label: "—",   bg: "bg-gray-300",    text: "text-gray-600", border: "border-gray-400"    },
  B:    { label: "B",   bg: "bg-blue-500",    text: "text-white",    border: "border-blue-600"    },
  done: { label: "✅",  bg: "bg-teal-500",    text: "text-white",    border: "border-teal-600"    },
};

const MILESTONE_BG: Record<string, string> = {
  blue: "bg-blue-500", indigo: "bg-indigo-500", violet: "bg-violet-500",
  emerald: "bg-emerald-500", amber: "bg-amber-500", orange: "bg-orange-500",
};

const COLOR_CYCLE = ["blue", "indigo", "violet", "emerald", "amber", "orange"];

// ── Gantt helpers ─────────────────────────────────────────────────────────────

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function getMonthsBetween(startISO: string, endISO: string): Date[] {
  const s = parseISO(startISO); const e = parseISO(endISO);
  if (!s || !e) return [];
  const months: Date[] = [];
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  const end = new Date(e.getFullYear(), e.getMonth(), 1);
  while (cur <= end && months.length < 9) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
  return months;
}

function getBarSegment(ms: Milestone, month: Date): { leftPct: number; rightPct: number } | null {
  const s = parseISO(ms.startDate); const e = parseISO(ms.endDate);
  if (!s || !e) return null;
  const mStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const mEnd   = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  if (e < mStart || s > mEnd) return null;
  const days = mEnd.getDate();
  return {
    leftPct:  s > mStart ? Math.round(((s.getDate() - 1) / days) * 100) : 0,
    rightPct: e < mEnd   ? Math.round(((days - e.getDate()) / days) * 100) : 0,
  };
}

function fmtMonth(d: Date): string {
  return d.toLocaleString("en-US", { month: "short" }).toUpperCase() + " " + d.getFullYear();
}

function fmtDateShort(iso: string): string {
  const d = parseISO(iso);
  if (!d) return iso || "—";
  return d.toLocaleString("en-US", { month: "short" }) + " " + d.getDate();
}

function newMilestone(index: number): Milestone {
  return { id: `ms-${Date.now()}-${index}`, name: "", startDate: "", endDate: "", label: "", color: COLOR_CYCLE[index % COLOR_CYCLE.length] };
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ value, editable, onChange }: {
  value: HealthStatus; editable: boolean; onChange?: (v: HealthStatus) => void;
}) {
  const m = healthMeta[value] ?? healthMeta.grey;
  if (editable) {
    return (
      <select value={value} onChange={(e) => onChange?.(e.target.value as HealthStatus)}
        className="text-xs border border-border rounded px-1 py-0.5 bg-white focus:outline-none w-full">
        {(Object.keys(healthMeta) as HealthStatus[]).map((k) => (
          <option key={k} value={k}>{healthMeta[k].label} — {k === "G" ? "Green" : k === "A" ? "Amber" : k === "R" ? "Red" : k === "B" ? "Blue" : "Grey"}</option>
        ))}
      </select>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded font-bold text-sm border ${m.bg} ${m.text} ${m.border}`}>
      {m.label}
    </span>
  );
}

// ── Field (used inside modals) ────────────────────────────────────────────────

function Field({ value, onChange, placeholder, multiline = false, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; className?: string;
}) {
  const base = "w-full text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded-lg px-2.5 py-1.5 bg-white border border-border";
  if (multiline) {
    return <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`${base} resize-none ${className}`} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className={`${base} ${className}`} />;
}

// ── Bullets (view-only, renders each bullet on its own line) ──────────────────

function Bullets({ text, placeholder, className = "" }: { text: string; placeholder?: string; className?: string }) {
  if (!text?.trim()) {
    return <p className={`text-xs text-muted-foreground italic ${className}`}>{placeholder ?? "—"}</p>;
  }

  // Split on newlines, inline bullets, or semicolons
  const items = text
    .split(/\n|(?<=\S)\s*•\s*|;\s*/)
    .map(s => s.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);

  if (items.length <= 1) {
    return <p className={`text-xs text-foreground whitespace-pre-wrap ${className}`}>{text}</p>;
  }

  return (
    <ul className={`space-y-1.5 ${className}`}>
      {items.map((item, i) => (
        <li key={i} className="text-xs flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1 flex-shrink-0" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Section Modal ─────────────────────────────────────────────────────────────

function SectionModal({ title, onSave, onClose, children }: {
  title: string; onSave: () => void; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5 text-primary" /> {title}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {children}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium">
            <Check className="w-3.5 h-3.5" /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditBtn (hover pencil on sections) ───────────────────────────────────────

function EditBtn({ onClick, label = "Edit section" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1 rounded-md bg-white shadow-sm border border-border text-muted-foreground hover:text-primary hover:border-primary"
    >
      <Pencil className="w-3 h-3" />
    </button>
  );
}

// ── Modal field row helper ────────────────────────────────────────────────────

function MRow({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

// ── Gantt table ───────────────────────────────────────────────────────────────

function GanttTable({ months, milestones, editing, onAdd, onUpdate, onRemove }: {
  months: Date[]; milestones: Milestone[]; editing: boolean;
  onAdd: () => void; onUpdate: (id: string, c: Partial<Milestone>) => void; onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-700 text-white">
            <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap w-[170px] border-r border-gray-600">Key Phases / Milestones</th>
            <th className="text-center px-2 py-1.5 font-semibold whitespace-nowrap w-[72px] border-r border-gray-600">Start Date</th>
            <th className="text-center px-2 py-1.5 font-semibold whitespace-nowrap w-[72px] border-r border-gray-600">Finish Date</th>
            {months.map((m) => (
              <th key={m.toISOString()} className="text-center px-1 py-1.5 font-semibold whitespace-nowrap min-w-[72px] border-r border-gray-600 last:border-r-0">
                {fmtMonth(m)}
              </th>
            ))}
            {editing && <th className="w-[140px] px-2 py-1.5 font-semibold text-left">Label / Color</th>}
          </tr>
        </thead>
        <tbody>
          {milestones.length === 0 && !editing && (
            <tr><td colSpan={3 + months.length} className="py-6 text-center text-muted-foreground italic">No phases — edit this section to add</td></tr>
          )}
          {milestones.map((ms, i) => (
            <tr key={ms.id} className={`border-b border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
              <td className="px-2 py-1.5 border-r border-gray-200">
                {editing ? (
                  <div className="flex items-center gap-1">
                    <input value={ms.name} onChange={(e) => onUpdate(ms.id, { name: e.target.value })} placeholder="Phase / Milestone"
                      className="flex-1 min-w-0 text-xs border border-primary rounded px-1 py-0.5 focus:outline-none" />
                    <button onClick={() => onRemove(ms.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ) : <span className="font-medium">{ms.name || "—"}</span>}
              </td>
              <td className="px-2 py-1.5 text-center text-muted-foreground whitespace-nowrap border-r border-gray-200">
                {editing ? <input type="date" value={ms.startDate} onChange={(e) => onUpdate(ms.id, { startDate: e.target.value })}
                  className="w-[100px] text-xs border border-primary rounded px-1 py-0.5 focus:outline-none" /> : fmtDateShort(ms.startDate)}
              </td>
              <td className="px-2 py-1.5 text-center text-muted-foreground whitespace-nowrap border-r border-gray-200">
                {editing ? <input type="date" value={ms.endDate} onChange={(e) => onUpdate(ms.id, { endDate: e.target.value })}
                  className="w-[100px] text-xs border border-primary rounded px-1 py-0.5 focus:outline-none" /> : fmtDateShort(ms.endDate)}
              </td>
              {months.map((month) => {
                const seg = getBarSegment(ms, month);
                const bgCls = MILESTONE_BG[ms.color] ?? MILESTONE_BG.blue;
                return (
                  <td key={month.toISOString()} className="py-1.5 relative border-r border-gray-200 last:border-r-0" style={{ minWidth: 72 }}>
                    {seg && (
                      <div className={`absolute top-1/2 -translate-y-1/2 rounded ${bgCls} flex items-center justify-center overflow-hidden`}
                        style={{ left: `${seg.leftPct}%`, right: `${seg.rightPct}%`, height: 20, minWidth: 4 }}>
                        {ms.label && <span className="text-[10px] font-semibold text-white px-1 truncate leading-none">{ms.label}</span>}
                      </div>
                    )}
                  </td>
                );
              })}
              {editing && (
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <input value={ms.label} onChange={(e) => onUpdate(ms.id, { label: e.target.value })} placeholder="Label"
                      className="w-14 text-xs border border-primary rounded px-1 py-0.5 focus:outline-none" />
                    <select value={ms.color} onChange={(e) => onUpdate(ms.id, { color: e.target.value })}
                      className="w-20 text-xs border border-border rounded px-1 py-0.5 focus:outline-none">
                      {Object.keys(MILESTONE_BG).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <button onClick={onAdd} className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add phase
        </button>
      )}
    </div>
  );
}

// ── Empty report ──────────────────────────────────────────────────────────────

function emptyReport(): ProjectReport {
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

// ── Pre-populate report from CSV project fields ───────────────────────────────

function prePopulateReport(project: import("@/types").Project): ProjectReport {
  const base = emptyReport();
  return {
    ...base,
    keyRisks:    project.csvRisks         || "",
    mitigation:  project.csvMitigation    || "",
    nextSteps:   project.csvNextActions   || "",
    statusNote:  project.shortComment     || "",
    oqd:         project.csvOqdPercent    || "",
    ftes:        String(project.teamSize  || ""),
    commitmentLevel: project.serviceLevel || "",
    reportDate:  new Date().toISOString().slice(0, 10),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectReportPage() {
  const params  = useParams();
  const router  = useRouter();
  const { projects, reportData, updateReport } = useData();

  const projectId = Array.isArray(params.id) ? params.id[0] : params.id as string;
  const project   = projects.find((p) => p.id === projectId);

  // Section modal state
  const [editSection, setEditSection] = useState<string | null>(null);
  const [secDraft,    setSecDraft]    = useState<Partial<ProjectReport>>({});

  // Milestone editing (inside modal)
  const [msDraft, setMsDraft] = useState<Milestone[]>([]);

  // AI generation state (must be before any conditional return)

  const ganttMonths = useMemo(
    () => getMonthsBetween(project?.startDate ?? "", project?.endDate ?? ""),
    [project?.startDate, project?.endDate]
  );

  if (!project) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Project not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-primary text-sm hover:underline">← Volver</button>
      </div>
    );
  }

  const saved = reportData[projectId] ?? prePopulateReport(project);
  const data: ProjectReport = saved;

  // Layout detection
  const autoFP = [data.commitmentLevel, project.serviceLevel, project.serviceType]
    .some((f) => /fixed|precio fijo/i.test(f ?? ""));
  const isFixedPrice = data.reportLayout === "fp" || (data.reportLayout !== "cc" && autoFP);

  function toggleLayout() {
    const next: "fp" | "cc" = isFixedPrice ? "cc" : "fp";
    updateReport(projectId, { ...saved, reportLayout: next });
  }

  // ── Section modal helpers ────────────────────────────────────────────────
  function openSec(key: string, fields: (keyof ProjectReport)[]) {
    const initial: Partial<ProjectReport> = {};
    fields.forEach(f => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (initial as any)[f] = (saved as any)[f] ?? "";
    });
    setSecDraft(initial);
    setEditSection(key);
  }

  function saveSec() {
    updateReport(projectId, { ...saved, ...secDraft });
    setEditSection(null);
    setSecDraft({});
  }

  function setSec<K extends keyof ProjectReport>(k: K, v: ProjectReport[K]) {
    setSecDraft(d => ({ ...d, [k]: v }));
  }

  function openMilestones() {
    setMsDraft([...(saved.milestones ?? [])]);
    setEditSection("milestones");
  }

  function saveMilestones() {
    updateReport(projectId, { ...saved, milestones: msDraft });
    setEditSection(null);
  }

  // ── Top bar ───────────────────────────────────────────────────────────────
  const topBar = (
    <div className="space-y-3">
      <PrintHeader title={project.name} subtitle={project.client} />
      <div className="flex items-center justify-between print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={toggleLayout}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium ${isFixedPrice ? "bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100" : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
            {isFixedPrice ? "Fixed Price" : "CC / SC"} ⇄
          </button>
          <PrintButton />
        </div>
      </div>
    </div>
  );

  // ── Meta header (shared) ──────────────────────────────────────────────────
  const metaHeader = (showStatusDot: boolean) => (
    <>
      <div className="bg-gray-800 text-white px-5 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{project.serviceType ?? "Service"}</p>
          <h1 className="text-base font-bold leading-tight">{project.name}</h1>
          {project.client && <p className="text-xs text-gray-300">{project.client}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Legend */}
          <div className="flex items-center gap-2.5">
            {(Object.entries(healthMeta) as [HealthStatus, typeof healthMeta[HealthStatus]][]).map(([k, m]) => (
              <div key={k} className="flex items-center gap-1">
                <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center border ${m.bg} ${m.text} ${m.border}`}>{m.label}</span>
                <span className="text-[10px] text-gray-300">
                  {k === "G" ? "Green" : k === "A" ? "Amber" : k === "R" ? "Red" : k === "B" ? "Blue" : "Grey"}
                </span>
              </div>
            ))}
          </div>
          {showStatusDot && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Overall Status</p>
              <StatusDot value={data.overallStatus} editable={false} />
            </div>
          )}
        </div>
      </div>

      {/* Metadata row — editable via modal */}
      <div className="relative group border-b border-gray-200">
        <div className="grid grid-cols-5 text-xs divide-x divide-gray-200">
          {[
            { label: "BM",            value: project.manager || "—" },
            { label: "Team Lead",     value: project.leader  || "—" },
            { label: "FTEs",           value: data.ftes || String(project.teamSize || "—") },
            { label: "Phase",          value: data.phase        || "—" },
            { label: "Report Date",    value: data.reportDate   || "—" },
          ].map((col) => (
            <div key={col.label} className="px-3 py-2">
              <p className="text-muted-foreground font-medium mb-0.5">{col.label}</p>
              <p className="font-medium text-foreground">{col.value}</p>
            </div>
          ))}
        </div>
        <EditBtn onClick={() => openSec("meta", ["ftes", "phase", "reportDate", "commitmentLevel"])} label="Edit metadata" />
      </div>

      <div className="grid grid-cols-2 border-b border-gray-200 text-xs divide-x divide-gray-200">
        {[
          { label: "Commitment Level", value: data.commitmentLevel || project.serviceLevel || "—" },
          { label: "Start → End",       value: `${project.startDate || "—"} → ${project.endDate || "—"}` },
        ].map((col) => (
          <div key={col.label} className="px-3 py-2">
            <p className="text-muted-foreground font-medium mb-0.5">{col.label}</p>
            <p className="font-medium text-foreground">{col.value}</p>
          </div>
        ))}
      </div>
    </>
  );

  // ── Section modals content ────────────────────────────────────────────────
  const renderModal = () => {
    if (!editSection) return null;

    // Meta
    if (editSection === "meta") {
      return (
        <SectionModal title="Edit Metadata" onSave={saveSec} onClose={() => setEditSection(null)}>
          <div className="grid grid-cols-2 gap-4">
            <MRow label="FTEs"><Field value={String(secDraft.ftes ?? "")} onChange={v => setSec("ftes", v)} placeholder="e.g. 5" /></MRow>
            <MRow label="Phase"><Field value={String(secDraft.phase ?? "")} onChange={v => setSec("phase", v)} placeholder="e.g. Design" /></MRow>
            <MRow label="Report Date"><Field value={String(secDraft.reportDate ?? "")} onChange={v => setSec("reportDate", v)} placeholder="YYYY-MM-DD" /></MRow>
            <MRow label="Commitment Level"><Field value={String(secDraft.commitmentLevel ?? "")} onChange={v => setSec("commitmentLevel", v)} placeholder="Fixed Price / CC / SC" /></MRow>
          </div>
        </SectionModal>
      );
    }

    // CC Status dots
    if (editSection === "cc-status") {
      const dotFields: { label: string; key: keyof ProjectReport }[] = [
        { label: "Overall Status",   key: "overallStatus"    },
        { label: "Current Status",   key: "currentStatus"    },
        { label: "Previous Status",  key: "previousStatus"   },
        { label: "Milestones",       key: "milestonesStatus" },
        { label: "Resources",        key: "resourcesStatus"  },
        { label: "Issues",           key: "issuesStatus"     },
        { label: "Risks",            key: "risksStatus"      },
      ];
      return (
        <SectionModal title="Edit Statuses" onSave={saveSec} onClose={() => setEditSection(null)}>
          <div className="grid grid-cols-2 gap-4">
            {dotFields.map(({ label, key }) => (
              <MRow key={key} label={label}>
                <StatusDot value={(secDraft[key] as HealthStatus) ?? "grey"} editable onChange={v => setSec(key, v)} />
              </MRow>
            ))}
          </div>
        </SectionModal>
      );
    }

    // Issues & Acciones
    if (editSection === "issues") {
      return (
        <SectionModal title="Edit Issues & Actions" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Active Issues"><Field value={String(secDraft.currentIssues ?? "")} onChange={v => setSec("currentIssues", v)} multiline placeholder="• Issue 1&#10;• Issue 2" /></MRow>
          <MRow label="Ongoing Actions"><Field value={String(secDraft.actionsInProgress ?? "")} onChange={v => setSec("actionsInProgress", v)} multiline placeholder="• Action 1&#10;• Action 2" /></MRow>
        </SectionModal>
      );
    }

    // Service Health
    if (editSection === "health") {
      return (
        <SectionModal title="Edit Service Health" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Delivery Cadence"><Field value={String(secDraft.healthDelivery ?? "")} onChange={v => setSec("healthDelivery", v)} multiline placeholder="• Delivery status&#10;• ..." /></MRow>
          <MRow label="Governance"><Field value={String(secDraft.healthGovernance ?? "")} onChange={v => setSec("healthGovernance", v)} multiline placeholder="• Governance status&#10;• ..." /></MRow>
          <MRow label="Team Stability"><Field value={String(secDraft.healthTeam ?? "")} onChange={v => setSec("healthTeam", v)} multiline placeholder="• Team status&#10;• ..." /></MRow>
        </SectionModal>
      );
    }

    // Alcance
    if (editSection === "scope") {
      return (
        <SectionModal title="Edit Service Scope" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Service Scope"><Field value={String(secDraft.scopeService ?? "")} onChange={v => setSec("scopeService", v)} multiline placeholder="• Describe the scope&#10;• ..." /></MRow>
          <MRow label="Scope Type"><Field value={String(secDraft.scopeType ?? "")} onChange={v => setSec("scopeType", v)} placeholder="Recurring / T&M / Retainer" /></MRow>
        </SectionModal>
      );
    }

    // Logros & Valor
    if (editSection === "achievements") {
      return (
        <SectionModal title="Edit Achievements & Client Value" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Key Achievements"><Field value={String(secDraft.achievements ?? "")} onChange={v => setSec("achievements", v)} multiline placeholder="• Achievement 1&#10;• Achievement 2" /></MRow>
          <MRow label="Client Value"><Field value={String(secDraft.valueToClient ?? "")} onChange={v => setSec("valueToClient", v)} multiline placeholder="• Value 1&#10;• Value 2" /></MRow>
        </SectionModal>
      );
    }

    // Riesgos & Mitigación
    if (editSection === "risks") {
      return (
        <SectionModal title="Edit Risks & Mitigation" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Identified Risks"><Field value={String(secDraft.keyRisks ?? "")} onChange={v => setSec("keyRisks", v)} multiline placeholder="• Risk 1&#10;• Risk 2" /></MRow>
          <MRow label="Mitigation Plan"><Field value={String(secDraft.mitigation ?? "")} onChange={v => setSec("mitigation", v)} multiline placeholder="• Action 1&#10;• Action 2" /></MRow>
        </SectionModal>
      );
    }

    // Próximos pasos
    if (editSection === "nextsteps") {
      return (
        <SectionModal title="Edit Next Steps & Focus" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Next Steps"><Field value={String(secDraft.nextSteps ?? "")} onChange={v => setSec("nextSteps", v)} multiline placeholder="• Step 1&#10;• Step 2" /></MRow>
          <MRow label="Focus / CSF"><Field value={String(secDraft.focus ?? "")} onChange={v => setSec("focus", v)} multiline placeholder="• Factor 1&#10;• Factor 2" /></MRow>
        </SectionModal>
      );
    }

    // Nota de Estado
    if (editSection === "nota-estado") {
      return (
        <SectionModal title="Edit Status Note" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Status Note (executive summary)">
            <Field value={String(secDraft.statusNote ?? "")} onChange={v => setSec("statusNote", v)} multiline placeholder="Executive summary of service status in 2-3 sentences…" className="!rows-6" />
          </MRow>
        </SectionModal>
      );
    }

    // FP Status
    if (editSection === "fp-status") {
      return (
        <SectionModal title="Edit Fixed Price Status" onSave={saveSec} onClose={() => setEditSection(null)}>
          <div className="grid grid-cols-2 gap-4">
            {([
              { label: "Overall Status",   key: "overallStatus"   },
              { label: "Current Status",   key: "currentStatus"   },
              { label: "Previous Status",  key: "previousStatus"  },
              { label: "OTD",              key: "otd"             },
              { label: "Issues",           key: "issuesStatus"    },
              { label: "Risks",            key: "risksStatus"     },
            ] as { label: string; key: keyof ProjectReport }[]).map(({ label, key }) => (
              <MRow key={key} label={label}>
                <StatusDot value={(secDraft[key] as HealthStatus) ?? "grey"} editable onChange={v => setSec(key, v)} />
              </MRow>
            ))}
            <MRow label="Actual Progress"><Field value={String(secDraft.actualProgress ?? "")} onChange={v => setSec("actualProgress", v)} placeholder="100%" /></MRow>
            <MRow label="Planned Progress"><Field value={String(secDraft.plannedProgress ?? "")} onChange={v => setSec("plannedProgress", v)} placeholder="100%" /></MRow>
            <MRow label="OQD"><Field value={String(secDraft.oqd ?? "")} onChange={v => setSec("oqd", v)} placeholder="TBC" /></MRow>
          </div>
        </SectionModal>
      );
    }

    // FP Scope
    if (editSection === "fp-scope") {
      return (
        <SectionModal title="Edit Project Scope" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Project Scope"><Field value={String(secDraft.projectScope ?? "")} onChange={v => setSec("projectScope", v)} multiline placeholder="• Describe the scope&#10;• ..." /></MRow>
        </SectionModal>
      );
    }

    // FP Current Status
    if (editSection === "fp-current") {
      return (
        <SectionModal title="Edit Project Current Status" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Current Project Status"><Field value={String(secDraft.projectCurrentStatus ?? "")} onChange={v => setSec("projectCurrentStatus", v)} multiline placeholder="Describe current project status…" /></MRow>
        </SectionModal>
      );
    }

    // FP Risks
    if (editSection === "fp-risks") {
      return (
        <SectionModal title="Edit Key Risks & Issues" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Key Risks & Issues"><Field value={String(secDraft.keyRisks ?? "")} onChange={v => setSec("keyRisks", v)} multiline placeholder="• Risk 1&#10;• Risk 2" /></MRow>
        </SectionModal>
      );
    }

    // FP Achievements
    if (editSection === "fp-achievements") {
      return (
        <SectionModal title="Edit Key Achievements" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Key Achievements"><Field value={String(secDraft.achievements ?? "")} onChange={v => setSec("achievements", v)} multiline placeholder="• Achievement 1&#10;• Achievement 2" /></MRow>
        </SectionModal>
      );
    }

    // FP Next Steps
    if (editSection === "fp-nextsteps") {
      return (
        <SectionModal title="Edit Next Steps / CSF's" onSave={saveSec} onClose={() => setEditSection(null)}>
          <MRow label="Next Steps"><Field value={String(secDraft.nextSteps ?? "")} onChange={v => setSec("nextSteps", v)} multiline placeholder="• Step 1&#10;• Step 2" /></MRow>
          <MRow label="Focus / CSF"><Field value={String(secDraft.focus ?? "")} onChange={v => setSec("focus", v)} multiline placeholder="• Factor 1&#10;• Factor 2" /></MRow>
        </SectionModal>
      );
    }

    // Milestones
    if (editSection === "milestones") {
      return (
        <SectionModal title="Edit Phases / Milestones" onSave={saveMilestones} onClose={() => setEditSection(null)}>
          <GanttTable
            months={ganttMonths}
            milestones={msDraft}
            editing
            onAdd={() => setMsDraft(m => [...m, newMilestone(m.length)])}
            onUpdate={(id, c) => setMsDraft(m => m.map(ms => ms.id === id ? { ...ms, ...c } : ms))}
            onRemove={(id) => setMsDraft(m => m.filter(ms => ms.id !== id))}
          />
        </SectionModal>
      );
    }

    return null;
  };

  // ══════════════════════════════════════════════════════════════════
  // FIXED PRICE LAYOUT
  // ══════════════════════════════════════════════════════════════════
  if (isFixedPrice) {
    return (
      <div className="space-y-4 w-full">
        {topBar}
        {renderModal()}
        <div className="bg-white rounded-xl border border-gray-300 overflow-hidden shadow-sm">

          {metaHeader(false)}

          {/* Status bar */}
          <div className="relative group border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-9 divide-x divide-gray-200 text-xs">
              {([
                { label: "Overall Status",   type: "dot",  k: "overallStatus"   },
                { label: "Current Status",   type: "dot",  k: "currentStatus"   },
                { label: "Previous Status",  type: "dot",  k: "previousStatus"  },
                { label: "Actual Progress",  type: "text", k: "actualProgress",  ph: "100%" },
                { label: "Planned Progress", type: "text", k: "plannedProgress", ph: "100%" },
                { label: "OTD",              type: "dot",  k: "otd"             },
                { label: "OQD",              type: "text", k: "oqd",             ph: "TBC"  },
                { label: "Issues",           type: "dot",  k: "issuesStatus"    },
                { label: "Risks",            type: "dot",  k: "risksStatus"     },
              ] as Array<{ label: string; type: string; k: string; ph?: string }>).map((col) => (
                <div key={col.label} className="px-2 py-2 flex flex-col items-center gap-1">
                  <p className="text-muted-foreground font-medium text-center leading-tight text-[10px]">{col.label}</p>
                  {col.type === "dot" ? (
                    <StatusDot value={(data[col.k as keyof ProjectReport] as HealthStatus) ?? "grey"} editable={false} />
                  ) : (
                    <span className="font-bold text-sm text-foreground">
                      {(data[col.k as keyof ProjectReport] as string) || col.ph || "—"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <EditBtn onClick={() => openSec("fp-status", ["overallStatus", "currentStatus", "previousStatus", "otd", "oqd", "issuesStatus", "risksStatus", "actualProgress", "plannedProgress"])} label="Edit statuses" />
          </div>

          {/* Gantt */}
          <div className="relative group border-b border-gray-200 p-3">
            {ganttMonths.length > 0 ? (
              <GanttTable months={ganttMonths} milestones={data.milestones ?? []} editing={false}
                onAdd={() => {}} onUpdate={() => {}} onRemove={() => {}} />
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                No project dates — set Start and End in the main table to view the Gantt.
              </p>
            )}
            <EditBtn onClick={openMilestones} label="Edit phases" />
          </div>

          {/* 5 content sections */}
          <div className="grid grid-cols-5 divide-x divide-gray-200">

            <div className="relative group p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 border-b-2 border-blue-500 pb-1 mb-2">Project Scope</p>
              <Bullets text={data.projectScope ?? ""} placeholder="No data…" />
              <EditBtn onClick={() => openSec("fp-scope", ["projectScope"])} />
            </div>

            <div className="relative group p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 border-b-2 border-blue-500 pb-1 mb-2">Project Current Status</p>
              <Bullets text={data.projectCurrentStatus ?? ""} placeholder="No data…" />
              <EditBtn onClick={() => openSec("fp-current", ["projectCurrentStatus"])} />
            </div>

            <div className="relative group p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 border-b-2 border-red-500 pb-1 mb-2">Key Risks &amp; Issues</p>
              <Bullets text={data.keyRisks} placeholder="No data…" />
              <EditBtn onClick={() => openSec("fp-risks", ["keyRisks"])} />
            </div>

            <div className="relative group p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 border-b-2 border-blue-500 pb-1 mb-2">Key Achievements</p>
              <Bullets text={data.achievements} placeholder="No data…" />
              <EditBtn onClick={() => openSec("fp-achievements", ["achievements"])} />
            </div>

            <div className="relative group p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-700 border-b-2 border-emerald-500 pb-1 mb-2">Next Steps / CSF&apos;s</p>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Next Steps</p>
                <Bullets text={data.nextSteps} placeholder="No data…" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Focus</p>
                <Bullets text={data.focus} placeholder="Sin datos…" />
              </div>
              <EditBtn onClick={() => openSec("fp-nextsteps", ["nextSteps", "focus"])} />
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // CC / SC LAYOUT
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 w-full">
      {topBar}
      {renderModal()}
      <div className="bg-white rounded-xl border border-gray-300 overflow-hidden shadow-sm">

        {metaHeader(true)}

        {/* Status indicators */}
        <div className="relative group border-b border-gray-200 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Status by dimension</p>
          <div className="grid grid-cols-6 gap-3">
            {([
              { label: "Current Status",  key: "currentStatus"    },
              { label: "Previous Status", key: "previousStatus"   },
              { label: "Milestones",      key: "milestonesStatus" },
              { label: "Resources",       key: "resourcesStatus"  },
              { label: "Issues",          key: "issuesStatus"     },
              { label: "Risks",           key: "risksStatus"      },
            ] as { label: string; key: keyof ProjectReport }[]).map(({ label, key }) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <StatusDot value={data[key] as HealthStatus} editable={false} />
                <p className="text-xs text-muted-foreground text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>
          <EditBtn onClick={() => openSec("cc-status", ["overallStatus", "currentStatus", "previousStatus", "milestonesStatus", "resourcesStatus", "issuesStatus", "risksStatus"])} label="Edit statuses" />
        </div>

        {/* 4 content columns */}
        <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-200">

          <div className="relative group p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Active Issues</p>
              <Bullets text={data.currentIssues} placeholder="No issues recorded" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Ongoing Actions</p>
              <Bullets text={data.actionsInProgress} placeholder="No actions recorded" />
            </div>
            <EditBtn onClick={() => openSec("issues", ["currentIssues", "actionsInProgress"])} />
          </div>

          <div className="relative group p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Service Health</p>
            {([
              { label: "Delivery Cadence", key: "healthDelivery"   as const },
              { label: "Governance",       key: "healthGovernance" as const },
              { label: "Team Stability",   key: "healthTeam"       as const },
            ]).map(({ label, key }) => (
              <div key={key}>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
                <Bullets text={data[key]} placeholder="—" />
              </div>
            ))}
            <EditBtn onClick={() => openSec("health", ["healthDelivery", "healthGovernance", "healthTeam"])} />
          </div>

          <div className="relative group p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Service Scope</p>
              <Bullets text={data.scopeService} placeholder="No scope description" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Scope Type</p>
              <p className="text-xs text-foreground">{data.scopeType || "—"}</p>
            </div>
            <EditBtn onClick={() => openSec("scope", ["scopeService", "scopeType"])} />
          </div>

          <div className="relative group p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Key Achievements</p>
              <Bullets text={data.achievements} placeholder="No achievements recorded" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Client Value</p>
              <Bullets text={data.valueToClient} placeholder="No data" />
            </div>
            <EditBtn onClick={() => openSec("achievements", ["achievements", "valueToClient"])} />
          </div>

        </div>

        {/* 3 bottom sections */}
        <div className="grid grid-cols-3 divide-x divide-gray-200">

          <div className="relative group p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Identified Risks</p>
              <Bullets text={data.keyRisks} placeholder="No risks recorded" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Mitigation Plan</p>
              <Bullets text={data.mitigation} placeholder="No mitigation plan" />
            </div>
            <EditBtn onClick={() => openSec("risks", ["keyRisks", "mitigation"])} />
          </div>

          <div className="relative group p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Next Steps</p>
              <Bullets text={data.nextSteps} placeholder="No next steps" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Focus / CSF</p>
              <Bullets text={data.focus} placeholder="No focus defined" />
            </div>
            <EditBtn onClick={() => openSec("nextsteps", ["nextSteps", "focus"])} />
          </div>

          <div className="relative group p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Status Note</p>
            <p className="text-xs text-foreground whitespace-pre-wrap">
              {data.statusNote || <span className="text-muted-foreground italic">No note</span>}
            </p>
            <EditBtn onClick={() => openSec("nota-estado", ["statusNote"])} />
          </div>

        </div>

      </div>
    </div>
  );
}
