import { Link } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { VoiceRangePiano } from "../components/VoiceRangePiano";
import { useIsMobile } from "../hooks/useIsMobile";

function VoiceRangeDesktop() {
  return (
    <DTFrame side="student">
      <div className="dt-main-head">
        <div className="row gap-3">
          <Link to="/coach/roster" className="btn icon ghost"><Icon name="back" size={14} /></Link>
          <Avatar name="Ana" size={48} />
          <div>
            <h2 className="dt-title" style={{ fontSize: 30 }}>Ana B. · voice profile</h2>
            <div className="dt-sub">
              17 · mezzo-soprano · <span className="hi">+1 semitone this week</span>
              <span className="muted"> · last assessed Apr 12</span>
            </div>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost">history</button>
          <button className="btn small ghost">print profile</button>
          <button className="btn small primary">＋ run range test</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "1.4fr 1fr", height: "100%" }}>
          {/* LEFT — visualization */}
          <div className="panel">
            <div className="panel-head">
              <div className="row gap-3">
                <div className="panel-title">Range · today</div>
                <div className="pill-row">
                  <span className="p on">edit</span>
                  <span className="p">view only</span>
                </div>
              </div>
              <div className="row gap-2 small muted">
                <span>drag a range edge · or tap a key on Ana's keyboard</span>
              </div>
            </div>
            <div className="panel-body scroll">
              <div className="box" style={{ padding: "10px 8px" }}>
                <VoiceRangePiano />
                <div className="row gap-3 mt-2 small muted" style={{ flexWrap: "wrap" }}>
                  <span>
                    <span className="chip tiny" style={{
                      background: "var(--accent)", color: "white", borderColor: "var(--accent)",
                      width: 14, padding: "0 4px",
                    }}>●</span> chest
                  </span>
                  <span>
                    <span className="chip tiny" style={{
                      background: "var(--highlight)", padding: "0 4px",
                    }}>●</span> mix
                  </span>
                  <span>
                    <span className="chip tiny" style={{
                      background: "var(--paper)", borderColor: "var(--accent)",
                      color: "var(--accent)", padding: "0 4px",
                    }}>///</span> head (breathy / hatched = lighter)
                  </span>
                  <span className="muted">·</span>
                  <span>▼ today's low · ▲ today's high · ★ new high</span>
                </div>
              </div>

              {/* range detail cards */}
              <div className="row gap-2 mt-3">
                <div className="box small grow" style={{ borderColor: "var(--accent)" }}>
                  <div className="row between">
                    <span className="wf-scrawl bold" style={{ fontSize: 18 }}>Chest</span>
                    <Tag color="coral">F3 → E4</Tag>
                  </div>
                  <div className="tiny muted mt-1">comfortable · forward placement</div>
                  <div className="tiny mt-1">
                    Working on: lifting the soft palate as we approach E4.
                  </div>
                </div>
                <div className="box small grow" style={{ borderColor: "var(--ink)", background: "#fffceb" }}>
                  <div className="row between">
                    <span className="wf-scrawl bold" style={{ fontSize: 18 }}>Mix</span>
                    <Tag color="yellow">A3 → G5</Tag>
                  </div>
                  <div className="tiny muted mt-1">wide · 2 passaggi to manage</div>
                  <div className="tiny mt-1">
                    Working on: blend at 1° passaggio (E4) — less weight.
                  </div>
                </div>
                <div className="box small grow">
                  <div className="row between">
                    <span className="wf-scrawl bold" style={{ fontSize: 18 }}>Head</span>
                    <Tag>D5 → A5 ★</Tag>
                  </div>
                  <div className="tiny muted mt-1">expanding · gained A5 this week</div>
                  <div className="tiny mt-1">
                    Working on: opening vowel at G5 + above.
                  </div>
                </div>
              </div>

              <div className="row between mt-3 mb-2">
                <div className="small muted">EXERCISES TARGETING THIS RANGE</div>
                <Link to="/coach/library" className="btn small ghost">＋ assign from library</Link>
              </div>
              <div className="box small row gap-2 mb-2">
                <Icon name="metro" size={14} />
                <div className="grow">
                  <div className="bold">5-tone sirens · D4 ↔ A5</div>
                  <div className="tiny muted">warmup · crosses 2° passaggio · 4 min</div>
                </div>
                <Tag color="coral">today</Tag>
              </div>
              <div className="box small row gap-2 mb-2">
                <Icon name="note" size={14} />
                <div className="grow">
                  <div className="bold">"Ng" slide on E4</div>
                  <div className="tiny muted">exercise · blend at 1° passaggio</div>
                </div>
                <Tag>2× this week</Tag>
              </div>
            </div>
          </div>

          {/* RIGHT — session + history */}
          <div className="col gap-3" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div className="panel tinted" style={{ flex: "0 0 auto" }}>
              <div className="panel-head">
                <div className="panel-title">Today's session</div>
                <span className="chip tiny accent">★ new high</span>
              </div>
              <div className="col gap-2">
                <div className="row gap-2 small">
                  <Tag color="coral">A5 ★</Tag>
                  <span className="muted">reached for the first time · vowel "ee"</span>
                </div>
                <div className="row gap-2 small">
                  <Tag>G3</Tag>
                  <span className="muted">lowest today · sounded thin · push down later</span>
                </div>
                <div className="row gap-2 small">
                  <Tag color="yellow">E4-F4</Tag>
                  <span className="muted">passaggio still a little heavy</span>
                </div>
                <textarea
                  className="box small"
                  style={{
                    width: "100%", minHeight: 50, marginTop: 6,
                    border: "1.5px dashed var(--ink)", background: "var(--paper)",
                    fontFamily: "var(--hand)", resize: "none",
                  }}
                  defaultValue={`Ana — A5 sat surprisingly easy on "ee". Try same on "ah" next session.`}
                />
              </div>
            </div>

            <div className="panel" style={{ flex: "1 1 auto", minHeight: 0 }}>
              <div className="panel-head">
                <div className="panel-title">History</div>
                <div className="pill-row">
                  <span className="p on">8 wks</span>
                  <span className="p">6 mo</span>
                  <span className="p">all time</span>
                </div>
              </div>
              <div className="panel-body scroll">
                <svg viewBox="0 0 360 140" width="100%" height="160">
                  <line x1="40" y1="10" x2="40" y2="120" stroke="var(--ink)" strokeWidth="1" />
                  <line x1="40" y1="120" x2="360" y2="120" stroke="var(--ink)" strokeWidth="1" />
                  <text x="10" y="14" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--hand)">A5</text>
                  <text x="10" y="46" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--hand)">D5</text>
                  <text x="10" y="78" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--hand)">G4</text>
                  <text x="10" y="110" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--hand)">C4</text>
                  <text x="10" y="124" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--hand)">F3</text>

                  <polyline fill="none" stroke="var(--accent)" strokeWidth="2"
                    points="60,60 100,55 140,50 180,45 220,42 260,35 300,28 340,12" />
                  <polyline fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 3"
                    points="60,108 100,108 140,106 180,104 220,108 260,106 300,108 340,108" />

                  {[60, 100, 140, 180, 220, 260, 300, 340].map((x, i) => (
                    <g key={i}>
                      <circle cx={x} cy={[60, 55, 50, 45, 42, 35, 28, 12][i]} r="3" fill="var(--accent)" />
                      <circle cx={x} cy={[108, 108, 106, 104, 108, 106, 108, 108][i]} r="3" fill="var(--ink)" />
                    </g>
                  ))}

                  <text x="320" y="8" fontSize="10" fill="var(--accent)" fontFamily="var(--scrawl)" fontWeight="700">A5 ★</text>
                  <text x="46" y="138" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--hand)">Feb</text>
                  <text x="320" y="138" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--hand)">Apr</text>
                </svg>

                <div className="row gap-2 mt-2 small">
                  <span className="chip tiny" style={{
                    background: "var(--accent)", color: "white", borderColor: "var(--accent)",
                  }}>●</span>
                  <span>high (top of head voice)</span>
                  <span className="chip tiny" style={{ marginLeft: 8 }}>—</span>
                  <span>low (bottom of chest)</span>
                </div>

                <div className="hr-hand" />

                <div className="small muted">MILESTONES</div>
                <div className="col gap-1 mt-1 small">
                  <div className="row gap-2"><Tag color="coral">apr 19</Tag> hit A5 for the first time</div>
                  <div className="row gap-2"><Tag>apr 5</Tag> consistent G5 across vowels</div>
                  <div className="row gap-2"><Tag>mar 22</Tag> 1° passaggio blending</div>
                  <div className="row gap-2"><Tag>feb 11</Tag> baseline assessment</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function VoiceRangeMobile() {
  return (
    <WFFrame navActive="practice">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Your voice</h2>
          <div className="wf-subtitle">today's range · tap a note to update</div>
        </div>
        <div className="wf-avatar">A</div>
      </div>
      <div className="wf-body col gap-3 scroll-y">
        <div className="seg">
          <div className="s on">today</div>
          <div className="s">test ↗</div>
          <div className="s">history</div>
        </div>

        <div className="box" style={{ padding: "6px 0" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ width: 680 }}>
              <VoiceRangePiano height={180} />
            </div>
          </div>
          <div className="tiny muted center mt-1">← scroll to see full range →</div>
        </div>

        <div className="box thick" style={{ position: "relative", borderColor: "var(--accent)" }}>
          <div className="corner">new!</div>
          <div className="row gap-2">
            <div className="wf-scrawl" style={{ fontSize: 36, lineHeight: 1, color: "var(--accent)" }}>A5</div>
            <div>
              <div className="bold">first time at A5 ✨</div>
              <div className="tiny muted">vowel "ee" · with Mr. K · 11:02</div>
            </div>
          </div>
          <div className="postit small wf-scrawl mt-2" style={{ fontSize: 14, transform: "rotate(-0.5deg)" }}>
            "A5 sat surprisingly easy. Try same on 'ah' next time." — K
          </div>
        </div>

        <div className="box dashed">
          <div className="bold">★ Quick range check</div>
          <div className="small mt-1">Sing a slide from low to high — we'll track your highest &amp; lowest.</div>
          <div className="row gap-2 mt-2">
            <button className="btn small primary grow">
              <Icon name="mic" size={11} /> start test · 30s
            </button>
            <button className="btn small ghost">manual</button>
          </div>
        </div>

        <div className="small muted">YOUR ZONES</div>
        <div className="box small row gap-2">
          <span className="chip tiny" style={{ background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}>chest</span>
          <span className="bold grow">F3 → E4</span>
          <button className="btn small ghost">edit</button>
        </div>
        <div className="box small row gap-2" style={{ background: "#fffceb" }}>
          <span className="chip tiny" style={{ background: "var(--highlight)" }}>mix</span>
          <span className="bold grow">A3 → G5</span>
          <button className="btn small ghost">edit</button>
        </div>
        <div className="box small row gap-2">
          <span className="chip tiny accent">head</span>
          <span className="bold grow">D5 → A5 <span style={{ color: "var(--accent)" }}>★</span></span>
          <button className="btn small ghost">edit</button>
        </div>

        <div className="hr-hand" />
        <button className="btn ghost">share update with Mr. K →</button>
      </div>
    </WFFrame>
  );
}

export function VoiceRangePage() {
  const isMobile = useIsMobile();
  return isMobile ? <VoiceRangeMobile /> : <VoiceRangeDesktop />;
}
