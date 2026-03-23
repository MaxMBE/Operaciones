"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useData } from "@/lib/data-context";
import type { Oportunidad, OportunidadModelo } from "@/types";
import { Search, X, Pencil, Trash2, Plus, Download, Check, ArrowUpDown, ArrowUp, ArrowDown, ImagePlus, Loader2, AlertCircle } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";

const MODELOS: OportunidadModelo[] = ["Fixed Price", "Workpackage", "Time & Material", "Competence Center", "Service Center", "Other"];

const ESTADOS_COMUNES = [
  "PENDIENTE INFO CLIENTE",
  "PENDIENTE OPS",
  "ENTREGADA x PIO",
  "ENTREGADA x OPS",
  "INFORMACIÓN ENTREGADA POR EL CLIENTE, PROPUESTA EN CURSO.",
  "PERDIDO",
  "GANADO",
];

function probColor(p: number) {
  if (p === 0)   return "bg-gray-100 text-gray-500";
  if (p <= 20)   return "bg-red-50 text-red-600";
  if (p <= 50)   return "bg-amber-50 text-amber-700";
  if (p <= 79)   return "bg-blue-50 text-blue-700";
  return "bg-emerald-50 text-emerald-700";
}

function probBar(p: number) {
  if (p === 0)   return "bg-gray-300";
  if (p <= 20)   return "bg-red-400";
  if (p <= 50)   return "bg-amber-400";
  if (p <= 79)   return "bg-blue-500";
  return "bg-emerald-500";
}

function probLabelKey(p: number): "prob_lost" | "prob_won" | "prob_low" | "prob_medium_p" | "prob_high" | "prob_very_high" {
  if (p === 0)   return "prob_lost";
  if (p === 100) return "prob_won";
  if (p <= 20)   return "prob_low";
  if (p <= 50)   return "prob_medium_p";
  if (p <= 79)   return "prob_high";
  return "prob_very_high";
}

const EMPTY: Omit<Oportunidad, "id"> = {
  numero: 0,
  encargado: "",
  probabilidad: 0,
  estadoProtec: "",
  titulo: "",
  businessManager: "",
  modelo: "Fixed Price",
  cliente: "",
};

const fieldCls = "w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-colors";

// ── Image Analysis ─────────────────────────────────────────────────────────────

interface OportunidadProposal {
  id: string | null;
  numero: number | null;
  titulo: string;
  cliente: string;
  probabilidad: number | null;
  estadoProtec: string;
  encargado: string;
  businessManager: string;
  razon: string;
  isNew: boolean;
}

