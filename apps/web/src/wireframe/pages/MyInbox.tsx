// Student inbox — mirror of the coach Inbox page. Mostly an empty
// placeholder for now; the real student-side message thread UX hasn't
// been designed yet. What's wired:
//   - Mounts inside STFrame so the left nav stays.
//   - POSTs /api/me/inbox-viewed once on mount and dispatches
//     "sunbird:inbox-viewed" so the sidebar badge clears immediately.

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { STFrame } from "../components/STFrame";
import { WFFrame } from "../components/WFFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { useIsMobile } from "../hooks/useIsMobile";
import { apiFetch } from "@/lib/api";

function useMarkInboxViewed() {
  useEffect(() => {
    apiFetch("/api/me/inbox-viewed", { method: "POST" })
      .then(() => {
        window.dispatchEvent(new Event("sunbird:inbox-viewed"));
      })
      .catch(() => { /* non-fatal */ });
  }, []);
}

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
        Replies from your coach, lesson reminders, and voice memos will land here.
        Nothing new right now.
      </div>
      <div className="row gap-2 mt-3">
        <Link to="/today" className="btn small">back to today</Link>
        <Link to="/my-bookings" className="btn small ghost">view lessons</Link>
      </div>
    </div>
  );
}

function MyInboxDesktop() {
  useMarkInboxViewed();
  return (
    <STFrame side="inbox">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Inbox</h2>
          <div className="dt-sub">Messages from your coach and lesson updates.</div>
        </div>
        <div className="row gap-2">
          <div className="pill-row">
            <span className="p on">all</span>
            <span className="p">unread</span>
          </div>
          <button className="btn small ghost">mark all read</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <InboxEmpty />
        </div>
      </div>
    </STFrame>
  );
}

function MyInboxMobile() {
  useMarkInboxViewed();
  return (
    <WFFrame navActive="notes">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Inbox</h2>
          <div className="wf-subtitle">messages from your coach</div>
        </div>
        <Link to="/today" className="btn icon ghost"><Icon name="back" size={14} /></Link>
      </div>
      <div className="wf-body col gap-3 scroll-y" style={{ alignItems: "stretch" }}>
        <div className="box dashed" style={{ paddingBottom: 24 }}>
          <InboxEmpty />
        </div>
      </div>
    </WFFrame>
  );
}

export function MyInboxPage() {
  const isMobile = useIsMobile();
  return isMobile ? <MyInboxMobile /> : <MyInboxDesktop />;
}
