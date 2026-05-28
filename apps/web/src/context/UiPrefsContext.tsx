import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type TextScale = "small" | "medium" | "large";

const TEXT_SCALE_VALUE: Record<TextScale, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.15,
};

const THEME_KEY = "sunbird:theme";
const SCALE_KEY = "sunbird:textScale";

type UiPrefs = {
  theme: Theme;
  textScale: TextScale;
  setTheme: (t: Theme) => void;
  setTextScale: (s: TextScale) => void;
};

const UiPrefsContext = createContext<UiPrefs | null>(null);

function readStoredTheme(): Theme {
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "dark" ? "dark" : "light";
}

function readStoredScale(): TextScale {
  const v = window.localStorage.getItem(SCALE_KEY);
  if (v === "small" || v === "large") return v;
  return "medium";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function applyTextScale(scale: TextScale) {
  document.documentElement.style.setProperty(
    "--text-scale",
    String(TEXT_SCALE_VALUE[scale]),
  );
}

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [textScale, setScaleState] = useState<TextScale>(readStoredScale);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    applyTextScale(textScale);
    window.localStorage.setItem(SCALE_KEY, textScale);
  }, [textScale]);

  return (
    <UiPrefsContext.Provider
      value={{ theme, textScale, setTheme: setThemeState, setTextScale: setScaleState }}
    >
      {children}
    </UiPrefsContext.Provider>
  );
}

export function useUiPrefs(): UiPrefs {
  const ctx = useContext(UiPrefsContext);
  if (!ctx) throw new Error("useUiPrefs must be used inside <UiPrefsProvider>");
  return ctx;
}
