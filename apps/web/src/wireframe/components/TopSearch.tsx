// Coach-scoped jump-to search. Lives in the DTFrame topbar. Backed by
// GET /api/search?q= which returns three categories: students (people
// the coach has booked with), paths (their library paths), and lessons
// (path-node titles).
//
// Interactions:
//   - ⌘K / Ctrl+K from anywhere on the page focuses the input.
//   - Esc clears + blurs.
//   - Clicking a result navigates and closes the dropdown.
//   - Outside-click closes.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";

type StudentHit = { id: string; name: string; avatarUrl: string | null; lastLessonAt: string };
type PathHit    = { id: string; slug: string; title: string; sub: string | null; status: string };
type LessonHit  = { pathSlug: string; pathTitle: string; nodeId: string; title: string; titleB: string };

type SearchResults = {
  students: StudentHit[];
  paths: PathHit[];
  lessons: LessonHit[];
};

const EMPTY: SearchResults = { students: [], paths: [], lessons: [] };

export function TopSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ⌘K / Ctrl+K hotkey — focus the input from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Outside-click closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  // Debounced fetch on query change.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      apiFetch<{ data: SearchResults }>(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => setResults(r.data))
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(handle);
  }, [query]);

  const go = useCallback((to: string) => {
    navigate(to);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }, [navigate]);

  const total = results.students.length + results.paths.length + results.lessons.length;
  const showDropdown = open && (query.trim().length > 0 || loading);

  return (
    <div
      ref={containerRef}
      className="dt-search"
      style={{ position: "relative", padding: "2px 8px 2px 14px" }}
    >
      <span>⌕</span>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        placeholder="jump to student, path, lesson…"
        style={{
          flex: 1,
          minWidth: 0,
          border: 0,
          outline: 0,
          background: "transparent",
          font: "inherit",
          color: "var(--ink)",
          padding: "5px 6px",
        }}
      />
      <span className="kbd" style={{ marginLeft: "auto" }}>⌘K</span>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--paper)",
            border: "1.5px solid var(--ink)",
            borderRadius: 8,
            boxShadow: "3px 3px 0 rgba(0,0,0,0.12)",
            maxHeight: 420,
            overflowY: "auto",
            zIndex: 50,
            padding: 8,
            color: "var(--ink)",
          }}
        >
          {loading && (
            <div className="small muted" style={{ padding: "8px 6px" }}>searching…</div>
          )}
          {!loading && total === 0 && (
            <div className="small muted" style={{ padding: "8px 6px" }}>
              No matches for <b>{query.trim()}</b>.
            </div>
          )}

          {results.students.length > 0 && (
            <Section label="STUDENTS">
              {results.students.map((s) => (
                <ResultRow
                  key={s.id}
                  onClick={() => go(`/coach/student/${s.id}`)}
                  icon={<Avatar name={s.name} />}
                  title={s.name}
                  meta={`last lesson ${new Date(s.lastLessonAt).toLocaleDateString()}`}
                />
              ))}
            </Section>
          )}

          {results.paths.length > 0 && (
            <Section label="PATHS">
              {results.paths.map((p) => (
                <ResultRow
                  key={p.id}
                  onClick={() => go(`/coach/library/paths/${p.slug}`)}
                  icon={<span className="path-icon" style={{ width: 22, height: 22, fontSize: 14, lineHeight: "20px" }}>⤳</span>}
                  title={p.title}
                  meta={p.sub ?? p.status}
                />
              ))}
            </Section>
          )}

          {results.lessons.length > 0 && (
            <Section label="LESSONS">
              {results.lessons.map((l) => (
                <ResultRow
                  key={`${l.pathSlug}:${l.nodeId}`}
                  onClick={() => go(`/coach/library/paths/${l.pathSlug}/lessons/${l.nodeId}`)}
                  icon={<span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)" }}>¶</span>}
                  title={`${l.title} ${l.titleB}`.trim()}
                  meta={`in ${l.pathTitle}`}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        className="small muted"
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          padding: "4px 6px 2px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function ResultRow({
  onClick,
  icon,
  title,
  meta,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  meta?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        textAlign: "left",
        background: "transparent",
        border: 0,
        font: "inherit",
        color: "inherit",
        padding: "6px 8px",
        borderRadius: 4,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { (e.currentTarget.style.background = "var(--paper-2)"); }}
      onMouseLeave={(e) => { (e.currentTarget.style.background = "transparent"); }}
    >
      <span style={{ flex: "0 0 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        {icon}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
        {meta && (
          <span
            className="muted"
            style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {meta}
          </span>
        )}
      </span>
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      style={{
        width: 22, height: 22, borderRadius: "50%",
        border: "1.5px solid var(--ink)",
        background: "var(--paper-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--scrawl)", fontSize: 12, fontWeight: 700,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
