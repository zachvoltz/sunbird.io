// Student practice Calendar — a month heatmap of fully-practiced days (the
// same all-or-nothing days that drive the streak) with the student's lessons
// overlaid. Data comes from /api/me/student-data (streak + practiceDays) and
// /api/bookings (lessons). All day math is UTC to match practiceDays' keys.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { StudentDetailPublic, BookingPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function utcKey(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function PracticeCalendarPage() {
  const [detail, setDetail] = useState<StudentDetailPublic | null>(null);
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: StudentDetailPublic }>("/api/me/student-data").then((r) => setDetail(r.data)),
      apiFetch<{ data: BookingPublic[] }>("/api/bookings").then((r) => setBookings(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const practiced = useMemo(() => new Set(detail?.practiceDays ?? []), [detail]);

  // Lessons grouped by their UTC date key.
  const lessonsByDay = useMemo(() => {
    const m = new Map<string, BookingPublic[]>();
    for (const b of bookings) {
      if (b.status === "CANCELLED") continue;
      const key = new Date(b.startsAt).toISOString().slice(0, 10);
      (m.get(key) ?? m.set(key, []).get(key)!).push(b);
    }
    return m;
  }, [bookings]);

  const now = new Date();
  const view = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
  const year = view.getUTCFullYear();
  const month = view.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = view.getUTCDay();
  const todayKey = utcKey(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monthLabel = view.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const cells: Array<number | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const streak = detail?.streak;

  return (
    <STFrame side="calendar">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Calendar</h2>
          <div className="dt-sub">Every day you practiced, and your lessons.</div>
        </div>
        {streak && (
          <div className="row gap-2">
            <span className="chip">🔥 {streak.currentDays}-day streak</span>
            <span className="chip tiny">best {streak.longestDays}</span>
          </div>
        )}
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll" style={{ padding: 16 }}>
            {loading && <div className="small muted">Loading…</div>}

            {!loading && (
              <>
                <div className="row between mb-3" style={{ alignItems: "center" }}>
                  <button className="btn small ghost" onClick={() => setMonthOffset((o) => o - 1)}>← prev</button>
                  <div className="wf-scrawl bold" style={{ fontSize: 22 }}>{monthLabel}</div>
                  <button
                    className="btn small ghost"
                    onClick={() => setMonthOffset((o) => o + 1)}
                    disabled={monthOffset >= 0}
                    title={monthOffset >= 0 ? "can't peek into the future" : "next month"}
                  >
                    next →
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                  {WEEKDAYS.map((d, i) => (
                    <div key={i} className="tiny muted" style={{ textAlign: "center", paddingBottom: 4 }}>{d}</div>
                  ))}
                  {cells.map((day, i) => {
                    if (day === null) return <div key={`b${i}`} />;
                    const key = utcKey(year, month, day);
                    const didPractice = practiced.has(key);
                    const isToday = key === todayKey;
                    const lessons = lessonsByDay.get(key) ?? [];
                    return (
                      <div
                        key={key}
                        title={[
                          `${monthLabel.split(" ")[0]} ${day}`,
                          didPractice ? "practiced ✓" : null,
                          lessons.length ? `${lessons.length} lesson${lessons.length > 1 ? "s" : ""}` : null,
                        ].filter(Boolean).join(" · ")}
                        style={{
                          position: "relative",
                          aspectRatio: "1 / 1",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: didPractice ? 700 : 400,
                          color: didPractice ? "var(--paper)" : "var(--ink)",
                          background: didPractice ? "var(--accent)" : "var(--paper-2, rgba(0,0,0,0.03))",
                          border: isToday ? "2px solid var(--ink)" : "1px solid var(--ink-faint)",
                        }}
                      >
                        {day}
                        {lessons.length > 0 && (
                          <span
                            style={{
                              position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
                              width: 5, height: 5, borderRadius: "50%",
                              background: didPractice ? "var(--paper)" : "var(--ink)",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="row gap-3 mt-3" style={{ flexWrap: "wrap" }}>
                  <span className="tiny muted row gap-1" style={{ alignItems: "center" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: "var(--accent)", display: "inline-block" }} /> practiced
                  </span>
                  <span className="tiny muted row gap-1" style={{ alignItems: "center" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ink)", display: "inline-block" }} /> lesson
                  </span>
                  <span className="tiny muted row gap-1" style={{ alignItems: "center" }}>
                    <Icon name="fire" size={12} /> a day counts when you finish your whole routine
                  </span>
                </div>

                <div className="row gap-2 mt-4">
                  <Link to="/practice" className="btn small primary">go practice →</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </STFrame>
  );
}
