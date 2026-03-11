export type ProjectStatus = "active" | "completed" | "at-risk" | "on-hold" | "guarantee" | "delayed" | "terminated";
export type OportunidadModelo = "Fixed Price" | "Workpackage" | "Time & Material" | "Competence Center" | "Service Center" | "Otro";

export interface Oportunidad {
  id: string;
  numero: number;
  encargado: string;
  probabilidad: number;     // 0-100
  estadoProtec: string;
  titulo: string;
  businessManager: string;
  modelo: OportunidadModelo;
  cliente: string;
}
export type TaskStatus = "todo" | "in-progress" | "done" | "blocked";
export type Priority = "low" | "medium" | "high" | "critical";
export type MemberRole = "BM" | "PM" | "Team Lead" | "Developer" | "Designer" | "QA" | "Analyst" | "DevOps" | "Architect" | "Data Engineer" | "Security" | "Support";

export interface TeamMember {
  id: string;
  name: string;
  role: MemberRole;
  avatar: string;
  hourlyRate: number; // USD
  hoursWorked: number;
  projectsCount: number;
  utilization: number; // %
  projectIds?: string[];  // IDs de proyectos en los que participa
  projectEndDates?: Record<string, string>; // per-member end dates, keyed by project ID
  comments?: string;
}

export interface Task {
  id: string;
  name: string;
  assignee: string;
  status: TaskStatus;
  priority: Priority;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  progress: number;  // 0-100
  projectId: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  budget: number;
  spent: number;
  revenue: number;
  startDate: string;
  endDate: string;
  teamSize: number;
  tasksTotal: number;
  tasksDone: number;
  manager: string;
  // Optional CSV-sourced fields
  client?: string;
  leader?: string;
  serviceType?: string;
  serviceLevel?: string;
  bu?: string;
  expectedProgress?: number;
  riskFlag?: boolean;
  shortComment?: string;
  // Extended CSV fields for AI report generation
  csvRisks?: string;
  csvMitigation?: string;
  csvNextActions?: string;
  csvHistoricalComments?: string;
  csvOtdPercent?: string;
  csvOqdPercent?: string;
  revenueMonthly?: number;
  costMonthly?: number;
  revenueProjection?: number;
  costProjection?: number;
}

export interface BurndownPoint {
  day: string;
  ideal: number;
  actual: number;
}

export interface FinancialData {
  projectId: string;
  revenue: number;
  directCosts: number;
  operatingExpenses: number;
  budget: number;
  spent: number;
}

export interface MemberCost {
  memberId: string;
  hourlyRate: number;
  hoursWorked: number;
}

export type HealthStatus = "G" | "A" | "R" | "grey" | "B" | "done";

export interface Milestone {
  id: string;
  name: string;
  startDate: string; // ISO "YYYY-MM-DD"
  endDate: string;
  label: string;
  color: string; // "blue" | "indigo" | "violet" | "emerald" | "amber" | "orange"
}

export interface ProjectReport {
  marginYTD: string;
  marginActual: string;
  ftes: string;
  commitmentLevel: string;
  phase: string;
  hitoPago: string;
  reportDate: string;
  overallStatus: HealthStatus;
  currentStatus: HealthStatus;
  previousStatus: HealthStatus;
  milestonesStatus: HealthStatus;
  resourcesStatus: HealthStatus;
  issuesStatus: HealthStatus;
  risksStatus: HealthStatus;
  currentIssues: string;
  actionsInProgress: string;
  healthDelivery: string;
  healthGovernance: string;
  healthTeam: string;
  teamMood?: string;
  scopeService: string;
  scopeType: string;
  achievements: string;
  valueToClient: string;
  keyRisks: string;
  mitigation: string;
  nextSteps: string;
  focus: string;
  statusNote: string;
  marginImprovement?: string;
  // Fixed Price specific
  projectScope?: string;
  projectCurrentStatus?: string;
  actualProgress?: string;
  plannedProgress?: string;
  otd?: HealthStatus;
  oqd?: string;
  milestones?: Milestone[];
  // Layout override: "fp" = Fixed Price, "cc" = Competence/Service Center
  reportLayout?: "fp" | "cc";
}
