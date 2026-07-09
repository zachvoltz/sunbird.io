import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChordDifficulty,
  ChordLibraryDetailPublic,
  ChordLibraryListPublic,
  ChordLibraryVoicingPublic,
} from "@sunbird/shared";
import { chordsApi } from "@/lib/api";
import { Icon } from "../components/Icon";
import { ChordChart } from "../components/ChordChart";
import { HearItButton } from "../components/HearItButton";

const ROOTS = ["All", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const TYPES = ["All", "maj", "min", "7", "maj7", "m7", "sus", "dim"];

const DIFF: Record<ChordDifficulty, { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "#4a9c6d" },
  intermediate: { label: "Intermediate", color: "var(--accent)" },
  advanced: { label: "Advanced", color: "#9b5bd6" },
};

function rootDisplay(r: string): string {
  return r.replace("#", "♯").replace("b", "♭");
}

// ── recently-viewed chords (localStorage) ──
type Recent = { id: string; name: string };
const RECENTS_KEY = "chordLibraryRecents";
function loadRecents(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(r: Recent) {
  try {
    const cur = loadRecents().filter((x) => x.id !== r.id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([r, ...cur].slice(0, 6)));
  } catch {
    /* ignore */
  }
}

type View =
  | { name: "browse" }
  | { name: "detail"; chordId: string }
  | { name: "voicing"; chordId: string; voicingId: string };

// Embeddable library flow (browse → detail → variation). Rendered inside the
// Chord Flash Cards page; `onExit` returns to the flashcards deck picker.
export function ChordLibraryView({ onExit }: { onExit: () => void }) {
  const [view, setView] = useState<View>({ name: "browse" });

  return (
    <>
      {view.name === "browse" && (
        <Browse onOpen={(chordId) => setView({ name: "detail", chordId })} onExit={onExit} />
      )}
      {view.name === "detail" && (
        <ChordDetail
          chordId={view.chordId}
          onBack={() => setView({ name: "browse" })}
          onOpenVoicing={(voicingId) => setView({ name: "voicing", chordId: view.chordId, voicingId })}
        />
      )}
      {view.name === "voicing" && (
        <VoicingDetail
          chordId={view.chordId}
          voicingId={view.voicingId}
          onBack={() => setView({ name: "detail", chordId: view.chordId })}
        />
      )}
    </>
  );
}

// ── screen 1 · browse + search ───────────────────────────
function Browse({ onOpen, onExit }: { onOpen: (chordId: string) => void; onExit: () => void }) {
  const [q, setQ] = useState("");
  const [root, setRoot] = useState("C");
  const [type, setType] = useState("All");
  const [data, setData] = useState<ChordLibraryListPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [recents, setRecents] = useState<Recent[]>(() => loadRecents());

  // Debounced fetch on any filter change.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      chordsApi
        .library({ q, root, type })
        .then((d) => alive && setData(d))
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, root, type]);

  const open = (id: string, name: string) => {
    pushRecent({ id, name });
    setRecents(loadRecents());
    onOpen(id);
  };

  const showRecents = q.trim() === "" && recents.length > 0;

  return (
    <>
      <div className="wf-header">
        <button className="btn icon" aria-label="Back to flashcards" onClick={onExit}>‹</button>
        <h2 className="wf-title" style={{ fontSize: 24, flex: 1 }}>Chord Library</h2>
        <span style={{ width: 38 }} />
      </div>

      {/* search */}
      <div style={{ padding: "0 18px 10px", flex: "none" }}>
        <div
          className="row"
          style={{ gap: 10, height: 46, border: "2px solid var(--ink-faint)", borderRadius: 14, padding: "0 12px", background: "var(--paper-2)" }}
        >
          <Icon name="note" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chords — e.g. Cmaj7, F♯m"
            style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontFamily: "var(--hand)", fontSize: 16, color: "var(--ink)" }}
          />
          {q && (
            <button className="btn icon small" style={{ border: 0, background: "transparent" }} onClick={() => setQ("")} aria-label="Clear">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* filters */}
      <div style={{ flex: "none" }}>
        <ChipRow options={ROOTS} value={root} onPick={setRoot} display={rootDisplay} />
        <ChipRow options={TYPES} value={type} onPick={setType} accent />
      </div>

      <div className="wf-body" style={{ overflowY: "auto", padding: "6px 0 24px" }}>
        {showRecents && (
          <div style={{ padding: "6px 18px 10px" }}>
            <div className="tiny muted" style={{ fontWeight: 800, letterSpacing: 0.6, marginBottom: 8 }}>RECENT</div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {recents.map((r) => (
                <button key={r.id} className="chip" style={{ cursor: "pointer" }} onClick={() => onOpen(r.id)}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="small muted" style={{ padding: 18 }}>Loading…</div>
        ) : !data || data.total === 0 ? (
          <div className="box dashed small muted" style={{ margin: 18 }}>
            No chords match{q ? ` "${q}"` : ""}.
          </div>
        ) : (
          <>
            {q.trim() !== "" && (
              <div className="small muted" style={{ padding: "4px 18px 6px", fontWeight: 600 }}>
                {data.total} result{data.total === 1 ? "" : "s"}{q ? ` for "${q}"` : ""}
              </div>
            )}
            {data.groups.map((g) => (
              <div key={g.root}>
                <div
                  className="tiny"
                  style={{ position: "sticky", top: 0, background: "var(--paper)", zIndex: 1, fontWeight: 800, letterSpacing: 0.6, color: "var(--ink-soft)", padding: "8px 18px 6px" }}
                >
                  {rootDisplay(g.root)}
                </div>
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => open(it.id, it.name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "8px 18px",
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: 0,
                      borderBottom: "1.4px solid var(--ink-faint)",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{ flex: "none", width: 46, height: 56, border: "1.5px solid var(--ink-faint)", borderRadius: 8, background: "var(--paper-2)", display: "grid", placeItems: "center", overflow: "hidden" }}
                    >
                      <div style={{ transform: "scale(0.62)" }}>
                        <ChordChart shape={it.shape} size="sm" />
                      </div>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 18, letterSpacing: -0.3 }}>{it.name}</b>
                      <span className="tiny muted" style={{ display: "block", marginTop: 1 }}>{it.qualityLabel}</span>
                    </span>
                    <span className="chip accent" style={{ fontSize: 11 }}>{it.shapeCount} shapes</span>
                    <Icon name="chev" size={18} />
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function ChipRow({
  options,
  value,
  onPick,
  display,
  accent,
}: {
  options: string[];
  value: string;
  onPick: (v: string) => void;
  display?: (v: string) => string;
  accent?: boolean;
}) {
  return (
    <div className="row hide-scroll" style={{ gap: 7, overflowX: "auto", padding: "0 18px 8px" }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            onClick={() => onPick(o)}
            style={{
              flex: "none",
              height: 32,
              padding: "0 13px",
              borderRadius: 999,
              border: "1.6px solid " + (on ? (accent ? "var(--accent)" : "var(--ink)") : "var(--ink-faint)"),
              background: on ? (accent ? "var(--accent)" : "var(--ink)") : "var(--paper)",
              color: on ? "white" : "var(--ink-soft)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "var(--hand)",
            }}
          >
            {display ? display(o) : o}
          </button>
        );
      })}
    </div>
  );
}

// ── screen 3 · chord detail (all fingerings) ─────────────
function ChordDetail({
  chordId,
  onBack,
  onOpenVoicing,
}: {
  chordId: string;
  onBack: () => void;
  onOpenVoicing: (voicingId: string) => void;
}) {
  const [data, setData] = useState<ChordLibraryDetailPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    chordsApi
      .libraryChord(chordId)
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [chordId]);

  const recommended = data?.voicings.find((v) => v.recommended) ?? data?.voicings[0];

  return (
    <>
      <div className="wf-header">
        <button className="btn icon" aria-label="Back" onClick={onBack}>‹</button>
        <div className="small bold muted" style={{ flex: 1, textAlign: "center" }}>Library</div>
        <span style={{ width: 38 }} />
      </div>

      {loading && !data ? (
        <div className="small muted" style={{ padding: 18 }}>Loading…</div>
      ) : !data ? (
        <div className="small muted" style={{ padding: 18 }}>Couldn't load this chord.</div>
      ) : (
        <div className="wf-body" style={{ overflowY: "auto", padding: "0 18px 24px" }}>
          <div style={{ textAlign: "center", marginTop: 4 }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>{data.name}</div>
            <div className="small muted" style={{ marginTop: 4 }}>{data.fullName} · {data.notes.join(" ")}</div>
          </div>

          <div className="row" style={{ gap: 10, margin: "16px auto 6px", maxWidth: 460 }}>
            {recommended && (
              <HearItButton fingering={recommended.shape.fingering} className="btn grow" style={{ height: 46, fontSize: 14 }} />
            )}
            <AddToPractice chordId={data.id} className="btn accent grow" style={{ height: 46, fontSize: 14 }} />
          </div>

          <div className="row between" style={{ margin: "14px 2px 8px" }}>
            <b style={{ fontSize: 15 }}>Fingerings ({data.voicings.length})</b>
            <span className="tiny" style={{ color: "var(--accent)", fontFamily: "var(--scrawl)", fontSize: 15 }}>tap a shape ↓</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 11 }}>
            {data.voicings.map((v) => (
              <button
                key={v.id}
                onClick={() => onOpenVoicing(v.id)}
                className="box"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "10px 8px 9px",
                  cursor: "pointer",
                  border: v.recommended ? "2px solid var(--accent)" : undefined,
                  background: v.recommended ? "var(--accent-soft)" : undefined,
                }}
              >
                <ChordChart shape={v.shape} size="sm" />
                <span className="small bold" style={{ marginTop: 6, textAlign: "center", lineHeight: 1.2 }}>{v.label}</span>
                <span className="tiny muted" style={{ marginTop: 2 }}>{v.position}</span>
                {v.recommended && <span className="chip accent" style={{ marginTop: 6, fontSize: 10 }}>★ easiest</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── screen 4 · variation detail ──────────────────────────
function VoicingDetail({
  chordId,
  voicingId,
  onBack,
}: {
  chordId: string;
  voicingId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<ChordLibraryDetailPublic | null>(null);

  useEffect(() => {
    let alive = true;
    chordsApi
      .libraryChord(chordId)
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [chordId]);

  const v: ChordLibraryVoicingPublic | undefined =
    data?.voicings.find((x) => x.id === voicingId) ?? data?.voicings[0];

  return (
    <>
      <div className="wf-header">
        <button className="btn icon" aria-label="Back" onClick={onBack}>‹</button>
        <div className="small bold" style={{ flex: 1, textAlign: "center" }}>{data?.name ?? "Chord"}</div>
        <span style={{ width: 38 }} />
      </div>

      {!v ? (
        <div className="small muted" style={{ padding: 18 }}>Loading…</div>
      ) : (
        <div className="wf-body" style={{ overflowY: "auto", padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ width: "100%", maxWidth: 460, margin: "0 auto", padding: "0 18px 20px" }}>
            <div style={{ textAlign: "center", marginTop: 2 }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{v.label}</div>
              <div className="small muted" style={{ marginTop: 3 }}>{data?.name} · {v.position}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px" }}>
              <ChordChart shape={v.shape} size="lg" />
            </div>

            <div className="col" style={{ gap: 0 }}>
              <MetaRow k="Position" v={v.position} />
              <MetaRow k="Fingers" v={v.fingersLabel} />
              <MetaRow k="Root" v={v.rootString} />
              <MetaRow k="Difficulty" v={
                <span className="row" style={{ gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: DIFF[v.difficulty].color, display: "inline-block" }} />
                  {DIFF[v.difficulty].label}
                </span>
              } />
              <MetaRow k="Notes" v={v.notes.join(" · ")} last />
            </div>

            <div style={{ marginTop: 14 }}>
              <HearItButton fingering={v.shape.fingering} label="🔊 Hear this voicing" className="hear-pill" style={{ height: 44, padding: "0 16px", borderRadius: 999, border: "2px solid var(--ink)", background: "var(--paper)", fontWeight: 700, fontSize: 14 }} />
            </div>
          </div>

          <div style={{ flex: "none", marginTop: "auto", padding: 16, borderTop: "1.5px dashed var(--ink-faint)" }}>
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              <AddToPractice chordId={chordId} className="btn accent big" style={{ width: "100%" }} label="＋ Add to practice deck" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetaRow({ k, v, last }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div className="row" style={{ gap: 12, padding: "12px 2px", borderBottom: last ? "none" : "1.4px solid var(--ink-faint)", fontSize: 14 }}>
      <span className="muted" style={{ width: 96, flex: "none", fontWeight: 600 }}>{k}</span>
      <span className="bold">{v}</span>
    </div>
  );
}

// Add-to-practice button with a transient "Added" confirmation.
function AddToPractice({
  chordId,
  className,
  style,
  label = "＋ Add to practice",
}: {
  chordId: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const add = () => {
    if (state === "adding") return;
    setState("adding");
    chordsApi
      .addToPractice(chordId)
      .then(() => {
        setState("added");
        timer.current = setTimeout(() => setState("idle"), 2200);
      })
      .catch(() => setState("idle"));
  };

  return (
    <button className={className} style={style} onClick={add} disabled={state === "adding"}>
      {state === "added" ? "✓ Added to practice" : state === "adding" ? "Adding…" : label}
    </button>
  );
}
