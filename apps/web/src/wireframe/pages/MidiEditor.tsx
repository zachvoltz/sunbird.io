import { Link, useParams, NavLink } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Staff, type StaffNoteSpec } from "../components/Staff";
import { MiniPiano } from "../components/MiniPiano";

type Mode = "capture" | "clean" | "edit";

const HanonNotes = (off = 0): StaffNoteSpec[] => [
  { pitch: "C4", dur: "e", x: off + 0.0 },
  { pitch: "E4", dur: "e", x: off + 0.45 },
  { pitch: "F4", dur: "e", x: off + 0.9 },
  { pitch: "G4", dur: "e", x: off + 1.35 },
  { pitch: "A4", dur: "e", x: off + 1.8 },
  { pitch: "G4", dur: "e", x: off + 2.25 },
  { pitch: "F4", dur: "e", x: off + 2.7 },
  { pitch: "E4", dur: "e", x: off + 3.15 },
];

function KbConnectedChip({ connected = true, lastNote = "C4" }: { connected?: boolean; lastNote?: string }) {
  return (
    <span className="chip tiny" style={{
      background: connected ? "var(--paper-2)" : "var(--paper)",
      borderColor: connected ? "var(--ink)" : "var(--ink-faint)",
    }}>
      <span style={{ color: connected ? "#3a8" : "var(--ink-faint)" }}>●</span>
      &nbsp;{connected ? "Casio PX-870" : "no keyboard"}
      {connected && <span className="muted">&nbsp;· last: {lastNote}</span>}
    </span>
  );
}

function AssignRail() {
  return (
    <div className="panel tinted">
      <div className="panel-head">
        <div className="panel-title">Save &amp; assign</div>
      </div>
      <div className="panel-body scroll col gap-3">
        <div>
          <div className="small muted">NAME</div>
          <div className="box small" style={{ padding: "6px 10px" }}>
            <span className="bold">Hanon № 4 · bar 12 loop</span>
          </div>
        </div>
        <div>
          <div className="small muted">TYPE</div>
          <div className="pill-row" style={{ display: "flex" }}>
            <span className="p">warmup</span>
            <span className="p on">exercise</span>
            <span className="p">song</span>
          </div>
        </div>
        <div>
          <div className="small muted">TEMPO &amp; LOOP</div>
          <div className="row gap-2 small">
            <span className="chip">♩ 60 → 88</span>
            <span className="chip">loop · bar 12</span>
            <span className="chip">count-in 1</span>
          </div>
        </div>
        <div>
          <div className="small muted">
            TEACHER NOTES <span className="muted">· shows on student's score</span>
          </div>
          <textarea
            className="box small"
            style={{
              width: "100%", minHeight: 60, border: "1.5px dashed var(--ink)",
              background: "var(--paper)", fontFamily: "var(--hand)", resize: "none",
            }}
            defaultValue="Slow this WAY down — really lift 3 & 4 on the repeats. Hands separate first."
          />
        </div>
        <div>
          <div className="small muted">ASSIGN TO</div>
          <div className="col gap-1 mt-1">
            {[
              { n: "Maya R.", on: true },
              { n: "Theo P.", on: false },
              { n: "Lina S.", on: true },
              { n: "Jonas K.", on: false },
            ].map((s) => (
              <div key={s.n} className="row gap-2 small">
                <div className={"checkbox" + (s.on ? " done" : "")} style={{ width: 18, height: 18 }} />
                <Avatar name={s.n} size={22} />
                <span>{s.n}</span>
              </div>
            ))}
            <button className="btn small ghost">＋ pick more</button>
          </div>
        </div>
        <div className="hr-hand" />
        <button className="btn primary">save to library &amp; assign · 2</button>
        <button className="btn small ghost">just save</button>
      </div>
    </div>
  );
}

function ModeSwitch({ mode }: { mode: Mode }) {
  const cls = (m: Mode) => ({ to: `/coach/midi/${m}`, className: "p" + (m === mode ? " on" : " muted") });
  return (
    <div className="pill-row">
      <NavLink {...cls("capture")} style={{ textDecoration: "none", color: "inherit" }}>capture</NavLink>
      <NavLink {...cls("clean")} style={{ textDecoration: "none", color: "inherit" }}>clean</NavLink>
      <NavLink {...cls("edit")} style={{ textDecoration: "none", color: "inherit" }}>edit</NavLink>
    </div>
  );
}

