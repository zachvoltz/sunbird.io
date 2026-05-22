import { Link } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { useIsMobile } from "../hooks/useIsMobile";

function InboxEmpty() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        padding: "40px 24px",
        color: "var(--ink-soft)",
      }}
    >
      {/* hand-drawn envelope */}
      <svg width="120" height="84" viewBox="0 0 120 84" fill="none" aria-hidden>
        <rect x="8" y="14" width="104" height="60" rx="6"
          stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" />
        <path d="M 10 18 L 60 50 L 110 18"
          stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        <path d="M 12 70 L 46 44" stroke="var(--ink-faint)" strokeWidth="1.2" fill="none" />
        <path d="M 108 70 L 74 44" stroke="var(--ink-faint)" strokeWidth="1.2" fill="none" />
      </svg>
      <div className="wf-scrawl bold" style={{ fontSize: 24, color: "var(--ink)" }}>
        Inbox is quiet.
      </div>
      <Squiggle w={90} color="var(--ink-faint)" />
      <div className="small muted" style={{ maxWidth: 360 }}>
        Voice memos from parents, take submissions, and lesson-related messages from
        students will land here. Nothing new right now.
      </div>
      <div className="row gap-2 mt-3">
        <Link to="/coach" className="btn small">back to today</Link>
        <Link to="/coach/library" className="btn small ghost">open library</Link>
      </div>
    </div>
  );
}

function InboxDesktop() {
  return (
    <DTFrame side="inbox">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Inbox</h2>
          <div className="dt-sub">Messages from students, parents, and submitted takes.</div>
        </div>
        <div className="row gap-2">
          <div className="pill-row">
            <span className="p on">all</span>
            <span className="p">unread</span>
            <span className="p">takes</span>
            <span className="p">messages</span>
          </div>
          <button className="btn small ghost">mark all read</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <InboxEmpty />
        </div>
      </div>
    </DTFrame>
  );
}

function InboxMobile() {
  return (
    <WFFrame navActive="notes">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Inbox</h2>
          <div className="wf-subtitle">messages &amp; takes</div>
        </div>
        <Link to="/coach" className="btn icon ghost"><Icon name="back" size={14} /></Link>
      </div>
      <div className="wf-body col gap-3 scroll-y" style={{ alignItems: "stretch" }}>
        <div className="seg">
          <div className="s on">all</div>
          <div className="s">unread</div>
          <div className="s">takes</div>
        </div>
        <div className="box dashed" style={{ paddingBottom: 24 }}>
          <InboxEmpty />
        </div>
      </div>
    </WFFrame>
  );
}

export function InboxPage() {
  const isMobile = useIsMobile();
  return isMobile ? <InboxMobile /> : <InboxDesktop />;
}
