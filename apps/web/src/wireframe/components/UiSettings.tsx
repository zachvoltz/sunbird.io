import { useUiPrefs } from "@/context/UiPrefsContext";

export function UiSettings({ collapsed }: { collapsed: boolean }) {
  const { theme, textScale, setTheme, setTextScale } = useUiPrefs();

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
      <div className="sec-label">UI</div>
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
    </div>
  );
}
