import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "sv" | "en";
export type AppMode = "simple" | "advanced";

interface AppCtx {
  lang: Language;
  setLang: (l: Language) => void;
  mode: AppMode;
  setMode: (m: AppMode) => void;
}

const Ctx = createContext<AppCtx | null>(null);

const LS_LANG = "atmoce.lang";
const LS_MODE = "atmoce.mode";

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("sv");
  const [mode, setModeState] = useState<AppMode>("simple");

  useEffect(() => {
    try {
      const l = localStorage.getItem(LS_LANG);
      if (l === "sv" || l === "en") setLangState(l);
      const m = localStorage.getItem(LS_MODE);
      if (m === "simple" || m === "advanced") setModeState(m);
    } catch {
      // ignore
    }
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(LS_LANG, l);
    } catch {
      // ignore
    }
  };
  const setMode = (m: AppMode) => {
    setModeState(m);
    try {
      localStorage.setItem(LS_MODE, m);
    } catch {
      // ignore
    }
  };

  return (
    <Ctx.Provider value={{ lang, setLang, mode, setMode }}>{children}</Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

/** Translation helper: returns sv or en string based on current language. */
export function useT() {
  const { lang } = useApp();
  return (sv: string, en: string) => (lang === "en" ? en : sv);
}