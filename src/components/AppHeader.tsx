import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useApp, useT } from "@/lib/app-context";
import logoAsset from "@/assets/atmoce-logo.png.asset.json";
import bgAsset from "@/assets/header-bg.png.asset.json";
import type { ReactNode } from "react";

interface Props {
  subtitle?: string;
  right?: ReactNode;
  showModeToggle?: boolean;
}

export function AppHeader({ subtitle, right, showModeToggle = true }: Props) {
  const { lang, setLang, mode, setMode } = useApp();
  const t = useT();

  return (
    <header
      className="relative border-b text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(20,8,12,0.55), rgba(20,8,12,0.55)), url(${bgAsset.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img
            src={logoAsset.url}
            alt="Atmoce"
            className="h-9 w-auto shrink-0 drop-shadow sm:h-10"
          />
          {subtitle && (
            <span className="hidden truncate text-sm text-white/80 md:inline">
              {subtitle}
            </span>
          )}
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {showModeToggle && (
            <div className="flex overflow-hidden rounded-md border border-white/30 bg-white/10 text-xs backdrop-blur">
              <button
                onClick={() => setMode("simple")}
                className={`px-3 py-1.5 font-medium transition ${
                  mode === "simple" ? "bg-white text-foreground" : "text-white hover:bg-white/10"
                }`}
              >
                {t("Enkelt", "Simple")}
              </button>
              <button
                onClick={() => setMode("advanced")}
                className={`px-3 py-1.5 font-medium transition ${
                  mode === "advanced" ? "bg-white text-foreground" : "text-white hover:bg-white/10"
                }`}
              >
                {t("Avancerat", "Advanced")}
              </button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "sv" ? "en" : "sv")}
            className="h-8 gap-1.5 rounded-md border border-white/30 bg-white/10 px-2 text-white hover:bg-white/20 hover:text-white"
            title={lang === "sv" ? "Switch to English" : "Byt till svenska"}
          >
            <span className="text-base leading-none">
              {lang === "sv" ? "🇸🇪" : "🇬🇧"}
            </span>
            <span className="text-xs font-semibold uppercase">{lang}</span>
          </Button>

          {right}
        </div>
      </div>
    </header>
  );
}