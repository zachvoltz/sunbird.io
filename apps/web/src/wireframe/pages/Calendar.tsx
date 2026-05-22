import { Link } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { useIsMobile } from "../hooks/useIsMobile";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p"];

function EmptyWeekGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px repeat(7, 1fr)",
        border: "1.5px solid var(--ink)",
        borderRadius: 10,
        background: "var(--paper)",
        overflow: "hidden",
      }}
    >
      {/* corner */}
      <div style={{ borderBottom: "1.5px solid var(--ink)", background: "var(--paper-2)" }} />
      {/* day headers */}
      {WEEKDAYS.map((d) => (
        <div
          key={d}
          style={{
            padding: "8px 10px",
            borderBottom: "1.5px solid var(--ink)",
            borderLeft: "1.5px dotted var(--ink-faint)",
            background: "var(--paper-2)",
            fontFamily: "var(--scrawl)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {d}
        </div>
      ))}

      {/* hour rows */}
      {HOURS.map((h, hi) => (
        <Row key={h} hour={h} last={hi === HOURS.length - 1} />
      ))}
    </div>
  );
}

function Row({ hour, last }: { hour: string; last: boolean }) {
  const bb = last ? undefined : "1.5px dotted var(--ink-faint)";
  return (
    <>
      <div
        style={{
          padding: "10px 6px",
          textAlign: "right",
          color: "var(--ink-faint)",
          fontFamily: "var(--mono)",
          fontSize: 10,
          borderBottom: bb,
          background: "var(--paper-2)",
        }}
      >
        {hour}
      </div>
      {WEEKDAYS.map((d) => (
        <div
          key={d + hour}
          style={{
            height: 40,
            borderLeft: "1.5px dotted var(--ink-faint)",
            borderBottom: bb,
          }}
        />
      ))}
    </>
  );
}

function CalendarEmpty() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
        padding: "26px 24px 18px",
        color: "var(--ink-soft)",
      }}
    >
      {/* hand-drawn calendar */}
      <svg width="120" height="92" viewBox="0 0 120 92" fill="none" aria-hidden>
        <rect x="8" y="14" width="104" height="72" rx="6"
          stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" />
        <line x1="8" y1="32" x2="112" y2="32" stroke="var(--ink)" strokeWidth="1.5" />
        <rect x="22" y="4" width="6" height="20" rx="2"
          stroke="var(--ink)" strokeWidth="1.5" fill="var(--paper-2)" />
        <rect x="92" y="4" width="6" height="20" rx="2"
          stroke="var(--ink)" strokeWidth="1.5" fill="var(--paper-2)" />
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            {[0, 1, 2, 3, 4, 5, 6].map((c) => (
              <circle
                key={`${r}-${c}`}
                cx={16 + c * 14}
                cy={42 + r * 12}
                r="1.5"
                fill="var(--ink-faint)"
              />
            ))}
          </g>
        ))}
      </svg>
      <div className="wf-scrawl bold" style={{ fontSize: 24, color: "var(--ink)" }}>
        Nothing on the books.
      </div>
      <Squiggle w={90} color="var(--ink-faint)" />
      <div className="small muted" style={{ maxWidth: 380 }}>
        Lessons you and your students schedule will show up here. Once they're booked
        you'll see the week and month at a glance.
      </div>
      <div className="row gap-2 mt-2">
        <button className="btn small primary">＋ block out time</button>
        <button className="btn small">edit availability</button>
        <Link to="/coach" className="btn small ghost">back to today</Link>
      </div>
    </div>
  );
}

function CalendarDesktop() {
  const now = new Date();
  const monthLabel = now.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <DTFrame side="calendar">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Calendar</h2>
          <div className="dt-sub">{monthLabel} · no lessons booked yet</div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost">← prev</button>
          <span className="chip">this week</span>
          <button className="btn small ghost">next →</button>
          <div className="pill-row" style={{ marginLeft: 8 }}>
            <span className="p on">week</span>
            <span className="p">month</span>
            <span className="p">list</span>
          </div>
          <button className="btn small primary">＋ block time</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll col gap-3">
            <CalendarEmpty />
            <EmptyWeekGrid />
            <div className="tiny muted center">
              Hours shown · 8 AM – 8 PM · drag-create not wired yet
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function CalendarMobile() {
  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Calendar</h2>
          <div className="wf-subtitle">your week at a glance</div>
        </div>
        <Link to="/coach" className="btn icon ghost"><Icon name="back" size={14} /></Link>
      </div>
      <div className="wf-body col gap-3 scroll-y" style={{ alignItems: "stretch" }}>
        <div className="seg">
          <div className="s on">week</div>
          <div className="s">month</div>
          <div className="s">list</div>
        </div>
        <div className="box dashed">
          <CalendarEmpty />
        </div>
      </div>
    </WFFrame>
  );
}

export function CalendarPage() {
  const isMobile = useIsMobile();
  return isMobile ? <CalendarMobile /> : <CalendarDesktop />;
}
