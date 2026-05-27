import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Staff } from "../components/Staff";
import { LibItem } from "../components/LibItem";
import { useIsMobile } from "../hooks/useIsMobile";
import { PathsBrowsePane, PathsMobile, PATHS } from "./Paths";

type LibTab = "exercises" | "paths";

function useLibTab(): [LibTab, (t: LibTab) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("tab");
  const initial: LibTab = fromUrl === "paths" ? "paths" : "exercises";
  const [tab, setTab] = useState<LibTab>(initial);
  const update = (t: LibTab) => {
    setTab(t);
    const next = new URLSearchParams(params);
    if (t === "paths") next.set("tab", "paths");
    else next.delete("tab");
    setParams(next, { replace: true });
  };
  return [tab, update];
}

// Pill toggle reused in both the filter rail's VIEW section and the
// middle-column header so the active subview is unambiguous.
function TabPills({ tab, onChange }: { tab: LibTab; onChange: (t: LibTab) => void }) {
  return (
    <div className="pill-row" style={{ marginBottom: 0 }}>
      <span
        className={"p" + (tab === "exercises" ? " on" : "")}
        onClick={() => onChange("exercises")}
        style={{ cursor: "pointer" }}
      >
        items · 42
      </span>
      <span
        className={"p" + (tab === "paths" ? " on" : "")}
        onClick={() => onChange("paths")}
        style={{ cursor: "pointer" }}
      >
        paths · {PATHS.length}
      </span>
      <span className="p muted" style={{ opacity: 0.6 }}>tags</span>
      <span className="p muted" style={{ opacity: 0.6 }}>shared</span>
    </div>
  );
}

function ExercisesFilterRail() {
  return (
    <>
      <div className="small muted mb-2">TYPE</div>
      <div className="col gap-1 small">
        <div className="row gap-2"><div className="checkbox done" style={{ width: 16, height: 16 }} /> all <span className="muted" style={{ marginLeft: "auto" }}>42</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 16, height: 16 }} /> warmups <span className="muted" style={{ marginLeft: "auto" }}>12</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 16, height: 16 }} /> exercises <span className="muted" style={{ marginLeft: "auto" }}>22</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 16, height: 16 }} /> songs <span className="muted" style={{ marginLeft: "auto" }}>8</span></div>
      </div>

      <div className="small muted mt-3 mb-2">FOR</div>
      <div className="col gap-1 small">
        <div>♪ beginner · 14</div>
        <div>♪ intermediate · 20</div>
        <div>♪ advanced · 8</div>
      </div>

      <div className="small muted mt-3 mb-2">TAGS</div>
      <div className="row gap-1" style={{ flexWrap: "wrap" }}>
        <Tag>scales</Tag><Tag>finger ind.</Tag><Tag color="coral">phrasing</Tag>
        <Tag>sight-read</Tag><Tag>dynamics</Tag><Tag>technique</Tag>
        <Tag color="yellow">recital</Tag>
      </div>

      <div className="hr-hand" />
      <div className="small muted mb-1">SHARED WITH YOU</div>
      <div className="small">· M. Ortega · 6</div>
      <div className="small">· Suzuki packet · 11</div>
    </>
  );
}

function PathsFilterRail() {
  return (
    <>
      <div className="small muted mb-2">STATUS</div>
      <div className="col gap-1 small">
        <div className="row gap-2"><div className="checkbox done" style={{ width: 14, height: 14 }} /> all</div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 14, height: 14 }} /> published <span className="muted" style={{ marginLeft: "auto" }}>4</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 14, height: 14 }} /> draft <span className="muted" style={{ marginLeft: "auto" }}>2</span></div>
      </div>

      <div className="small muted mt-3 mb-2">FOR</div>
      <div className="col gap-1 small">
        <div>♪ piano · 4</div>
        <div>♪ voice · 1</div>
        <div>♪ any · 1</div>
      </div>

      <div className="hr-hand" />
      <div className="small muted mb-1">TEMPLATES</div>
      <div className="small">· Suzuki bk 1</div>
      <div className="small">· Bastien primer</div>
      <div className="small">· Voice · sing speech</div>
    </>
  );
}

