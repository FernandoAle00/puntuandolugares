"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "puntuando-theme";

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", next === "dark" ? "#0B1511" : "#F4F7F2");
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
      title={theme === "light" ? "Modo oscuro" : "Modo claro"}
      className="pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--surface)",
        color: "var(--fg)",
      }}
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
