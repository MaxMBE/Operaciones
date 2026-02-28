"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarRange, Users, TrendingUp, Globe, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { CsvUpload } from "@/components/csv-upload";
import { useT, useLang } from "@/lib/i18n";

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const { lang, toggleLang } = useLang();

  const nav = [
    { href: "/",              label: t.nav_overview,      icon: LayoutDashboard },
    { href: "/portfolio",     label: "Portfolio",         icon: PieChart        },
    { href: "/gantt",         label: t.nav_gantt,         icon: CalendarRange   },
    { href: "/team",          label: t.nav_team,          icon: Users           },
    { href: "/oportunidades", label: t.nav_oportunidades, icon: TrendingUp      },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1 px-4 py-4 border-b border-border">
        {/* Replace /sii-logo.png with your actual file once placed in public/ */}
        <img src="/sii-logo.png" alt="SII Group Chile" className="h-14 w-auto object-contain" />
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Operaciones</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Language toggle */}
      <div className="px-4 py-2.5 border-t border-border">
        <button
          onClick={toggleLang}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
        >
          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
          <span className={lang === "es" ? "font-semibold text-foreground" : ""}>ES</span>
          <span className="text-border">/</span>
          <span className={lang === "en" ? "font-semibold text-foreground" : ""}>EN</span>
        </button>
      </div>

      {/* CSV Upload */}
      <CsvUpload />
    </aside>
  );
}