function ImageAnalysisModal({ open, oportunidades, onApply, onClose }: {
  open: boolean;
  oportunidades: Oportunidad[];
  onApply: (proposals: OportunidadProposal[]) => void;
  onClose: () => void;
}) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [proposals, setProposals] = useState<OportunidadProposal[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setImageFile(null);
      setPreviewUrl(null);
      setAnalyzing(false);
      setProposals([]);
      setSelected(new Set());
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only images are accepted (JPEG, PNG, GIF, WEBP).");
      return;
    }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setProposals([]);
    setSelected(new Set());
    setError(null);
  }

  async function analyze() {
    if (!imageFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const bytes = await imageFile.arrayBuffer();
      const uint8 = new Uint8Array(bytes);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const mediaType = imageFile.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      const res = await fetch("/api/analyze-oportunidades-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType, oportunidades }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error en el análisis.");

      const ps: OportunidadProposal[] = data.proposals ?? [];
      setProposals(ps);
      setSelected(new Set(ps.map((_, i) => i)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  function applySelected() {
    onApply(proposals.filter((_, i) => selected.has(i)));
    onClose();
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }

  if (!open) return null;

  const step: "upload" | "preview" | "proposals" =
    proposals.length > 0 ? "proposals" : imageFile ? "preview" : "upload";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Analyze image</h2>
            <p className="text-indigo-200 text-xs mt-0.5">Update opportunities from a screenshot or image</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Upload step */}
          {step === "upload" && (
            <div className="p-6">
              <div
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-border hover:border-indigo-300 hover:bg-indigo-50/30"}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Drag an image or click to select</p>
                <p className="text-xs text-muted-foreground mt-1">JPEG · PNG · GIF · WEBP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                </div>
              )}
            </div>
          )}

          {/* Preview step */}
          {step === "preview" && previewUrl && (
            <div className="p-6 space-y-4">
              <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Preview" className="w-full object-contain max-h-72" />
              </div>
              <p className="text-xs text-muted-foreground text-center">{imageFile?.name}</p>
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                </div>
              )}
            </div>
          )}

          {/* Proposals step */}
          {step === "proposals" && (
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {proposals.length} {proposals.length === 1 ? "propuesta encontrada" : "propuestas encontradas"}
                </p>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setSelected(new Set(proposals.map((_, i) => i)))} className="text-indigo-600 hover:underline">Seleccionar todas</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:underline">Ninguna</button>
                </div>
              </div>

              {proposals.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No se encontraron oportunidades en la imagen.
                </div>
              ) : (
                proposals.map((p, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${selected.has(i) ? "bg-indigo-50 border-indigo-200" : "bg-muted/10 border-border hover:bg-muted/20"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                      className="mt-0.5 accent-indigo-600 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-gray-800">{p.titulo || p.cliente || "Sin título"}</span>
                        {p.isNew
                          ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 flex-shrink-0">Nueva</span>
                          : <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 flex-shrink-0">Actualización</span>
                        }
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                        {p.cliente && <span>Cliente: <strong className="text-gray-700">{p.cliente}</strong></span>}
                        {p.probabilidad !== null && <span>Prob: <strong className="text-gray-700">{p.probabilidad}%</strong></span>}
                        {p.encargado && <span>Encargado: <strong className="text-gray-700">{p.encargado}</strong></span>}
                        {p.estadoProtec && <span>Estado: <strong className="text-gray-700">{p.estadoProtec}</strong></span>}
                        {p.numero !== null && <span>Nº: <strong className="text-gray-700">{p.numero}</strong></span>}
                      </div>
                      {p.razon && <p className="text-[11px] text-indigo-600 mt-1 italic">{p.razon}</p>}
                    </div>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-3.5 border-t border-border bg-muted/10 flex-shrink-0">
          {step !== "upload" ? (
            <button
              onClick={() => { setProposals([]); setImageFile(null); setPreviewUrl(null); setError(null); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <X className="w-3 h-3" /> Cambiar imagen
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            {step === "preview" && (
              <button
                onClick={analyze}
                disabled={analyzing}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
              >
                {analyzing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...</>
                  : <>Analizar</>
                }
              </button>
            )}
            {step === "proposals" && (
              <button
                onClick={applySelected}
                disabled={selected.size === 0}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar {selected.size} {selected.size === 1 ? "cambio" : "cambios"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit / Add Modal ──────────────────────────────────────────────────────────

function OportunidadModal({ open, mode, data, onChange, onSave, onClose }: {
  open: boolean;
  mode: "add" | "edit";
  data: Omit<Oportunidad, "id">;
  onChange: (f: Partial<Omit<Oportunidad, "id">>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
          <h2 className="text-base font-semibold text-white">
            {mode === "add" ? t.modal_add_op : t.modal_edit_op}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Título — full width */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
              {t.col_title} *
            </label>
            <input
              autoFocus
              value={data.titulo}
              onChange={e => onChange({ titulo: e.target.value })}
              className={fieldCls}
              placeholder={t.col_title}
            />
          </div>

          {/* Cliente + Modelo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
                {t.col_client}
              </label>
              <input
                value={data.cliente}
                onChange={e => onChange({ cliente: e.target.value })}
                className={fieldCls}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
                {t.col_model}
              </label>
              <select
                value={data.modelo}
                onChange={e => onChange({ modelo: e.target.value as OportunidadModelo })}
                className={fieldCls}
              >
                {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Encargado + Nº */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
                {t.col_manager}
              </label>
              <input
                value={data.encargado}
                onChange={e => onChange({ encargado: e.target.value })}
                className={fieldCls}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
                {t.col_number}
              </label>
              <input
                type="number"
                value={data.numero || ""}
                onChange={e => onChange({ numero: Number(e.target.value) })}
                className={fieldCls}
              />
            </div>
          </div>

          {/* Business Manager + Probabilidad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
                {t.col_biz_manager}
              </label>
              <input
                value={data.businessManager}
                onChange={e => onChange({ businessManager: e.target.value })}
                className={fieldCls}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
                {t.col_prob}
              </label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={data.probabilidad}
                  onChange={e => onChange({ probabilidad: Number(e.target.value) })}
                  className="flex-1 accent-violet-600 cursor-pointer"
                />
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${probColor(data.probabilidad)}`}>
                  {data.probabilidad}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${probBar(data.probabilidad)}`}
                  style={{ width: `${data.probabilidad}%` }}
                />
              </div>
            </div>
          </div>

          {/* Estado Protec — full width */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wide">
              {t.col_estado_protec}
            </label>
            <input
              list="estados-modal-list"
              value={data.estadoProtec}
              onChange={e => onChange({ estadoProtec: e.target.value })}
              className={fieldCls}
              placeholder={t.col_estado_protec}
            />
            <datalist id="estados-modal-list">
              {ESTADOS_COMUNES.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
          >
            {t.action_cancel}
          </button>
          <button
            onClick={onSave}
            disabled={!data.titulo.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            {t.action_save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OportunidadesPage() {
  const { oportunidades, addOportunidad, updateOportunidad, deleteOportunidad } = useData();
  const t = useT();
  const { lang } = useLang();

  const HEADERS = [t.col_client, t.col_title, t.col_model, t.col_number, t.col_manager, t.col_prob, t.col_biz_manager, t.col_estado_protec, ""];

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState("");
  const [filterEnc,     setFilterEnc]     = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterModelo,  setFilterModelo]  = useState<OportunidadModelo | "">("");

  // ── Modal ─────────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [modalId,   setModalId]   = useState<string | null>(null);
  const [modalData, setModalData] = useState<Omit<Oportunidad, "id">>(EMPTY);

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const [sortProb, setSortProb] = useState<"desc" | "asc" | null>(null);

  // ── Delete confirm ───────────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Image analysis modal ─────────────────────────────────────────────────────
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // ── Hover tooltip ─────────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{ o: Oportunidad; top: number; right: number } | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const encargados = useMemo(() => [...new Set(oportunidades.map(o => o.encargado))].sort(), [oportunidades]);
  const clientes   = useMemo(() => [...new Set(oportunidades.map(o => o.cliente))].sort(),   [oportunidades]);

  const filtered = useMemo(() => oportunidades.filter(o => {
    if (filterEnc     && o.encargado !== filterEnc)     return false;
    if (filterCliente && o.cliente   !== filterCliente) return false;
    if (filterModelo  && o.modelo    !== filterModelo)  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.titulo.toLowerCase().includes(q)          ||
        o.cliente.toLowerCase().includes(q)         ||
        o.encargado.toLowerCase().includes(q)       ||
        o.businessManager.toLowerCase().includes(q) ||
        String(o.numero).includes(q)
      );
    }
    return true;
  }), [oportunidades, filterEnc, filterCliente, filterModelo, search]);

  const sortedFiltered = useMemo(() => {
    if (!sortProb) return filtered;
    return [...filtered].sort((a, b) =>
      sortProb === "desc" ? b.probabilidad - a.probabilidad : a.probabilidad - b.probabilidad
    );
  }, [filtered, sortProb]);

  const hasFilters = search || filterEnc || filterCliente || filterModelo;

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total      = oportunidades.length;
    const ganadas    = oportunidades.filter(o => o.probabilidad === 100).length;
    const perdidas   = oportunidades.filter(o => o.estadoProtec.includes("PERDIDO") || o.probabilidad === 0).length;
    const promProbab = total ? Math.round(oportunidades.reduce((s, o) => s + o.probabilidad, 0) / total) : 0;
    return { total, ganadas, perdidas, promProbab };
  }, [oportunidades]);

  // ── Modal handlers ────────────────────────────────────────────────────────────
  function openAddModal() {
    setModalMode("add");
    setModalId(null);
    setModalData(EMPTY);
    setModalOpen(true);
    setTooltip(null);
    setConfirmDeleteId(null);
  }

  function openEditModal(o: Oportunidad) {
    setModalMode("edit");
    setModalId(o.id);
    setModalData({
      numero: o.numero, encargado: o.encargado, probabilidad: o.probabilidad,
      estadoProtec: o.estadoProtec, titulo: o.titulo, businessManager: o.businessManager,
      modelo: o.modelo, cliente: o.cliente,
    });
    setModalOpen(true);
    setTooltip(null);
    setConfirmDeleteId(null);
  }

  function handleModalSave() {
    if (modalMode === "add") {
      if (!modalData.titulo.trim()) return;
      addOportunidad({ ...modalData, id: `op-${Date.now()}` });
    } else {
      if (!modalId) return;
      updateOportunidad(modalId, modalData);
    }
    setModalOpen(false);
  }

  // ── Image analysis apply ─────────────────────────────────────────────────────
  function handleApplyProposals(proposals: OportunidadProposal[]) {
    proposals.forEach(p => {
      if (p.isNew || !p.id) {
        addOportunidad({
          id: `op-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          numero: p.numero ?? 0,
          titulo: p.titulo,
          cliente: p.cliente,
          probabilidad: p.probabilidad ?? 0,
          estadoProtec: p.estadoProtec,
          encargado: p.encargado,
          businessManager: p.businessManager,
          modelo: "Fixed Price",
        });
      } else {
        updateOportunidad(p.id, {
          ...(p.titulo              && { titulo:          p.titulo }),
          ...(p.cliente             && { cliente:         p.cliente }),
          ...(p.probabilidad !== null && { probabilidad: p.probabilidad }),
          ...(p.estadoProtec        && { estadoProtec:    p.estadoProtec }),
          ...(p.encargado           && { encargado:       p.encargado }),
          ...(p.businessManager     && { businessManager: p.businessManager }),
          ...(p.numero !== null     && { numero:          p.numero }),
        });
      }
    });
  }

  // ── Hover tooltip ─────────────────────────────────────────────────────────────
  function handleRowMouseEnter(e: React.MouseEvent<HTMLTableRowElement>, o: Oportunidad) {
    if (modalOpen) return;
    const rect     = e.currentTarget.getBoundingClientRect();
    const tooltipW = 320;
    const left     = rect.right + 8;
    const right    = left + tooltipW > window.innerWidth ? rect.left - tooltipW - 8 : left;
    setTooltip({ o, top: rect.top, right });
  }

  // ── PDF export ────────────────────────────────────────────────────────────────
  function exportPDF() {
    const rows = filtered.map(o => `
      <tr>
        <td>${o.cliente}</td>
        <td style="max-width:200px">${o.titulo}</td>
        <td>${o.modelo}</td>
        <td>${o.numero}</td>
        <td>${o.encargado}</td>
        <td><strong>${o.probabilidad}%</strong></td>
        <td>${o.businessManager}</td>
        <td style="font-size:10px;max-width:220px">${o.estadoProtec}</td>
      </tr>`).join("");

    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Oportunidades OPS</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;padding:28px;color:#111}
  h1{font-size:16px;margin-bottom:2px}p.sub{font-size:11px;color:#666;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{background:#1e3a5f;color:#fff;text-align:left;padding:7px 8px;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  tr:nth-child(even) td{background:#f9fafb}
  @media print{body{padding:0}}
</style></head><body>
<h1>Oportunidades OPS</h1>
<p class="sub">Generated ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-CL",{day:"2-digit",month:"long",year:"numeric"})} · ${filtered.length} ${t.oportunidades_subtitle}</p>
<table>
  <thead><tr><th>Cliente</th><th>Título</th><th>Modelo</th><th>Nº</th><th>Encargado</th><th>Prob.</th><th>Business Manager</th><th>Estado Protec</th></tr></thead>
  <tbody>${rows}</tbody>
</table></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{t.nav_oportunidades} OPS</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{oportunidades.length} {t.oportunidades_subtitle}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.kpi_total,     value: kpis.total,            color: "bg-blue-50 border-blue-200 text-blue-700"           },
          { label: t.kpi_avg_prob,  value: `${kpis.promProbab}%`, color: "bg-violet-50 border-violet-200 text-violet-700"     },
          { label: t.kpi_delivered, value: kpis.ganadas,          color: "bg-emerald-50 border-emerald-200 text-emerald-700"  },
          { label: t.kpi_lost,      value: kpis.perdidas,         color: "bg-red-50 border-red-200 text-red-700"              },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-3.5 ${color}`}>
            <p className="text-xs font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + actions bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.search_ops}
            className="w-full pl-8 pr-8 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select value={filterEnc} onChange={e => setFilterEnc(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none bg-white">
          <option value="">{t.filter_all_managers}</option>
          {encargados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none bg-white">
          <option value="">{t.filter_all_clients}</option>
          {clientes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterModelo} onChange={e => setFilterModelo(e.target.value as OportunidadModelo | "")}
          className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none bg-white">
          <option value="">{t.filter_all_models}</option>
          {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterEnc(""); setFilterCliente(""); setFilterModelo(""); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl bg-white hover:bg-muted/30 transition-colors">
            <X className="w-3.5 h-3.5" />{t.action_clear}
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} de {oportunidades.length}</span>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />{t.modal_add_op}
        </button>
        <button onClick={exportPDF}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors">
          <Download className="w-3.5 h-3.5" />{t.action_export_pdf}
        </button>
        <button
          onClick={() => { setImageModalOpen(true); setTooltip(null); }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-700 border border-violet-200 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors"
        >
          <ImagePlus className="w-3.5 h-3.5" /> Analizar imagen
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-muted/20 border-b border-border">
              {HEADERS.map((h, i) => {
                const isProbCol = i === 5; // Prob. column index
                return isProbCol ? (
                  <th key={i} className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                    <button
                      onClick={() => setSortProb(s => s === "desc" ? "asc" : s === "asc" ? null : "desc")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {h}
                      {sortProb === "desc" ? <ArrowDown className="w-3 h-3" /> :
                       sortProb === "asc"  ? <ArrowUp   className="w-3 h-3" /> :
                       <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                ) : (
                  <th key={i} className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap">{h}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t.no_ops}
                </td>
              </tr>
            )}

            {sortedFiltered.map(o => {
              const isConfirm = confirmDeleteId === o.id;
              return (
                <tr
                  key={o.id}
                  className="group border-b border-border last:border-0 hover:bg-indigo-50/30 transition-colors cursor-default"
                  onMouseEnter={e => handleRowMouseEnter(e, o)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Cliente */}
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-800 whitespace-nowrap">{o.cliente}</td>
                  {/* Título */}
                  <td className="px-3 py-2.5 text-xs font-medium max-w-[200px]">
                    <span className="line-clamp-2">{o.titulo}</span>
                  </td>
                  {/* Modelo */}
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 whitespace-nowrap">
                      {o.modelo}
                    </span>
                  </td>
                  {/* Nº */}
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{o.numero}</td>
                  {/* Encargado */}
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{o.encargado}</td>
                  {/* Prob. */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1 min-w-[56px]">
                      <span className={`inline-block text-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${probColor(o.probabilidad)}`}>
                        {o.probabilidad}%
                      </span>
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${probBar(o.probabilidad)}`} style={{ width: `${o.probabilidad}%` }} />
                      </div>
                    </div>
                  </td>
                  {/* Business Manager */}
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{o.businessManager}</td>
                  {/* Estado Protec */}
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[200px]">
                    <span className="line-clamp-1">{o.estadoProtec}</span>
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-2.5">
                    {isConfirm ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">{t.action_confirm_delete}</span>
                        <button onClick={() => { deleteOportunidad(o.id); setConfirmDeleteId(null); }}
                          className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(o)}
                          title={t.action_edit}
                          className="p-1.5 rounded text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(o.id); setTooltip(null); }}
                          title={t.action_delete}
                          className="p-1.5 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
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

      {/* ── Hover tooltip card (fixed position) ── */}
      {tooltip && !modalOpen && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{
            top:  Math.min(tooltip.top, window.innerHeight - 320),
            left: tooltip.right,
          }}
        >
          <div className="bg-white border border-border rounded-2xl shadow-2xl w-80 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3">
              <p className="text-white font-bold text-sm leading-snug">{tooltip.o.cliente}</p>
              <p className="text-indigo-200 text-[11px] mt-0.5">#{tooltip.o.numero}</p>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              {/* Título */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{t.tooltip_title}</p>
                <p className="text-xs text-gray-700 leading-snug">{tooltip.o.titulo}</p>
              </div>

              {/* Probabilidad */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.tooltip_probability}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${probBar(tooltip.o.probabilidad)}`} style={{ width: `${tooltip.o.probabilidad}%` }} />
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${probColor(tooltip.o.probabilidad)}`}>
                    {tooltip.o.probabilidad}% · {t[probLabelKey(tooltip.o.probabilidad)]}
                  </span>
                </div>
              </div>

              {/* Grid of details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{t.tooltip_manager}</p>
                  <p className="text-xs text-gray-700">{tooltip.o.encargado}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{t.tooltip_model}</p>
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">
                    {tooltip.o.modelo}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{t.tooltip_biz_manager}</p>
                  <p className="text-xs text-gray-700">{tooltip.o.businessManager}</p>
                </div>
              </div>

              {/* Estado Protec */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{t.tooltip_estado}</p>
                <p className="text-xs text-gray-600 leading-snug bg-muted/40 rounded-lg px-2.5 py-1.5">{tooltip.o.estadoProtec || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit/Add Modal ── */}
      <OportunidadModal
        open={modalOpen}
        mode={modalMode}
        data={modalData}
        onChange={f => setModalData(prev => ({ ...prev, ...f }))}
        onSave={handleModalSave}
        onClose={() => setModalOpen(false)}
      />

      {/* ── Image Analysis Modal ── */}
      <ImageAnalysisModal
        open={imageModalOpen}
        oportunidades={oportunidades}
        onApply={handleApplyProposals}
        onClose={() => setImageModalOpen(false)}
      />
    </div>
  );
}
