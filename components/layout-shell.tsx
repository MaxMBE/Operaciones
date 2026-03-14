"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/sidebar";

const SIDEBAR_KEY = "sidebarOpen";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/login");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Leer preferencia guardada
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) setSidebarOpen(saved === "true");
    setMounted(true);
  }, []);

  function toggleSidebar() {
    setSidebarOpen(prev => {
      localStorage.setItem(SIDEBAR_KEY, String(!prev));
      return !prev;
    });
  }

  // Página de login: sin sidebar, full screen
  if (isAuth) return <>{children}</>;

  // Evitar flash de layout incorrecto antes de leer localStorage
  if (!mounted) return null;

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* Botón para abrir sidebar cuando está cerrado */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 w-6 h-14 bg-white border border-l-0 border-border rounded-r-lg flex items-center justify-center shadow-md hover:bg-indigo-50 transition-colors print:hidden"
          title="Mostrar menú"
        >
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}

      <main
        className={`min-h-screen bg-background print:ml-0 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "ml-56" : "ml-0"
        }`}
      >
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </>
  );
}
