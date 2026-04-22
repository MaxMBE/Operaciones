import { TrendingUp, CheckCircle, AlertTriangle, Users } from "lucide-react";
import { projects, teamMembers } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export function StatsCards() {
  const activeProjects  = projects.filter((p) => p.status === "active").length;
  const atRisk          = projects.filter((p) => p.status === "at-risk").length;
  const totalBudget     = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent      = projects.reduce((s, p) => s + p.spent, 0);
  const budgetUsedPct   = ((totalSpent / totalBudget) * 100).toFixed(1);
  const totalRevenue    = projects.reduce((s, p) => s + p.revenue, 0);
  const totalCosts      = projects.reduce((s, p) => s + p.spent, 0);
  const grossMargin     = (((totalRevenue - totalCosts) / totalRevenue) * 100).toFixed(1);

  const stats = [
    {
      label: "Active Projects",
      value: activeProjects,
      sub: `${atRisk} at risk`,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Budget",
      value: formatCurrency(totalBudget),
      sub: `${budgetUsedPct}% used`,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Global Gross Margin",
      value: `${grossMargin}%`,
      sub: `Revenue ${formatCurrency(totalRevenue)}`,
      icon: TrendingUp,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Team",
      value: teamMembers.length,
      sub: "active members",
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-border p-5 flex items-start gap-4">
          <div className={`${s.bg} rounded-lg p-2.5 flex-shrink-0`}>
            <s.icon className={`w-5 h-5 ${s.color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
