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
  const [lang] = useState<Lang>("en");

  useEffect(() => {
    document.documentElement.lang = "en";
    try { localStorage.setItem(LANG_KEY, "en"); } catch {}
  }, []);

  function toggleLang() { /* language is fixed to English */ }

  const t = en;

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
