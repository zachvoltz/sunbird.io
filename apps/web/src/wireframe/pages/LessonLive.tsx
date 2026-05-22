import { Link } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Staff } from "../components/Staff";
import { MiniPiano } from "../components/MiniPiano";
import { OverlayChrome } from "../components/OverlayChrome";

export function LessonLivePage() {
  return (
    <DTFrame side="student" live>
      <div className="dt-main-body" style={{ position: "relative", padding: 0, height: "100%" }}>
        {/* ── FULL-BLEED VIDEO CALL ───────────────────────────────── */}
        <div
          style={{
            position: "absolute", inset: 0,
            background: `
              radial-gradient(ellipse at 65% 45%, rgba(232,93,77,0.10), transparent 60%),
              radial-gradient(ellipse at 25% 30%, rgba(255,225,104,0.18), transparent 55%),
              repeating-linear-gradient(-45deg, rgba(26,22,18,0.04) 0 6px, transparent 6px 12px),
              var(--paper-2)
            `,
          }}
        >
          {/* "Maya at piano" placeholder */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column",
          }}>
            <svg width="640" height="420" viewBox="0 0 640 420" style={{ position: "absolute", opacity: 0.15 }}>
              <rect x="100" y="60" width="440" height="280" rx="6" fill="none" stroke="var(--ink)" strokeWidth="3" strokeDasharray="6 4" />
              <rect x="120" y="80" width="400" height="180" rx="4" fill="none" stroke="var(--ink)" strokeWidth="2" />
              <rect x="100" y="280" width="440" height="40" fill="none" stroke="var(--ink)" strokeWidth="3" />
              {Array.from({ length: 22 }).map((_, i) => (
                <rect key={i} x={102 + i * 19.8} y={282} width="19" height="36" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
              ))}
              <ellipse cx="320" cy="160" rx="36" ry="44" fill="var(--ink-soft)" opacity="0.4" />
              <path d="M 260 250 Q 320 220 380 250 L 380 280 L 260 280 Z" fill="var(--ink-soft)" opacity="0.4" />
            </svg>

            <div style={{
              position: "relative",
              fontFamily: "var(--scrawl)", fontSize: 220, color: "var(--ink-soft)",
              opacity: 0.5, lineHeight: 1,
            }}>M</div>
            <div className="wf-scrawl muted" style={{ marginTop: 6, fontSize: 18 }}>
              Maya · at piano
            </div>
          </div>

          {/* video chrome corners */}
          <div style={{ position: "absolute", top: 70, left: 16 }}>
            <span className="chip" style={{
              background: "var(--accent)", color: "white", borderColor: "var(--accent)",
              fontWeight: 700,
            }}>● LIVE</span>
          </div>
          <div style={{ position: "absolute", top: 70, left: 90 }} className="row gap-2">
            <span className="chip tiny" style={{
              background: "rgba(26,22,18,0.85)", color: "var(--paper)", borderColor: "transparent",
            }}>
              <Avatar name="Maya" size={16} bg="var(--paper)" /> &nbsp;Maya R. · 18:42
            </span>
            <span className="chip tiny" style={{
              background: "rgba(251,248,241,0.85)", borderColor: "var(--ink-faint)",
            }}>
              <Icon name="metro" size={10} /> 88 bpm
            </span>
          </div>

          {/* K self-view PIP */}
          <div className="video-tile" style={{
            position: "absolute", bottom: 14, right: 24,
            width: 160, height: 96, opacity: 0.96, zIndex: 4,
          }}>
            <div className="face" style={{ fontSize: 44 }}>K</div>
            <div className="lbl">you</div>
          </div>
        </div>

        {/* Score overlay */}
        <OverlayChrome
          title="River Flows · score"
          right={<Tag color="coral">live · annotating</Tag>}
          style={{ top: 80, left: 24, width: 540, height: 360, zIndex: 3 }}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1.5px dashed var(--ink-faint)" }}>
            <div className="pill-row">
              <span className="p on">score</span>
              <span className="p">midi roll</span>
              <span className="p">whiteboard</span>
            </div>
          </div>
          <div className="panel-body scroll" style={{ padding: "10px 14px", flex: 1 }}>
            <div style={{ position: "relative" }}>
              <Staff width={500} bar={18}
                notes={[
                  { pitch: "C5", dur: "e", x: 0 }, { pitch: "D5", dur: "e", x: 0.5 },
                  { pitch: "E5", dur: "h", x: 1.2 }, { pitch: "D5", dur: "q", x: 2.5 },
                ]}
                highlight={[1.0, 1.8]} />
              <div className="score-pin coral" style={{ left: "40%", top: "-2px" }}>swell — yes!</div>
            </div>
            <div style={{ position: "relative", marginTop: -6 }}>
              <Staff width={500} bar={20}
                notes={[
                  { pitch: "A4", dur: "q", x: 0 }, { pitch: "G4", dur: "q", x: 1 },
                  { pitch: "F4", dur: "q", x: 2 }, { pitch: "E4", dur: "q", x: 3 },
                ]}
                highlight={[2.5, 3.6]} />
              <div className="score-pin" style={{ right: "6%", top: "-2px" }}>watch the count</div>
              <div style={{
                position: "absolute", left: "68%", top: 0, bottom: 6,
                borderLeft: "2px solid var(--accent)",
              }}>
                <div className="tiny" style={{
                  background: "var(--accent)", color: "white",
                  padding: "1px 5px", borderRadius: 4, transform: "translateX(-50%)",
                  position: "absolute", top: -14, whiteSpace: "nowrap",
                }}>Maya is here</div>
              </div>
            </div>

            <div className="row gap-2 mt-3 small muted" style={{ flexWrap: "wrap" }}>
              <span className="bold">Annotate:</span>
              <Tag color="coral">♥</Tag>
              <Tag>⚠</Tag>
              <Tag color="yellow">🎯</Tag>
              <Tag>fingering</Tag>
              <span className="grow" />
              <span className="kbd">⏎</span><span className="tiny">publish to Maya</span>
            </div>

            <div className="hr-hand" />

            <div className="row gap-3" style={{ justifyContent: "center" }}>
              <button className="btn icon"><Icon name="back" size={14} /></button>
              <button className="btn primary icon" style={{ width: 42, height: 42 }}>
                <Icon name="play" size={16} stroke="white" />
              </button>
              <button className="btn icon"><Icon name="chev" size={14} /></button>
              <span className="muted small">bar 20 / 24</span>
              <button className="btn small ghost" style={{ marginLeft: "auto" }}>loop bar 20</button>
            </div>
          </div>
        </OverlayChrome>

        {/* Agenda overlay */}
        <OverlayChrome
          title="Today's agenda"
          right={<span className="chip tiny">3 / 5</span>}
          style={{ top: 80, right: 24, width: 300, height: 180, zIndex: 3 }}
        >
          <div className="col gap-2" style={{ padding: "10px 12px" }}>
            <div className="row gap-2 small">
              <div className="checkbox done" style={{ width: 18, height: 18 }} />
              <span className="scribble-through grow">Warmup · scales</span>
              <span className="tiny muted">4m</span>
            </div>
            <div className="row gap-2 small">
              <div className="checkbox done" style={{ width: 18, height: 18 }} />
              <span className="scribble-through grow">Hanon № 4 · bar 12</span>
              <span className="tiny muted">7m</span>
            </div>
            <div
              className="row gap-2 small"
              style={{
                background: "var(--accent-soft)", padding: "4px 6px", borderRadius: 6,
                borderLeft: "3px solid var(--accent)",
              }}
            >
              <div className="checkbox" style={{ width: 18, height: 18 }} />
              <span className="bold grow">River Flows · bars 16-24</span>
              <span className="tiny">8m</span>
            </div>
            <div className="row gap-2 small muted">
              <div className="checkbox" style={{ width: 18, height: 18 }} />
              <span className="grow">New piece preview</span>
              <span className="tiny">5m</span>
            </div>
            <div className="row gap-2 small muted">
              <div className="checkbox" style={{ width: 18, height: 18 }} />
              <span className="grow">Wrap & week plan</span>
              <span className="tiny">5m</span>
            </div>
          </div>
        </OverlayChrome>

        {/* Live notes overlay */}
        <OverlayChrome
          title="Live notes"
          right={<Tag color="coral">⏺ rec</Tag>}
          style={{ top: 274, right: 24, width: 300, height: 220, zIndex: 3 }}
        >
          <div className="panel-body scroll col gap-2" style={{ padding: "10px 12px", flex: 1 }}>
            <div className="box small">
              <div className="row between tiny muted">
                <span>18:32 · bar 18</span>
                <Tag color="coral">♥</Tag>
              </div>
              <div className="small mt-1">Swell came through — much better than Wed take.</div>
            </div>
            <div className="box small">
              <div className="row between tiny muted">
                <span>18:39 · bar 20</span>
                <Tag color="yellow">try this</Tag>
              </div>
              <div className="small mt-1">Slow to 76 — really land on the E.</div>
            </div>
            <div className="box small dashed">
              <textarea
                placeholder="jot a note…"
                style={{
                  width: "100%", minHeight: 32, border: 0, background: "transparent",
                  fontFamily: "var(--hand)", resize: "none", fontSize: 13,
                }}
              />
              <div className="row gap-2">
                <button className="btn icon small" style={{
                  background: "var(--accent)", borderColor: "var(--accent)", color: "white",
                }}>⏺</button>
                <span className="tiny muted">voice · or type</span>
              </div>
            </div>
            <div className="tiny muted center">→ becomes Monday's note</div>
          </div>
        </OverlayChrome>

        {/* Header bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
          padding: "10px 18px",
          display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(180deg, rgba(251,248,241,0.92), rgba(251,248,241,0.4) 80%, transparent)",
        }}>
          <Avatar name="Maya" size={34} />
          <div>
            <div className="wf-scrawl bold" style={{ fontSize: 20, lineHeight: 1 }}>
              Lesson · Maya R.
            </div>
            <div className="tiny muted">11:18 left · ♥ working on bar 20</div>
          </div>

          <div className="grow" />

          <div className="col gap-1" style={{ alignItems: "flex-end" }}>
            <div className="row gap-1" style={{
              padding: 3, border: "1.5px solid var(--ink)", borderRadius: 999,
              background: "rgba(251,248,241,0.92)",
            }}>
              <span className="muted tiny" style={{ padding: "0 8px", alignSelf: "center" }}>panels</span>
              <button className="btn small" style={{ padding: "3px 10px" }}>✓ score</button>
              <button className="btn small" style={{ padding: "3px 10px" }}>✓ agenda</button>
              <button className="btn small" style={{ padding: "3px 10px" }}>✓ notes</button>
              <button className="btn small ghost" style={{ padding: "3px 10px" }}>midi roll</button>
              <button className="btn small ghost" style={{ padding: "3px 10px" }}>whiteboard</button>
            </div>
            <div className="row gap-1" style={{
              padding: 3, border: "1.5px solid var(--ink)", borderRadius: 999,
              background: "rgba(251,248,241,0.92)",
            }}>
              <span className="muted tiny" style={{ padding: "0 8px", alignSelf: "center" }}>tools</span>
              <button className="btn small" style={{ padding: "3px 10px" }}>✓ midi kbd</button>
              <button className="btn small" style={{ padding: "3px 10px" }}>✓ tuner</button>
              <button className="btn small" style={{ padding: "3px 10px" }}>✓ metronome</button>
              <button className="btn small ghost" style={{ padding: "3px 10px" }}>voice range</button>
              <button className="btn small ghost" style={{ padding: "3px 10px" }}>drone</button>
            </div>
          </div>

          <div className="row gap-2">
            <button className="btn small ghost">🎙 mute</button>
            <button className="btn small ghost">⊟ share</button>
            <Link to="/coach" className="btn small" style={{
              background: "var(--accent)", color: "white", borderColor: "var(--accent)",
            }}>end lesson</Link>
          </div>
        </div>

        {/* MIDI keyboard */}
        <OverlayChrome
          title="MIDI keyboard"
          right={
            <span className="chip tiny" style={{ background: "var(--paper-2)" }}>
              <span style={{ color: "#3a8" }}>●</span>&nbsp;Casio PX-870
            </span>
          }
          style={{ bottom: 14, left: 24, width: 360, height: 110, zIndex: 3 }}
        >
          <div style={{ padding: "6px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ height: 42 }}><MiniPiano lit={["E4", "G4", "C5"]} held={["A4"]} /></div>
            <div className="row gap-1 tiny" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <span className="muted">last:</span>
              <Tag>E4</Tag><Tag>G4</Tag><Tag>C5</Tag>
              <Tag color="coral">A4 ← now</Tag>
              <span className="muted" style={{ marginLeft: "auto" }}>vel 78</span>
            </div>
          </div>
        </OverlayChrome>

        {/* Tuner */}
        <OverlayChrome
          title="Tuner"
          right={
            <span className="chip tiny" style={{
              background: "var(--accent-soft)", color: "var(--accent)",
              borderColor: "var(--accent)", padding: "0 6px",
            }}>± in tune</span>
          }
          style={{ bottom: 14, left: 396, width: 184, height: 110, zIndex: 3 }}
        >
          <div style={{
            padding: "4px 10px 6px", display: "flex",
            flexDirection: "column", alignItems: "center", flex: 1,
          }}>
            <div className="row gap-2" style={{ alignItems: "baseline" }}>
              <div className="wf-scrawl bold" style={{ fontSize: 28, lineHeight: 1 }}>A4</div>
              <div className="tiny muted">+2¢ · 440.2Hz</div>
            </div>
            <svg width="160" height="42" viewBox="0 0 160 42" style={{ marginTop: 2 }}>
              <path d="M 8 36 Q 80 6 152 36" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
              {[-40, -20, 0, 20, 40].map((c) => {
                const x = 80 + c * 1.7;
                const y = 36 - 30 * (1 - (x - 80) * (x - 80) / (72 * 72));
                return <line key={c} x1={x} y1={y - 2} x2={x} y2={y + 2} stroke="var(--ink-faint)" strokeWidth="1" />;
              })}
              <line x1="80" y1="36" x2="84" y2="10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="80" cy="36" r="3" fill="var(--ink)" />
              <text x="6" y="40" fontSize="9" fill="var(--ink-faint)">≤50¢</text>
              <text x="138" y="40" fontSize="9" fill="var(--ink-faint)">+50¢</text>
            </svg>
          </div>
        </OverlayChrome>

        {/* Metronome */}
        <OverlayChrome
          title="Metronome"
          right={<span className="chip tiny">4/4</span>}
          style={{ bottom: 14, left: 592, width: 184, height: 110, zIndex: 3 }}
        >
          <div style={{ padding: "4px 12px 6px", flex: 1 }}>
            <div className="row gap-2" style={{ alignItems: "center", justifyContent: "center" }}>
              <button className="btn icon small" style={{ width: 24, height: 24, padding: 0 }}>−</button>
              <div style={{ textAlign: "center" }}>
                <div className="wf-scrawl bold" style={{ fontSize: 26, lineHeight: 1 }}>88</div>
                <div className="tiny muted">bpm</div>
              </div>
              <button className="btn icon small" style={{ width: 24, height: 24, padding: 0 }}>+</button>
            </div>
            <div className="row gap-1 mt-1" style={{ justifyContent: "center" }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{
                  width: 12, height: 12, borderRadius: "50%",
                  border: "1.5px solid var(--ink)",
                  background: n === 2 ? "var(--accent)" : "var(--paper)",
                }} />
              ))}
              <button className="btn small" style={{
                marginLeft: 8, padding: "1px 8px", fontSize: 11,
                background: "var(--accent)", color: "white", borderColor: "var(--accent)",
              }}>■</button>
            </div>
          </div>
        </OverlayChrome>

        {/* hide-all hint */}
        <div style={{
          position: "absolute", bottom: 130, left: 0, right: 0, zIndex: 5,
          display: "flex", justifyContent: "center", pointerEvents: "none",
        }}>
          <span className="postit small wf-scrawl" style={{
            transform: "rotate(-1deg)", fontSize: 12, pointerEvents: "auto",
            padding: "2px 8px",
          }}>
            <span className="kbd">space</span> &nbsp;hide all (full video)
          </span>
        </div>
      </div>
    </DTFrame>
  );
}