function MidiCapture() {
  return (
    <div className="dt-cols score-heavy" style={{ height: "100%" }}>
      <div className="panel">
        <div className="panel-head">
          <div className="row gap-3">
            <div className="panel-title">New exercise</div>
            <KbConnectedChip lastNote="A4" />
          </div>
          <div className="row gap-2">
            <span className="muted small">mode:</span>
            <ModeSwitch mode="capture" />
          </div>
        </div>
        <div className="panel-body scroll">
          <div className="box dashed" style={{ padding: "16px 18px" }}>
            <div className="row gap-3" style={{ alignItems: "center", justifyContent: "center" }}>
              <button className="btn icon" style={{
                width: 64, height: 64, background: "var(--accent)",
                borderColor: "var(--accent)", color: "white",
              }}>
                <Icon name="record" size={20} stroke="white" />
              </button>
              <div>
                <div className="wf-scrawl big bold" style={{ fontSize: 24, lineHeight: 1 }}>Hit a key to start</div>
                <div className="small muted">
                  or press <span className="kbd">space</span> · count-in: 1 bar · 60 bpm
                </div>
              </div>
            </div>
          </div>

          <div className="small muted mt-3">LIVE PREVIEW · sheet music</div>
          <div className="box" style={{ marginTop: 6, padding: "14px 12px", position: "relative" }}>
            <Staff width={680} bar={1} notes={HanonNotes(0)} />
            <Staff width={680} bar={2}
              notes={[
                { pitch: "D4", dur: "e", x: 0.0 },
                { pitch: "F4", dur: "e", x: 0.45 },
                { pitch: "G4", dur: "e", x: 0.9 },
                { pitch: "A4", dur: "e", x: 1.35 },
                { pitch: "B4", dur: "e", x: 1.8 },
              ]} />
            <div className="postit wf-scrawl small" style={{
              position: "absolute", right: 14, top: 8, transform: "rotate(2deg)", fontSize: 14,
            }}>
              notation builds as you play ♪
            </div>
          </div>

          <div className="small muted mt-3">YOUR HANDS</div>
          <div className="box" style={{ padding: "10px 14px" }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>treble · right hand</div>
            <MiniPiano lit={["E4", "F4", "G4", "A4"]} held={["A4"]} />
            <div className="row gap-2 mt-2 small">
              <Tag>velocity 78</Tag>
              <Tag>1 voice</Tag>
              <span className="muted">·</span>
              <Tag color="yellow">recording bar 2 / 2</Tag>
              <span className="muted tiny" style={{ marginLeft: "auto" }}>0:08 · ♩ 60</span>
            </div>
          </div>

          <div className="row gap-2 mt-3">
            <button className="btn small">undo last note</button>
            <button className="btn small">clear</button>
            <button className="btn small ghost"><Icon name="metro" size={11} /> click on</button>
            <span className="grow" />
            <button className="btn small">＋ left hand pass</button>
            <Link to="/coach/midi/clean" className="btn primary small">done · clean →</Link>
          </div>

          <div className="postit small wf-scrawl mt-3" style={{ transform: "rotate(-0.4deg)" }}>
            Tip — in <span className="bold">capture</span> mode the staff just renders what you played.
            Switch to <span className="bold">clean</span> to fix the rhythm.
          </div>
        </div>
      </div>
      <AssignRail />
    </div>
  );
}

function MidiClean() {
  return (
    <div className="dt-cols score-heavy" style={{ height: "100%" }}>
      <div className="panel">
        <div className="panel-head">
          <div className="row gap-3">
            <div className="panel-title">Clean up</div>
            <KbConnectedChip />
            <Tag>captured · 2 bars</Tag>
          </div>
          <div className="row gap-2">
            <span className="muted small">mode:</span>
            <ModeSwitch mode="clean" />
          </div>
        </div>
        <div className="panel-body scroll">
          <div className="small muted">RAW · as played</div>
          <div className="box small mt-1" style={{ padding: "10px 12px", position: "relative", opacity: 0.85 }}>
            <Staff width={680} bar={1}
              notes={[
                { pitch: "C4", dur: "e", x: 0.04 }, { pitch: "E4", dur: "e", x: 0.43 },
                { pitch: "F4", dur: "e", x: 0.91 }, { pitch: "G4", dur: "e", x: 1.39 },
                { pitch: "A4", dur: "e", x: 1.78 }, { pitch: "G4", dur: "e", x: 2.31 },
                { pitch: "F4", dur: "e", x: 2.68 }, { pitch: "E4", dur: "e", x: 3.16 },
              ]} />
            <div className="postit small wf-scrawl" style={{
              position: "absolute", right: 10, top: 6, fontSize: 12, padding: "2px 6px",
            }}>slight wobble in beat 3</div>
          </div>

          <div className="small muted mt-3">
            CLEANED <span className="muted">· quantize ⅛ · grid lock</span>
          </div>
          <div className="box mt-1" style={{ padding: "12px 12px", position: "relative", borderWidth: 2 }}>
            <Staff width={680} bar={1} notes={HanonNotes(0)} highlight={[2.0, 3.4]} />
            <Staff width={680} bar={2}
              notes={[
                { pitch: "D4", dur: "e", x: 0 }, { pitch: "F4", dur: "e", x: 0.45 },
                { pitch: "G4", dur: "e", x: 0.9 }, { pitch: "A4", dur: "e", x: 1.35 },
                { pitch: "B4", dur: "q", x: 2.0 }, { pitch: "C5", dur: "h", x: 3.0 },
              ]} />
            <div style={{
              position: "absolute", left: "6%", right: "4%", bottom: -12,
              borderTop: "2px solid var(--accent)", borderLeft: "2px solid var(--accent)",
              borderRight: "2px solid var(--accent)", height: 8,
            }} />
            <div style={{
              position: "absolute", left: "50%", bottom: -26, transform: "translateX(-50%)",
              fontFamily: "var(--scrawl)", color: "var(--accent)", fontSize: 14,
            }}>loop · bars 1-2</div>
          </div>

          <div className="row gap-3 mt-4" style={{ flexWrap: "wrap" }}>
            <div className="box small" style={{ flex: "1 1 200px" }}>
              <div className="small muted">QUANTIZE</div>
              <div className="row gap-2 mt-1">
                <Tag>off</Tag><Tag>¼</Tag><Tag color="coral">⅛</Tag><Tag>1/16</Tag><Tag>swing</Tag>
              </div>
            </div>
            <div className="box small" style={{ flex: "1 1 200px" }}>
              <div className="small muted">TEMPO</div>
              <div className="row gap-2 mt-1">
                <button className="btn small icon">−</button>
                <span className="bold">♩ 60</span>
                <button className="btn small icon">＋</button>
                <span className="muted small">→ student ramp 60 → 88</span>
              </div>
            </div>
            <div className="box small" style={{ flex: "1 1 200px" }}>
              <div className="small muted">TRIM &amp; LOOP</div>
              <div className="row gap-2 mt-1">
                <Tag>start ▸ bar 1.1</Tag>
                <Tag>end ▸ bar 2.4</Tag>
                <Tag color="coral">loop on</Tag>
              </div>
            </div>
          </div>

          <div className="row gap-2 mt-3">
            <button className="btn small">↶ undo</button>
            <button className="btn small"><Icon name="play" size={11} /> preview</button>
            <button className="btn small ghost">re-record</button>
            <span className="grow" />
            <Link to="/coach/midi/edit" className="btn primary small">looks good · edit notes →</Link>
          </div>
        </div>
      </div>
      <AssignRail />
    </div>
  );
}

function MidiEdit() {
  return (
    <div className="dt-cols score-heavy" style={{ height: "100%" }}>
      <div className="panel">
        <div className="panel-head">
          <div className="row gap-3">
            <div className="panel-title">Edit notes</div>
            <KbConnectedChip lastNote="step input" />
            <Tag>2 bars · 12 notes</Tag>
          </div>
          <div className="row gap-2">
            <span className="muted small">mode:</span>
            <ModeSwitch mode="edit" />
          </div>
        </div>
        <div className="panel-body scroll">
          <div className="row gap-2 mb-2" style={{ flexWrap: "wrap" }}>
            <span className="small muted">tool:</span>
            <div className="pill-row">
              <span className="p on">✋ select</span>
              <span className="p">✎ draw</span>
              <span className="p">✂ slice</span>
              <span className="p">⌫ erase</span>
            </div>
            <span className="small muted" style={{ marginLeft: 10 }}>note value:</span>
            <div className="pill-row">
              <span className="p">𝅗𝅥</span>
              <span className="p">♩</span>
              <span className="p on">♪</span>
              <span className="p">♬</span>
            </div>
            <span className="small muted" style={{ marginLeft: 10 }}>accidental:</span>
            <div className="pill-row">
              <span className="p">♯</span><span className="p on">♮</span><span className="p">♭</span>
            </div>
            <span className="grow" />
            <span className="muted small">step input · play a key to add ↓</span>
          </div>

          <div className="box" style={{ padding: "14px 12px", position: "relative" }}>
            <Staff width={680} bar={1} notes={HanonNotes(0)} highlight={[1.5, 2.2]} />
            <div style={{
              position: "absolute", left: "24%", top: 38,
              width: 18, height: 18, border: "1.5px dashed var(--accent)", borderRadius: "50%",
            }} />
            <div className="score-pin coral" style={{ left: "22%", top: 60, fontSize: 11, padding: "1px 5px" }}>
              E4 · ♪ · vel 78
            </div>
            <Staff width={680} bar={2}
              notes={[
                { pitch: "D4", dur: "e", x: 0 }, { pitch: "F4", dur: "e", x: 0.45 },
                { pitch: "G4", dur: "e", x: 0.9 }, { pitch: "A4", dur: "e", x: 1.35 },
                { pitch: "B4", dur: "q", x: 2.0 }, { pitch: "C5", dur: "h", x: 3.0 },
              ]} />
          </div>

          <div className="row gap-3 mt-3">
            <div className="box small grow" style={{ flex: "1 1 50%" }}>
              <div className="small muted">SELECTED · E4</div>
              <div className="row gap-3 mt-1">
                <div className="col gap-1">
                  <div className="tiny muted">pitch</div>
                  <div className="row gap-1">
                    <button className="btn icon small">−</button>
                    <span className="bold">E4</span>
                    <button className="btn icon small">＋</button>
                  </div>
                </div>
                <div className="col gap-1">
                  <div className="tiny muted">duration</div>
                  <div className="pill-row">
                    <span className="p">𝅗𝅥</span><span className="p">♩</span><span className="p on">♪</span>
                  </div>
                </div>
                <div className="col gap-1">
                  <div className="tiny muted">velocity</div>
                  <div className="row gap-1" style={{ alignItems: "center" }}>
                    <div style={{
                      width: 80, height: 6, border: "1.5px solid var(--ink)", borderRadius: 3,
                      background: "var(--paper)", position: "relative",
                    }}>
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0, width: "60%",
                        background: "var(--accent)",
                      }} />
                    </div>
                    <span className="small bold">78</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="box small" style={{ flex: "1 1 50%" }}>
              <div className="small muted">STEP INPUT · play a key</div>
              <div style={{ marginTop: 6 }}>
                <MiniPiano lit={["E4"]} held={[]} />
              </div>
              <div className="row gap-2 mt-2 tiny muted">
                <span><span className="kbd">⌫</span> delete</span>
                <span><span className="kbd">←→</span> nudge</span>
                <span><span className="kbd">↑↓</span> pitch</span>
                <span><span className="kbd">D</span> duration</span>
              </div>
            </div>
          </div>

          <div className="row gap-2 mt-3">
            <button className="btn small ghost">＋ fingering on selection</button>
            <button className="btn small ghost">＋ dynamic (p / f)</button>
            <button className="btn small ghost">＋ slur</button>
            <span className="grow" />
            <button className="btn small"><Icon name="play" size={11} /> play from here</button>
            <button className="btn small">A/B vs raw</button>
          </div>
        </div>
      </div>
      <AssignRail />
    </div>
  );
}

