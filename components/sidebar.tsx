"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, TrendingUp, Globe, PieChart, LogOut, ChevronLeft, Calculator } from "lucide-react";
import { cn, getFiscalQuarter } from "@/lib/utils";
import { useT, useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-client";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const { lang, toggleLang } = useLang();
  const [fq, setFq] = useState<ReturnType<typeof getFiscalQuarter> | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setFq(getFiscalQuarter(new Date()));
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;

      // Intentar obtener nombre desde user_profiles
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", u.id)
        .single();

      if (profile?.first_name) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
        setUserName(fullName);
        return;
      }

      // Fallback a user_metadata
      const name =
        u.user_metadata?.first_name
          ? [u.user_metadata.first_name, u.user_metadata.last_name].filter(Boolean).join(" ")
          : u.user_metadata?.full_name ||
            u.user_metadata?.name ||
            u.email?.split("@")[0] ||
            "User";
      setUserName(name);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = [
    { href: "/",              label: t.nav_overview,      icon: LayoutDashboard },
    { href: "/portfolio",     label: "Portfolio",         icon: PieChart        },
    { href: "/team",          label: t.nav_team,          icon: Users           },
    { href: "/oportunidades", label: t.nav_oportunidades, icon: TrendingUp      },
    { href: "/finanzas",      label: "Finance",           icon: Calculator      },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full w-56 bg-white border-r border-border flex flex-col z-40 print:hidden transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo + collapse button */}
      <div className="flex flex-col items-center gap-1 px-4 py-4 border-b border-border relative">
        <img src="/sii-logo.png" alt="SII Group Chile" className="h-14 w-auto object-contain" />
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Operations</span>
        {/* Botón colapsar */}
        <button
          onClick={onToggle}
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-50"
          title="Hide menu"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Bienvenida */}
      {userName && (
        <div className="px-4 py-3 border-b border-border bg-indigo-50/60">
          <p className="text-[9px] text-indigo-400 uppercase tracking-wide font-semibold">Welcome</p>
          <p className="text-xs font-semibold text-indigo-800 truncate mt-0.5">{userName}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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

      {/* Quarter badge */}
      {fq && (
        <div className="px-3 py-2 border-t border-border">
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-white text-xs font-bold tracking-wide">{fq.label}</div>
            <div className="text-gray-400 text-[10px] mt-0.5">{fq.range} · FY{fq.fyYear}</div>
          </div>
        </div>
      )}

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

      {/* Logout */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
