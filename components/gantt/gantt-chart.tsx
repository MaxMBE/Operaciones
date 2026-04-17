"use client";

import { tasks, projects } from "@/lib/data";
import type { TaskStatus, Priority } from "@/types";
import { differenceInDays, parseISO, format, startOfMonth, addDays } from "date-fns";
import { enUS } from "date-fns/locale";

const statusColors: Record<TaskStatus, string> = {
  "done":        "bg-emerald-400",
  "in-progress": "bg-blue-400",
  "todo":        "bg-slate-300",
  "blocked":     "bg-red-400",
};

const priorityDot: Record<Priority, string> = {
  low:      "bg-slate-400",
  medium:   "bg-yellow-400",
  high:     "bg-orange-400",
  critical: "bg-red-500",
};

const CHART_START = new Date("2025-11-01");
const CHART_END   = new Date("2026-04-30");
const TOTAL_DAYS  = differenceInDays(CHART_END, CHART_START);

function getMonthHeaders() {
  const months: { label: string; left: number; width: number }[] = [];
  let cursor = startOfMonth(CHART_START);
  while (cursor < CHART_END) {
    const monthStart = cursor < CHART_START ? CHART_START : cursor;
    const nextMonth  = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const monthEnd   = nextMonth > CHART_END ? CHART_END : nextMonth;
    const left  = (differenceInDays(monthStart, CHART_START) / TOTAL_DAYS) * 100;
    const width = (differenceInDays(monthEnd, monthStart) / TOTAL_DAYS) * 100;
    months.push({ label: format(cursor, "MMM yyyy", { locale: enUS }), left, width });
    cursor = nextMonth;
  }
  return months;
}

export function GanttChart() {
  const months = getMonthHeaders();
  const today = new Date("2026-02-18");
  const todayLeft = (differenceInDays(today, CHART_START) / TOTAL_DAYS) * 100;

  return (
    <div className="bg-white rounded-xl border border-border p-5 overflow-x-auto">
      <h3 className="font-semibold text-sm text-foreground mb-4">Gantt Chart</h3>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        {(Object.entries(statusColors) as [TaskStatus, string][]).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${c}`} />
            {{ done: "Done", "in-progress": "In Progress", todo: "To Do", blocked: "Blocked" }[s]}
          </span>
        ))}
      </div>

      <div className="min-w-[900px]">
        {/* Encabezado de meses */}
        <div className="flex ml-64 mb-1 relative h-6">
          {months.map((m) => (
            <div
              key={m.label}
              className="absolute text-xs text-muted-foreground font-medium border-l border-border pl-1"
              style={{ left: `${m.left}%`, width: `${m.width}%` }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* Filas por proyecto */}
        {projects.map((proj) => {
          const projTasks = tasks.filter((t) => t.projectId === proj.id);
          if (projTasks.length === 0) return null;
          return (
            <div key={proj.id} className="mb-4">
              {/* Nombre proyecto */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-64 text-xs font-semibold text-foreground truncate pr-2">{proj.name}</div>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Tareas */}
              {projTasks.map((task) => {
                const start = parseISO(task.startDate);
                const end   = parseISO(task.endDate);
                const left  = Math.max(0, (differenceInDays(start, CHART_START) / TOTAL_DAYS) * 100);
                const width = Math.max(0.5, (differenceInDays(end, start) / TOTAL_DAYS) * 100);

                return (
                  <div key={task.id} className="flex items-center mb-1.5 group">
                    {/* Etiqueta tarea */}
                    <div className="w-64 flex items-center gap-1.5 pr-2 flex-shrink-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[task.priority]}`} />
                      <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                        {task.name}
                      </span>
                    </div>

                    {/* Barra */}
                    <div className="flex-1 relative h-6">
                      {/* Línea de hoy */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10 opacity-60"
                        style={{ left: `${todayLeft}%` }}
                      />
                      {/* Barra de tarea */}
                      <div
                        className={`absolute top-1 h-4 rounded ${statusColors[task.status]} opacity-90 hover:opacity-100 transition-opacity cursor-pointer`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${task.name} — ${task.progress}% — ${task.assignee}`}
                      >
                        {/* Progreso interno */}
                        <div
                          className="h-full rounded bg-white/30"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Indicador de hoy */}
        <div className="ml-64 mt-2 relative h-4">
          <div
            className="absolute flex flex-col items-center"
            style={{ left: `${todayLeft}%`, transform: "translateX(-50%)" }}
          >
            <span className="text-xs text-red-500 font-medium whitespace-nowrap">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
