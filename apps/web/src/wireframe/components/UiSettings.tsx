import { useEffect, useState } from "react";
import { useUiPrefs } from "@/context/UiPrefsContext";

const OPEN_KEY = "sunbird:settingsOpen";

function readStoredOpen(): boolean {
  // Default closed — the panel is opt-in and shouldn't dominate the
  // sidebar on first login.
  try {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function UiSettings({ collapsed }: { collapsed: boolean }) {
  const { theme, textScale, setTheme, setTextScale } = useUiPrefs();
  const [open, setOpen] = useState<boolean>(readStoredOpen);

  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [open]);

  if (collapsed) {
    return (
      <div className="dt-settings collapsed">
        <button
          type="button"
          className="item"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
        >
          <span style={{ width: 18, textAlign: "center", flex: "0 0 18px" }}>
            {theme === "dark" ? "☾" : "☀"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="dt-settings">
      <button
        type="button"
        className="dt-settings-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "Hide settings" : "Show settings"}
      >
        <span style={{ width: 18, textAlign: "center", flex: "0 0 18px" }}>⚙</span>
        <span>Settings</span>
        <span className="dt-settings-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          <div className="dt-settings-row">
            <span className="dt-settings-label">Mode</span>
            <div className="dt-settings-controls">
              <button
                type="button"
                className={"dt-settings-btn" + (theme === "light" ? " active" : "")}
                onClick={() => setTheme("light")}
                title="Day mode"
              >
                ☀ day
              </button>
              <button
                type="button"
                className={"dt-settings-btn" + (theme === "dark" ? " active" : "")}
                onClick={() => setTheme("dark")}
                title="Night mode"
              >
                ☾ night
              </button>
            </div>
          </div>
          <div className="dt-settings-row">
            <span className="dt-settings-label">Text</span>
            <div className="dt-settings-controls">
              <button
                type="button"
                className={"dt-settings-btn" + (textScale === "small" ? " active" : "")}
                onClick={() => setTextScale("small")}
                title="Small text"
              >
                A−
              </button>
              <button
                type="button"
                className={"dt-settings-btn" + (textScale === "medium" ? " active" : "")}
                onClick={() => setTextScale("medium")}
                title="Default text size"
              >
                A
              </button>
              <button
                type="button"
                className={"dt-settings-btn" + (textScale === "large" ? " active" : "")}
                onClick={() => setTextScale("large")}
                title="Large text"
              >
                A+
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
