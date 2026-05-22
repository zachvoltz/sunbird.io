import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BookingPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function MyNotesPage() {
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const withNotes = bookings
    .filter((b) => b.practiceNotes && b.practiceNotes.trim().length > 0)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return (
    <STFrame side="notes">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Notes from your teacher</h2>
          <div className="dt-sub">
            Practice notes &amp; lesson summaries · {withNotes.length}{" "}
            {withNotes.length === 1 ? "note" : "notes"}
          </div>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll col gap-3" style={{ padding: "8px 4px 4px" }}>
            {loading && <div className="small muted">Loading…</div>}

            {!loading && withNotes.length === 0 && (
              <div
                className="box dashed"
                style={{
                  textAlign: "center",
                  padding: "32px 24px",
                  color: "var(--ink-soft)",
                }}
              >
                <svg width="100" height="80" viewBox="0 0 100 80" fill="none" aria-hidden style={{ margin: "0 auto 8px" }}>
                  <path d="M 12 14 L 78 14 L 90 28 L 90 70 L 12 70 Z"
                    stroke="var(--ink)" strokeWidth="1.8" fill="var(--paper)" />
                  <path d="M 78 14 L 78 28 L 90 28" stroke="var(--ink)" strokeWidth="1.5" fill="none" />
                  <line x1="22" y1="38" x2="78" y2="38" stroke="var(--ink-faint)" strokeWidth="1.2" />
                  <line x1="22" y1="48" x2="74" y2="48" stroke="var(--ink-faint)" strokeWidth="1.2" />
                  <line x1="22" y1="58" x2="60" y2="58" stroke="var(--ink-faint)" strokeWidth="1.2" />
                </svg>
                <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
                  No notes yet.
                </div>
                <div className="small muted mt-2" style={{ maxWidth: 380, margin: "8px auto 0" }}>
                  After a lesson, your teacher will leave a practice note with what to work on
                  next. They'll all collect here.
                </div>
                <div className="row gap-2 mt-3" style={{ justifyContent: "center" }}>
                  <Link to="/my-bookings" className="btn small">view bookings</Link>
                </div>
              </div>
            )}

            {withNotes.map((b) => (
              <div className="box" key={b.id}>
                <div className="row between mb-1">
                  <span className="wf-scrawl bold" style={{ fontSize: 20 }}>
                    After {formatDate(b.startsAt)}
                  </span>
                  {b.coach && (
                    <span className="tiny muted">from {b.coach.name.split(" ")[0]}</span>
                  )}
                </div>
                <Squiggle w={60} color="var(--ink-faint)" />
                <div
                  className="small mt-2"
                  style={{ whiteSpace: "pre-line", lineHeight: 1.55 }}
                >
                  {b.practiceNotes}
                </div>
                <div className="row gap-2 mt-2">
                  <Link to={`/my-bookings/${b.id}`} className="btn small ghost">
                    <Icon name="chev" size={11} /> open session
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </STFrame>
  );
}
