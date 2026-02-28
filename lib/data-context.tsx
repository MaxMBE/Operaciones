"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Project, TeamMember, FinancialData, ProjectReport, Oportunidad } from "@/types";
import { projects as defaultProjects, teamMembers as defaultTeam, financialData as defaultFinance, oportunidades as defaultOportunidades } from "@/lib/data";
import { parseServicesCSV } from "@/lib/csv-parser";

const STORAGE_KEY_DATA         = "ph_csv_data";
const STORAGE_KEY_FINANCE      = "ph_finance_data";
const STORAGE_KEY_REPORTS      = "ph_report_data";
const STORAGE_KEY_OPORTUNIDADES = "ph_oportunidades";

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
  updateProject: (id: string, changes: Partial<Project>) => void;
  updateMember: (id: string, changes: Partial<TeamMember>) => void;
  deleteMember: (id: string) => void;
  addMember: (member: import("@/types").TeamMember) => void;
  reportData: Record<string, ProjectReport>;
  updateReport: (projectId: string, changes: Partial<ProjectReport>) => void;
  oportunidades: Oportunidad[];
  addOportunidad: (o: Oportunidad) => void;
  updateOportunidad: (id: string, changes: Partial<Oportunidad>) => void;
  deleteOportunidad: (id: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects]         = useState<Project[]>(defaultProjects);
  const [teamMembers, setTeamMembers]   = useState<TeamMember[]>(defaultTeam);
  const [financialData, setFinancialData] = useState<FinancialData[]>(defaultFinance);
  const [reportData, setReportData] = useState<Record<string, ProjectReport>>({});
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>(defaultOportunidades);
  const [isDefaultData, setIsDefaultData] = useState(true);
  const [csvFileName, setCsvFileName]   = useState<string | null>(null);
  const [rowCount, setRowCount]         = useState(0);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      const savedFinance = localStorage.getItem(STORAGE_KEY_FINANCE);
      if (saved) {
        const { projects: p, teamMembers: t, fileName, rowCount: rc } = JSON.parse(saved);
        setProjects(p);
        setTeamMembers(t);
        setIsDefaultData(false);
        setCsvFileName(fileName);
        setRowCount(rc);
        if (savedFinance) {
          setFinancialData(JSON.parse(savedFinance));
        } else {
          setFinancialData(p.map((proj: Project) => ({
            projectId: proj.id, revenue: 0, directCosts: 0, operatingExpenses: 0, budget: 0, spent: 0,
          })));
        }
      } else if (savedFinance) {
        setFinancialData(JSON.parse(savedFinance));
      }
      const savedReports = localStorage.getItem(STORAGE_KEY_REPORTS);
      if (savedReports) setReportData(JSON.parse(savedReports));
      const savedOps = localStorage.getItem(STORAGE_KEY_OPORTUNIDADES);
      if (savedOps) setOportunidades(JSON.parse(savedOps));
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const loadFromCSV = useCallback((text: string, fileName: string) => {
    try {
      const result = parseServicesCSV(text);
      if (result.rowCount === 0) {
        return { success: false, error: "El CSV no contiene filas de datos válidos." };
      }
      setProjects(result.projects);
      setTeamMembers(result.teamMembers);
      setFinancialData(result.financialData);
      setIsDefaultData(false);
      setCsvFileName(fileName);
      setRowCount(result.rowCount);

      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify({
        projects: result.projects,
        teamMembers: result.teamMembers,
        fileName,
        rowCount: result.rowCount,
      }));
      localStorage.setItem(STORAGE_KEY_FINANCE, JSON.stringify(result.financialData));
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
    localStorage.removeItem(STORAGE_KEY_DATA);
    localStorage.removeItem(STORAGE_KEY_FINANCE);
  }, []);

  const updateReport = useCallback((projectId: string, changes: Partial<ProjectReport>) => {
    setReportData((prev) => {
      const updated = { ...prev, [projectId]: { ...prev[projectId], ...changes } };
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateFinancialData = useCallback((data: FinancialData[]) => {
    setFinancialData(data);
    localStorage.setItem(STORAGE_KEY_FINANCE, JSON.stringify(data));
  }, []);

  const updateProject = useCallback((id: string, changes: Partial<Project>) => {
    setProjects((prev) => {
      const updated = prev.map((p) => p.id === id ? { ...p, ...changes } : p);
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify({ ...parsed, projects: updated }));
      }
      return updated;
    });
  }, []);

  const updateMember = useCallback((id: string, changes: Partial<TeamMember>) => {
    setTeamMembers((prev) => {
      const updated = prev.map((m) => m.id === id ? { ...m, ...changes } : m);
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify({ ...parsed, teamMembers: updated }));
      }
      return updated;
    });
  }, []);

  const addMember = useCallback((member: import("@/types").TeamMember) => {
    setTeamMembers((prev) => {
      const updated = [...prev, member];
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify({ ...parsed, teamMembers: updated }));
      }
      return updated;
    });
  }, []);

  const addOportunidad = useCallback((o: Oportunidad) => {
    setOportunidades(prev => {
      const updated = [...prev, o];
      localStorage.setItem(STORAGE_KEY_OPORTUNIDADES, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateOportunidad = useCallback((id: string, changes: Partial<Oportunidad>) => {
    setOportunidades(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...changes } : o);
      localStorage.setItem(STORAGE_KEY_OPORTUNIDADES, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteOportunidad = useCallback((id: string) => {
    setOportunidades(prev => {
      const updated = prev.filter(o => o.id !== id);
      localStorage.setItem(STORAGE_KEY_OPORTUNIDADES, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteMember = useCallback((id: string) => {
    setTeamMembers((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify({ ...parsed, teamMembers: updated }));
      }
      return updated;
    });
  }, []);

  return (
    <DataContext.Provider value={{
      projects, teamMembers, financialData,
      isDefaultData, csvFileName, rowCount,
      loadFromCSV, resetToDefault, updateFinancialData, updateProject, updateMember, addMember, deleteMember, reportData, updateReport,
      oportunidades, addOportunidad, updateOportunidad, deleteOportunidad,
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