export function MidiEditorPage() {
  const params = useParams<{ mode?: string }>();
  const mode: Mode = params.mode === "clean" ? "clean" : params.mode === "edit" ? "edit" : "capture";

  const titles: Record<Mode, string> = {
    capture: "Record an exercise",
    clean: "Clean it up",
    edit: "Edit note by note",
  };
  const subs: Record<Mode, string> = {
    capture: "play the keyboard — notation builds itself.",
    clean: "quantize, trim, set loop points & target tempo.",
    edit: "drag notes on the staff, or use step input from the keyboard.",
  };

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div className="row gap-3">
          <Link to="/coach/roster" className="btn icon ghost"><Icon name="back" size={14} /></Link>
          <div>
            <h2 className="dt-title" style={{ fontSize: 28 }}>{titles[mode]}</h2>
            <div className="dt-sub">
              Hanon № 4 · bar 12 loop · for Maya &amp; Lina
              <span className="muted"> · </span>
              {subs[mode]}
            </div>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost">discard</button>
          <button className="btn small">save draft</button>
        </div>
      </div>
      <div className="dt-main-body">
        {mode === "capture" && <MidiCapture />}
        {mode === "clean" && <MidiClean />}
        {mode === "edit" && <MidiEdit />}
      </div>
    </DTFrame>
  );
}