function ExercisesPane() {
  return (
    <>
      {/* item grid */}
      <div className="panel" style={{ padding: "10px 14px" }}>
        <div className="row between mb-2">
          <div className="row gap-2">
            <div className="dt-search" style={{ flex: "0 0 220px", padding: "4px 12px" }}>
              <span>⌕</span><span>search library…</span>
            </div>
            <div className="pill-row">
              <span className="p on">recent</span>
              <span className="p">A–Z</span>
              <span className="p">most-used</span>
            </div>
          </div>
          <span className="tiny muted">42 items</span>
        </div>

        <div className="panel-body scroll">
          <div className="small muted mb-2">WARMUPS</div>
          <LibItem icon="metro" title="C major scale · 2 octaves" sub="warmup · 80 bpm · 5 min · MIDI" tags={["scales", "used 18×"]} />
          <LibItem icon="metro" title="Hanon № 1 · slow" sub="warmup · 60 bpm · MIDI" tags={["finger ind."]} />
          <LibItem icon="metro" title="Breathing · 4-7-8" sub="warmup · 3 min · no MIDI" tags={["voice"]} />

          <div className="small muted mt-3 mb-2">EXERCISES</div>
          <div className="box small mb-2" style={{
            transform: "rotate(-1deg) translateY(-1px)",
            boxShadow: "3px 3px 0 rgba(0,0,0,0.15)",
            borderColor: "var(--accent)",
          }}>
            <div className="row gap-3">
              <span className="drag-handle">⋮⋮</span>
              <Icon name="note" size={16} />
              <div className="grow">
                <div className="bold">Hanon № 4 — bar 12 loop</div>
                <div className="tiny muted">exercise · 60→88 bpm · MIDI · sheet preview</div>
              </div>
              <Tag color="coral">dragging…</Tag>
            </div>
            <div style={{ marginTop: 6, position: "relative" }}>
              <Staff width={420} bar={12}
                notes={[
                  { pitch: "E4", dur: "e", x: 0 }, { pitch: "G4", dur: "e", x: 0.5 },
                  { pitch: "B4", dur: "e", x: 1.0 }, { pitch: "C5", dur: "e", x: 1.5 },
                  { pitch: "D5", dur: "e", x: 2.0 }, { pitch: "E5", dur: "e", x: 2.5 },
                  { pitch: "D5", dur: "e", x: 3.0 }, { pitch: "C5", dur: "e", x: 3.5 },
                ]} />
            </div>
          </div>
          <LibItem icon="note" title="Czerny op.299 № 1 — bars 1-8" sub="exercise · 76 bpm · MIDI" tags={["technique"]} />
          <LibItem icon="note" title="Octave jumps · F major" sub="exercise · 60 bpm · MIDI" tags={["stretch"]} />
          <LibItem icon="note" title="Phrasing drill — long-line" sub="exercise · 5 min · note only" tags={["phrasing"]} />

          <div className="small muted mt-3 mb-2">SONGS &amp; PIECES</div>
          <LibItem icon="mic" title="River Flows in You — Yiruma" sub="song · full · MIDI + PDF" tags={["recital"]} />
          <LibItem icon="mic" title="Twinkle var. — Suzuki bk 1" sub="song · beginner · MIDI" tags={["beginner"]} />
        </div>
      </div>

      {/* assign-to rail */}
      <div className="panel tinted">
        <div className="panel-head">
          <div className="panel-title">Assign to…</div>
        </div>
        <div className="panel-body scroll col gap-2">
          <div className="small muted">QUICK · drag here</div>
          <div className="dropzone">
            <div style={{ fontSize: 18, marginBottom: 4 }}>drop on a student's week ↓</div>
            <div className="small muted" style={{ fontFamily: "var(--hand)" }}>or pick from list</div>
          </div>

          {[
            { n: "Maya R.", when: "this week", drop: true },
            { n: "Theo P.", when: "this week" },
            { n: "Lina S.", when: "next week" },
            { n: "Jonas K.", when: "this week" },
            { n: "Sam W.", when: "next week" },
            { n: "Ana B.", when: "next week" },
          ].map((s) => (
            <div
              key={s.n}
              className={"box small row gap-2" + (s.drop ? " accent" : "")}
              style={{ borderWidth: s.drop ? 2 : 1.5, position: "relative" }}
            >
              <Avatar name={s.n} size={26} />
              <div className="grow">
                <div className="bold small">{s.n}</div>
                <div className="tiny muted">{s.when}</div>
              </div>
              {s.drop && <span className="chip tiny accent">drop ↓</span>}
            </div>
          ))}

          <div className="hr-hand" />
          <button className="btn small ghost">＋ multi-select students</button>
        </div>
      </div>
    </>
  );
}

