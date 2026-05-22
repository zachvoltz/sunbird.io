import { Link } from "react-router-dom";
import { STFrame } from "../components/STFrame";
import { Squiggle } from "../components/Squiggle";
import { MockTag } from "../components/MockTag";

export function MyTakesPage() {
  return (
    <STFrame side="takes">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">My takes</h2>
          <div className="dt-sub">
            Recordings you've sent your teacher &amp; the notes back.
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small primary">＋ record new take</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll col gap-3" style={{ padding: "12px 4px" }}>
            <div
              className="box dashed"
              style={{
                textAlign: "center",
                padding: "32px 24px",
                color: "var(--ink-soft)",
              }}
            >
              <svg width="80" height="100" viewBox="0 0 80 100" fill="none" aria-hidden style={{ margin: "0 auto 6px" }}>
                <rect x="28" y="14" width="24" height="44" rx="12"
                  stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" />
                <path d="M 20 50 a 20 20 0 0 0 40 0"
                  stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <line x1="40" y1="70" x2="40" y2="84" stroke="var(--ink)" strokeWidth="2" />
                <line x1="28" y1="84" x2="52" y2="84" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="40" cy="30" r="3" fill="var(--accent)" />
              </svg>
              <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
                No takes yet.
              </div>
              <Squiggle w={80} color="var(--ink-faint)" />
              <div className="small muted mt-2" style={{ maxWidth: 380, margin: "8px auto 0" }}>
                When you record a take for a song or exercise, it'll land here. Your teacher
                pins notes to specific bars or moments and you can listen back with their
                feedback right on the score.
              </div>
              <div className="row gap-2 mt-3" style={{ justifyContent: "center" }}>
                <Link to="/my-bookings" className="btn small">view lessons</Link>
                <span className="chip tiny" style={{ alignSelf: "center" }}>
                  <MockTag>recording UI</MockTag>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </STFrame>
  );
}
