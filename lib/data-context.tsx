"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { Project, TeamMember, FinancialData, ProjectReport, Oportunidad } from "@/types";
import { projects as defaultProjects, teamMembers as defaultTeam, financialData as defaultFinance, oportunidades as defaultOportunidades } from "@/lib/data";
import { parseServicesCSV } from "@/lib/csv-parser";

// Legacy localStorage keys — only used for one-time migration on first server boot
const LS_DATA          = "ph_csv_data";
const LS_FINANCE       = "ph_finance_data";
const LS_REPORTS       = "ph_report_data";
const LS_OPORTUNIDADES = "ph_oportunidades";

interface Store {
  ph_csv_data?: { projects: Project[]; teamMembers: TeamMember[]; fileName: string | null; rowCount: number };
  ph_finance_data?: FinancialData[];
  ph_report_data?: Record<string, ProjectReport>;
  ph_oportunidades?: Oportunidad[];
  ph_known_people?: { leaders: string[]; managers: string[] };
}

interface DataContextType {
  projects: Project[];
  teamMembers: TeamMember[];
  financialData: FinancialData[];
  isDefaultData: boolean;
  csvFileName: string | null;
  rowCount: number;
  loadFromCSV: (text: string, fileName: string) => { success: boolean; error?: string };
  resetToDefault: () => void;
  updateFinancialData: (data: FinancialData[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, changes: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  updateMember: (id: string, changes: Partial<TeamMember>) => void;
  deleteMember: (id: string) => void;
  addMember: (member: import("@/types").TeamMember) => void;
  reportData: Record<string, ProjectReport>;
  updateReport: (projectId: string, changes: Partial<ProjectReport>) => void;
  oportunidades: Oportunidad[];
  addOportunidad: (o: Oportunidad) => void;
  updateOportunidad: (id: string, changes: Partial<Oportunidad>) => void;
  deleteOportunidad: (id: string) => void;
  knownLeaders: string[];
  knownManagers: string[];
  addKnownLeader: (name: string) => void;
  removeKnownLeader: (name: string) => void;
  addKnownManager: (name: string) => void;
  removeKnownManager: (name: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projects,      setProjects]      = useState<Project[]>(defaultProjects);
  const [teamMembers,   setTeamMembers]   = useState<TeamMember[]>(defaultTeam);
  const [financialData, setFinancialData] = useState<FinancialData[]>(defaultFinance);
  const [reportData,    setReportData]    = useState<Record<string, ProjectReport>>({});
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>(defaultOportunidades);
  const [isDefaultData, setIsDefaultData] = useState(true);
  const [csvFileName,   setCsvFileName]   = useState<string | null>(null);
  const [rowCount,      setRowCount]      = useState(0);
  const [knownLeaders,  setKnownLeaders]  = useState<string[]>([]);
  const [knownManagers, setKnownManagers] = useState<string[]>([]);

  // loadedRef: true after initial server data has settled — prevents immediate sync-back
  const loadedRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Apply a store object into React state ─────────────────────────────
  function applyStore(store: Store) {
    if (store.ph_csv_data) {
      const { projects: p, teamMembers: t, fileName, rowCount: rc } = store.ph_csv_data;
      setProjects(p ?? defaultProjects);
      setTeamMembers(t ?? defaultTeam);
      setIsDefaultData(false);
      setCsvFileName(fileName ?? null);
      setRowCount(rc ?? 0);
    }
    if (store.ph_finance_data)  setFinancialData(store.ph_finance_data);
    if (store.ph_report_data)   setReportData(store.ph_report_data);
    if (store.ph_oportunidades) setOportunidades(store.ph_oportunidades);
    if (store.ph_known_people) {
      setKnownLeaders(store.ph_known_people.leaders ?? []);
      setKnownManagers(store.ph_known_people.managers ?? []);
    }
  }

  // ── POST store to server (debounced 300 ms) ───────────────────────────
  const pendingStore = useRef<Store | null>(null);

  function flushSync() {
    if (!pendingStore.current) return;
    const store = pendingStore.current;
    pendingStore.current = null;
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    }).catch(console.error);
  }

  function scheduleSync(store: Store) {
    pendingStore.current = store;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(flushSync, 300);
  }