function LibraryDesktop() {
  const [tab, setTab] = useLibTab();
  const isPaths = tab === "paths";

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Library</h2>
          <div className="dt-sub">
            {isPaths
              ? "your collection — items + paths · drag onto a student's week"
              : "42 items · your collection · drag onto a student's week →"}
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost">import MIDI / PDF</button>
          {isPaths ? (
            <button className="btn small primary">＋ new path</button>
          ) : (
            <Link to="/coach/midi/capture" className="btn small primary">＋ record new</Link>
          )}
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "180px 1fr 320px", height: "100%", gap: 14 }}>
          {/* filter rail — VIEW pill toggle on top, then context-specific filters */}
          <div className="panel" style={{ padding: "12px 10px" }}>
            <div className="small muted mb-2">VIEW</div>
            <div className="col gap-1 small mb-2">
              <div
                className={"row gap-2"}
                style={{
                  cursor: "pointer",
                  padding: "1px 2px",
                  borderRadius: 3,
                  background: tab === "exercises" ? "var(--highlight)" : undefined,
                }}
                onClick={() => setTab("exercises")}
              >
                <span style={{ width: 14 }}>{tab === "exercises" ? "▸" : "·"}</span>
                <b style={{ fontWeight: tab === "exercises" ? 700 : 500 }}>items</b>
                <span className="muted" style={{ marginLeft: "auto" }}>42</span>
              </div>
              <div
                className="row gap-2"
                style={{
                  cursor: "pointer",
                  padding: "1px 2px",
                  borderRadius: 3,
                  background: tab === "paths" ? "var(--highlight)" : undefined,
                }}
                onClick={() => setTab("paths")}
              >
                <span style={{ width: 14 }}>{tab === "paths" ? "▸" : "·"}</span>
                <b style={{ fontWeight: tab === "paths" ? 700 : 500 }}>paths</b>
                <span className="muted" style={{ marginLeft: "auto" }}>{PATHS.length}</span>
              </div>
            </div>

            {isPaths ? <PathsFilterRail /> : <ExercisesFilterRail />}
          </div>

          {isPaths ? (
            <PathsBrowsePane activeFilters={<TabPills tab={tab} onChange={setTab} />} />
          ) : (
            <ExercisesPane />
          )}
        </div>
      </div>
    </DTFrame>
  );
}

function LibraryMobile() {
  const [tab, setTab] = useLibTab();

  if (tab === "paths") return <PathsMobile />;

  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Library</h2>
          <div className="wf-subtitle">42 items</div>
        </div>
        <button className="btn icon ghost"><Icon name="plus" size={14} /></button>
      </div>
      <div className="wf-body col gap-2 scroll-y">
        <div className="dt-search" style={{ padding: "4px 12px" }}>
          <span>⌕</span><span>search…</span>
        </div>
        <div className="seg">
          <div className="s on" onClick={() => setTab("exercises")}>items</div>
          <div className="s" onClick={() => setTab("paths")}>paths</div>
          <div className="s">shared</div>
        </div>

        <LibItem icon="metro" title="C major scale · 2 oct" sub="warmup · 80 bpm" tags={["18×"]} />
        <LibItem icon="note" title="Hanon № 4 · bar 12 loop" sub="exercise · 60→88" tags={["coral"]} />
        <LibItem icon="note" title="Czerny op.299 · 1-8" sub="exercise · 76 bpm" tags={["technique"]} />
        <LibItem icon="metro" title="Hanon № 1 · slow" sub="warmup · 60 bpm" tags={[]} />
        <LibItem icon="mic" title="River Flows in You" sub="song · MIDI + PDF" tags={["recital"]} />
        <LibItem icon="note" title="Phrasing drill" sub="exercise · 5 min" tags={["phrasing"]} />

        <div className="postit small wf-scrawl" style={{ transform: "rotate(0.4deg)" }}>
          Tap any item to assign · long-press to multi-select
        </div>
      </div>
    </WFFrame>
  );
}

export function LibraryPage() {
  const isMobile = useIsMobile();
  return isMobile ? <LibraryMobile /> : <LibraryDesktop />;
}
