"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { es, en } from "./translations";

type Lang = "es" | "en";
type Translations = typeof es;

interface I18nContextType {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

const LANG_KEY = "ph_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as Lang | null;
      if (saved === "en" || saved === "es") {
        setLang(saved);
        document.documentElement.lang = saved;
      }
    } catch {}
  }, []);

  function toggleLang() {
    setLang((prev) => {
      const next: Lang = prev === "es" ? "en" : "es";
      try { localStorage.setItem(LANG_KEY, next); } catch {}
      document.documentElement.lang = next;
      return next;
    });
  }

  const t = lang === "en" ? en : es;

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within LanguageProvider");
  return ctx.t;
}

export function useLang() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return { lang: ctx.lang, toggleLang: ctx.toggleLang };
}