  // Flush pending save before the tab closes so changes aren't lost
  useEffect(() => {
    const handler = () => flushSync();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load from server on mount; auto-migrate localStorage if needed ─────
  useEffect(() => {
    fetch("/api/data")
      .then(r => r.json())
      .then((serverStore: Store) => {
        const serverEmpty =
          !serverStore.ph_csv_data &&
          !serverStore.ph_report_data &&
          !serverStore.ph_oportunidades;

        if (serverEmpty) {
          // First boot: check if user has data in localStorage and upload it
          const local: Store = {};
          try {
            const d  = localStorage.getItem(LS_DATA);
            const f  = localStorage.getItem(LS_FINANCE);
            const r  = localStorage.getItem(LS_REPORTS);
            const op = localStorage.getItem(LS_OPORTUNIDADES);
            if (d)  local.ph_csv_data      = JSON.parse(d);
            if (f)  local.ph_finance_data  = JSON.parse(f);
            if (r)  local.ph_report_data   = JSON.parse(r);
            if (op) local.ph_oportunidades = JSON.parse(op);
          } catch { /* ignore */ }

          if (Object.keys(local).length > 0) {
            applyStore(local);
            fetch("/api/data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(local),
            }).catch(console.error);
          }
        } else {
          applyStore(serverStore);
        }
      })
      .catch(console.error)
      .finally(() => {
        // Small delay so React state setters from applyStore settle before sync is enabled
        setTimeout(() => { loadedRef.current = true; }, 200);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync to server whenever any data state changes ────────────────────
  useEffect(() => {
    if (!loadedRef.current) return;
    const store: Store = {
      ph_finance_data:  financialData,
      ph_report_data:   reportData,
      ph_oportunidades: oportunidades,
    };
    if (!isDefaultData || csvFileName) {
      store.ph_csv_data = { projects, teamMembers, fileName: csvFileName, rowCount };
    }
    store.ph_known_people = { leaders: knownLeaders, managers: knownManagers };
    scheduleSync(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, teamMembers, financialData, reportData, oportunidades, knownLeaders, knownManagers]);

  // ── Setters (pure state updates — server sync handled by effect above) ─

  const loadFromCSV = useCallback((text: string, fileName: string) => {
    try {
      const result = parseServicesCSV(text);
      if (result.rowCount === 0) {
        return { success: false, error: "El CSV no contiene filas de datos válidos." };
      }
      setProjects(prev => {
        const manualProjects = prev.filter(p => p.id.startsWith("manual-"));
        const merged = result.projects.map(csvP => {
          const existing = prev.find(p => p.id === csvP.id);
          if (!existing) return csvP;
          return {
            ...csvP,
            revenueMonthly:    existing.revenueMonthly,
            costMonthly:       existing.costMonthly,
            revenueProjection: existing.revenueProjection,
            costProjection:    existing.costProjection,
          };
        });
        return [...merged, ...manualProjects];
      });
      setTeamMembers(result.teamMembers);
      setFinancialData(result.financialData);
      setIsDefaultData(false);
      setCsvFileName(fileName);
      setRowCount(result.rowCount);
      return { success: true };
    } catch (e) {
      return { success: false, error: `Error al parsear el CSV: ${(e as Error).message}` };
    }
  }, []);

  const resetToDefault = useCallback(() => {
    setProjects(defaultProjects);
    setTeamMembers(defaultTeam);
    setFinancialData(defaultFinance);
    setIsDefaultData(true);
    setCsvFileName(null);
    setRowCount(0);
    // Also wipe server store
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(console.error);
  }, []);

  const updateReport = useCallback((projectId: string, changes: Partial<ProjectReport>) => {
    setReportData(prev => ({ ...prev, [projectId]: { ...prev[projectId], ...changes } }));
  }, []);

  const updateFinancialData = useCallback((data: FinancialData[]) => {
    setFinancialData(data);
  }, []);

  const addProject = useCallback((project: Project) => {
    setProjects(prev => [...prev, project]);
    setIsDefaultData(false);
  }, []);

  const updateProject = useCallback((id: string, changes: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setFinancialData(prev => prev.filter(f => f.projectId !== id));
    setReportData(prev => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const updateMember = useCallback((id: string, changes: Partial<TeamMember>) => {
    setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
  }, []);

  const addMember = useCallback((member: import("@/types").TeamMember) => {
    setTeamMembers(prev => [...prev, member]);
  }, []);

  const deleteMember = useCallback((id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id));
  }, []);

  const addOportunidad = useCallback((o: Oportunidad) => {
    setOportunidades(prev => [...prev, o]);
  }, []);

  const updateOportunidad = useCallback((id: string, changes: Partial<Oportunidad>) => {
    setOportunidades(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o));
  }, []);

  const deleteOportunidad = useCallback((id: string) => {
    setOportunidades(prev => prev.filter(o => o.id !== id));
  }, []);

  // Auto-seed knownLeaders/Managers from project data if still empty after load
  useEffect(() => {
    if (!loadedRef.current) return;
    if (knownLeaders.length === 0 && projects.length > 0) {
      const leaders = [...new Set(projects.map(p => p.leader?.trim()).filter(Boolean))] as string[];
      if (leaders.length > 0) setKnownLeaders(leaders.sort());
    }
    if (knownManagers.length === 0 && projects.length > 0) {
      const managers = [...new Set(projects.map(p => p.manager?.trim()).filter(Boolean))] as string[];
      if (managers.length > 0) setKnownManagers(managers.sort());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedRef.current, projects.length]);

  const addKnownLeader = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setKnownLeaders(prev => prev.some(l => l.toLowerCase() === n.toLowerCase()) ? prev : [...prev, n].sort());
  }, []);
  const removeKnownLeader = useCallback((name: string) => {
    setKnownLeaders(prev => prev.filter(l => l !== name));
  }, []);
  const addKnownManager = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setKnownManagers(prev => prev.some(m => m.toLowerCase() === n.toLowerCase()) ? prev : [...prev, n].sort());
  }, []);
  const removeKnownManager = useCallback((name: string) => {
    setKnownManagers(prev => prev.filter(m => m !== name));
  }, []);

  return (
    <DataContext.Provider value={{
      projects, teamMembers, financialData,
      isDefaultData, csvFileName, rowCount,
      loadFromCSV, resetToDefault, updateFinancialData,
      addProject, updateProject, deleteProject,
      updateMember, addMember, deleteMember,
      reportData, updateReport,
      oportunidades, addOportunidad, updateOportunidad, deleteOportunidad,
      knownLeaders, knownManagers, addKnownLeader, removeKnownLeader, addKnownManager, removeKnownManager,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
