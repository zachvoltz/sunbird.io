import { Link } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { WaveBars, waveHeights } from "../components/WaveBars";
import { Staff } from "../components/Staff";
import { useIsMobile } from "../hooks/useIsMobile";

function TakeReviewDesktop() {
  const heights = waveHeights(7, 80);
  return (
    <DTFrame side="inbox">
      <div className="dt-main-head">
        <div className="row gap-3">
          <Link to="/coach" className="btn icon ghost"><Icon name="back" size={14} /></Link>
          <Avatar name="Maya" size={40} />
          <div>
            <h2 className="dt-title" style={{ fontSize: 26 }}>Maya · River Flows in You</h2>
            <div className="dt-sub">take 3 of 3 · bars 16-24 · 0:48 · sent Wed 5:18 PM</div>
          </div>
        </div>
        <div className="row gap-2">
          <Tag>★★★★☆ self</Tag>
          <span className="chip tiny">"feels pretty good!"</span>
          <button className="btn small ghost">prev take</button>
          <button className="btn small ghost">next →</button>
        </div>
      </div>

      <div className="dt-main-body" style={{ paddingBottom: 14 }}>
        <div className="dt-cols score-heavy" style={{ height: "100%" }}>
          <div className="panel" style={{ padding: "12px 14px" }}>
            <div className="panel-head">
              <div className="row gap-3 small">
                <span className="bold">Score · River Flows in You</span>
                <span className="muted">bars 16-24 · A minor</span>
              </div>
              <div className="pill-row">
                <span className="p on">student's take</span>
                <span className="p">reference</span>
                <span className="p">A/B</span>
              </div>
            </div>

            <div className="panel-body scroll">
              <div style={{ position: "relative", marginTop: 8 }}>
                <Staff width={680} bar={16}
                  notes={[
                    { pitch: "A4", dur: "q", x: 0 }, { pitch: "C5", dur: "q", x: 1 },
                    { pitch: "E5", dur: "q", x: 2 }, { pitch: "D5", dur: "q", x: 3 },
                  ]} />
                <div className="score-pin" style={{ left: "38%", top: "-6px" }}>♥ phrasing 16-17</div>
              </div>
              <div style={{ position: "relative", marginTop: -6 }}>
                <Staff width={680} bar={18}
                  notes={[
                    { pitch: "C5", dur: "e", x: 0 }, { pitch: "D5", dur: "e", x: 0.5 },
                    { pitch: "E5", dur: "h", x: 1.2 }, { pitch: "D5", dur: "q", x: 2.5 },
                  ]}
                  highlight={[1.0, 1.8]} />
                <div className="score-pin coral" style={{ left: "42%", top: "-6px" }}>swell here ← yes!</div>
              </div>
              <div style={{ position: "relative", marginTop: -6 }}>
                <Staff width={680} bar={20}
                  notes={[
                    { pitch: "A4", dur: "q", x: 0 }, { pitch: "G4", dur: "q", x: 1 },
                    { pitch: "F4", dur: "q", x: 2 }, { pitch: "E4", dur: "q", x: 3 },
                  ]}
                  highlight={[2.5, 3.6]} />
                <div className="score-pin" style={{ right: "6%", top: "-6px" }}>⚠ ending rushes</div>
              </div>
              <div style={{ position: "relative", marginTop: -6 }}>
                <Staff width={680} bar={22}
                  notes={[
                    { pitch: "D4", dur: "h", x: 0 }, { pitch: "E4", dur: "h", x: 2 },
                  ]} />
              </div>

              <div className="row gap-2 mt-2 small muted">
                <span className="bold">Annotate:</span>
                <Tag color="coral">♥ love</Tag>
                <Tag>⚠ watch out</Tag>
                <Tag color="yellow">🎯 try this</Tag>
                <span className="muted">· click a note to pin</span>
                <span className="muted" style={{ marginLeft: "auto" }}>2 annotations</span>
              </div>

              <div className="hr-hand" />

              <div className="small muted mb-2">TAKE PLAYBACK · 0:48</div>
              <div style={{ position: "relative", padding: "30px 0 4px" }}>
                <div className="wave-pin" style={{ left: "22%" }}><span>♥</span></div>
                <div className="wave-pin yellow" style={{ left: "55%" }}><span>!</span></div>
                <div className="wave-pin" style={{ left: "83%" }}><span>2</span></div>
                <WaveBars heights={heights} played={0.34} />
                <div style={{ position: "absolute", top: 30, left: "34%", bottom: 0, borderLeft: "2px solid var(--accent)" }}>
                  <div className="tiny" style={{
                    background: "var(--accent)", color: "white",
                    padding: "1px 5px", borderRadius: 4, transform: "translateX(-50%)",
                    position: "absolute", top: -14,
                  }}>0:14</div>
                </div>
              </div>

              <div className="row gap-3 mt-2" style={{ justifyContent: "center" }}>
                <button className="btn icon"><Icon name="back" size={14} /></button>
                <button className="btn primary icon" style={{ width: 46, height: 46 }}>
                  <Icon name="play" size={18} stroke="white" />
                </button>
                <button className="btn icon"><Icon name="chev" size={14} /></button>
                <span className="muted small">88 bpm · 0.5× 0.75× <span className="bold">1×</span></span>
                <span className="muted small" style={{ marginLeft: "auto" }}>+ pin at playhead</span>
                <button className="btn small accent">＋ drop pin</button>
              </div>
            </div>
          </div>

          <div className="panel tinted">
            <div className="panel-head">
              <div className="panel-title">Notes for Maya</div>
              <div className="pill-row">
                <span className="p on">type</span>
                <span className="p">voice</span>
                <span className="p">handwrite</span>
              </div>
            </div>
            <div className="panel-body scroll col gap-3">
              <div className="box accent" style={{ borderWidth: 2, position: "relative" }}>
                <div className="row between">
                  <div className="row gap-2 small">
                    <Tag color="coral">♥ pin · bar 18</Tag>
                  </div>
                  <span className="tiny muted">just now</span>
                </div>
                <div className="small mt-2">
                  The swell here was beautiful — exactly what I asked for. The dynamic
                  arc up to E5 is now sounding intentional.
                </div>
                <div className="row gap-2 mt-2">
                  <button className="btn small ghost">✎</button>
                  <button className="btn small ghost">+ voice clip</button>
                </div>
              </div>

              <div className="box">
                <div className="row between">
                  <div className="row gap-2 small">
                    <Tag>⚠ pin · bar 20</Tag>
                    <Tag color="yellow">timeline · 0:34</Tag>
                  </div>
                  <span className="tiny muted">2m ago</span>
                </div>
                <div className="small mt-2">
                  Ending still rushes a touch. Try landing on the E quarter — count "and-1"
                  instead of "and."
                </div>
                <div className="row gap-2 mt-1" style={{ alignItems: "center" }}>
                  <div className="row gap-1" style={{ height: 18, alignItems: "flex-end" }}>
                    {[3, 5, 4, 7, 8, 5, 3, 6, 4, 5, 3].map((h, i) => (
                      <div key={i} style={{ width: 2, height: h * 2, background: "var(--ink)" }} />
                    ))}
                  </div>
                  <span className="tiny muted">0:08 voice clip</span>
                  <Icon name="play" size={12} />
                </div>
              </div>

              <div className="box" style={{ position: "relative" }}>
                <div className="row between">
                  <div className="row gap-2 small">
                    <Tag color="yellow">🎯 timeline · 0:42</Tag>
                  </div>
                  <span className="tiny muted">draft</span>
                </div>
                <textarea
                  style={{ width: "100%", minHeight: 50, border: 0, background: "transparent", fontFamily: "var(--hand)", resize: "none", marginTop: 4 }}
                  defaultValue="Try the final cadence with the soft pedal — see if it lifts." />
              </div>

              <div className="box dashed">
                <div className="small muted mb-1">＋ new comment</div>
                <textarea placeholder="type, or hit ⏺ to record a quick voice memo…"
                  style={{ width: "100%", minHeight: 36, border: 0, background: "transparent", fontFamily: "var(--hand)", resize: "none" }} />
                <div className="row gap-2">
                  <button className="btn icon small" style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "white" }}>⏺</button>
                  <span className="tiny muted">hold to record · max 30s</span>
                  <button className="btn small primary" style={{ marginLeft: "auto" }}>add</button>
                </div>
              </div>

              <div className="hr-hand" />

              <div className="small muted">SUMMARY · sends with the note</div>
              <div className="row gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Icon key={n} name="star" size={20} stroke={n <= 4 ? "var(--accent)" : "var(--ink-faint)"} />
                ))}
                <span className="small muted" style={{ marginLeft: 6 }}>"really lovely take overall"</span>
              </div>

              <div className="row gap-2 mt-1">
                <button className="btn small grow">save draft</button>
                <button className="btn small accent grow">
                  <Icon name="send" size={11} stroke="white" /> send 3 notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function TakeReviewMobile() {
  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <Link to="/coach" className="btn icon ghost"><Icon name="back" size={14} /></Link>
        <div className="center small">
          <div className="bold">Maya · take 3</div>
          <div className="tiny muted">River Flows · 0:48</div>
        </div>
        <Avatar name="Maya" size={32} />
      </div>
      <div className="wf-body col gap-3 scroll-y">
        <div className="seg">
          <div className="s on">score</div>
          <div className="s">timeline</div>
          <div className="s">all notes · 2</div>
        </div>

        <div className="box" style={{ position: "relative", padding: "10px 10px" }}>
          <Staff width={320} bar={18}
            notes={[
              { pitch: "C5", dur: "e", x: 0 }, { pitch: "D5", dur: "e", x: 0.5 },
              { pitch: "E5", dur: "h", x: 1.2 }, { pitch: "D5", dur: "q", x: 2.5 },
            ]}
            highlight={[1.0, 1.8]} />
          <div className="score-pin coral" style={{ left: "38%", top: "-2px", fontSize: 11 }}>♥ swell yes</div>
        </div>
        <div className="box" style={{ position: "relative", padding: "10px 10px" }}>
          <Staff width={320} bar={20}
            notes={[
              { pitch: "A4", dur: "q", x: 0 }, { pitch: "G4", dur: "q", x: 1 },
              { pitch: "F4", dur: "q", x: 2 }, { pitch: "E4", dur: "q", x: 3 },
            ]}
            highlight={[2.5, 3.6]} />
          <div className="score-pin" style={{ right: "8%", top: "-2px", fontSize: 11 }}>⚠ rushes</div>
        </div>

        <div className="box small">
          <div style={{ position: "relative", padding: "22px 0 4px" }}>
            <div className="wave-pin" style={{ left: "22%", width: 18, height: 18, top: -18 }}><span style={{ fontSize: 9 }}>♥</span></div>
            <div className="wave-pin yellow" style={{ left: "55%", width: 18, height: 18, top: -18 }}><span style={{ fontSize: 9 }}>!</span></div>
            <WaveBars heights={waveHeights(7, 40)} played={0.34} />
          </div>
          <div className="row gap-2 mt-1" style={{ justifyContent: "center" }}>
            <button className="btn icon"><Icon name="back" size={12} /></button>
            <button className="btn accent icon"><Icon name="play" size={14} stroke="white" /></button>
            <button className="btn icon"><Icon name="chev" size={12} /></button>
          </div>
        </div>

        <div className="box accent" style={{ borderWidth: 2 }}>
          <div className="row gap-2 small"><Tag color="coral">♥ bar 18</Tag></div>
          <div className="small mt-1">Swell here was beautiful — exactly what I asked for.</div>
        </div>

        <div className="box">
          <div className="row gap-2 small"><Tag>⚠ bar 20</Tag><Tag color="yellow">0:34</Tag></div>
          <div className="small mt-1">Ending rushes — try landing on the E.</div>
          <div className="row gap-1 mt-1" style={{ alignItems: "flex-end", height: 14 }}>
            {[3, 5, 4, 7, 8, 5, 3, 6, 4, 5, 3].map((h, i) => (
              <div key={i} style={{ width: 2, height: h * 1.6, background: "var(--ink)" }} />
            ))}
            <span className="tiny muted" style={{ marginLeft: 6 }}>0:08 voice</span>
          </div>
        </div>

        <div className="box dashed">
          <textarea placeholder="add a comment…"
            style={{ width: "100%", minHeight: 32, border: 0, background: "transparent", fontFamily: "var(--hand)", resize: "none" }} />
          <div className="row gap-2">
            <button className="btn icon small accent">⏺</button>
            <button className="btn small primary" style={{ marginLeft: "auto" }}>send →</button>
          </div>
        </div>
      </div>
    </WFFrame>
  );
}

export function TakeReviewPage() {
  const isMobile = useIsMobile();
  return isMobile ? <TakeReviewMobile /> : <TakeReviewDesktop />;
}
