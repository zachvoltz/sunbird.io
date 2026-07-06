import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { BookingPublic } from "@sunbird/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { rebookHref } from "@/lib/rebook";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { useNow } from "../hooks/useNow";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function relativeFromNow(targetIso: string, now: Date): string {
  const diffMs = new Date(targetIso).getTime() - now.getTime();
  if (diffMs <= -60_000) {
    const past = Math.abs(diffMs);
    const h = Math.floor(past / 3_600_000);
    const m = Math.floor((past / 60_000) % 60);
    if (h > 0) return `${h}h ${m}m ago`;
    return `${m}m ago`;
  }
  if (Math.abs(diffMs) < 60_000) return "now";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs / 60_000) % 60);
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function MyBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<BookingPublic | null>(null);

  const load = () => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Payment-return feedback. Stripe/Square send the student back here with
  // ?payment=success|canceled (single lesson) or ?package=success|canceled
  // (package purchase). Show a toast, then strip the param so a refresh or a
  // shared link doesn't replay it.
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  useEffect(() => {
    const pay = searchParams.get("payment");
    const pkg = searchParams.get("package");
    if (pay === "success") setNotice({ kind: "ok", text: "Payment received — your lesson is confirmed." });
    else if (pay === "canceled") setNotice({ kind: "err", text: "Payment canceled — this lesson isn't booked yet." });
    else if (pkg === "success") setNotice({ kind: "ok", text: "Payment received — your package is active." });
    else if (pkg === "canceled") setNotice({ kind: "err", text: "Payment canceled — your package wasn't purchased." });
    if (pay || pkg) {
      const next = new URLSearchParams(searchParams);
      next.delete("payment");
      next.delete("package");
      setSearchParams(next, { replace: true });
    }
    // Mount-only: the param is consumed and cleared immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = useNow();
  const todayStr = ymd(now);

  const today = bookings.filter(
    (b) => b.status === "CONFIRMED" && ymd(new Date(b.startsAt)) === todayStr,
  );
  const upcoming = bookings.filter(
    (b) => b.status === "CONFIRMED" && new Date(b.startsAt) > now && ymd(new Date(b.startsAt)) !== todayStr,
  );
  const past = bookings.filter(
    (b) => new Date(b.startsAt) < now && ymd(new Date(b.startsAt)) !== todayStr,
  );
  const withNotes = past.filter((b) => b.practiceNotes && b.practiceNotes.trim().length > 0);

  const cancel = async (id: string) => {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(id);
    try {
      await apiFetch(`/api/bookings/${id}/cancel`, { method: "PATCH" });
      load();
    } catch (err) {
      if (err instanceof ApiError) alert(err.body.error);
    } finally {
      setCancellingId(null);
    }
  };

  const cancelSeries = async (scheduleId: string) => {
    if (!confirm("Cancel all future bookings in this recurring series?")) return;
    try {
      await apiFetch(`/api/bookings/recurring/${scheduleId}/cancel`, { method: "POST" });
      load();
    } catch (err) {
      if (err instanceof ApiError) alert(err.body.error);
    }
  };

  const dateLabel = now.toLocaleDateString([], {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <STFrame side="home">
      {notice && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 8,
            border: `1.5px solid ${notice.kind === "ok" ? "#3f7d54" : "var(--accent)"}`,
            background: "var(--paper, #fff)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
            maxWidth: "90vw",
          }}
        >
          <span style={{ color: notice.kind === "ok" ? "#3f7d54" : "var(--accent)", fontWeight: 700 }}>
            {notice.kind === "ok" ? "✓" : "!"}
          </span>
          <span className="small">{notice.text}</span>
          {notice.kind === "err" && (
            <Link to="/book" className="btn small ghost">try again</Link>
          )}
          <button onClick={() => setNotice(null)} className="btn small ghost">dismiss</button>
        </div>
      )}
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">{dateLabel}</h2>
          <div className="dt-sub">
            {greetingFor(now)}, {(user?.name ?? "there").split(" ")[0]} —{" "}
            {today.length > 0
              ? `lesson today at ${formatTime(today[0].startsAt)}`
              : upcoming.length > 0
              ? `next lesson ${formatDate(upcoming[0].startsAt)}`
              : "no upcoming lessons booked"}
          </div>
        </div>
        <div className="row gap-2">
          <Link to="/book" className="btn small primary">＋ book a lesson</Link>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "1.2fr 1fr", height: "100%" }}>
          {/* LEFT — today + upcoming */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Lessons</div>
              <div className="pill-row">
                <span className="p on">scheduled</span>
                <span className="p">history</span>
              </div>
            </div>
            <div className="panel-body scroll col gap-3" style={{ paddingTop: 12 }}>
              {loading && <div className="small muted">Loading…</div>}

              {!loading && today.length === 0 && upcoming.length === 0 && (
                <div
                  className="box dashed"
                  style={{ textAlign: "center", padding: "24px 14px", color: "var(--ink-soft)" }}
                >
                  <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
                    Nothing on the books.
                  </div>
                  <div className="small muted mt-2">
                    Pick a coach + a time and we'll put it here.
                  </div>
                  <div className="row gap-2 mt-3" style={{ justifyContent: "center" }}>
                    <Link to="/book" className="btn small primary">book a lesson</Link>
                    <Link to="/coaches" className="btn small ghost">browse coaches</Link>
                  </div>
                </div>
              )}

              {today.map((b) => (
                <TodayLessonCard key={b.id} booking={b} now={now} />
              ))}
              {upcoming.length > 0 && (
                <>
                  <div className="small muted mt-2">UPCOMING · {upcoming.length}</div>
                  {upcoming.slice(0, 8).map((b) => (
                    <UpcomingLessonCard
                      key={b.id}
                      booking={b}
                      cancel={cancel}
                      cancelSeries={cancelSeries}
                      cancellingId={cancellingId}
                      onReschedule={setRescheduling}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* RIGHT — notes from teacher + history */}
          <div className="panel tinted">
            <div className="panel-head">
              <div className="panel-title">Notes from your teacher</div>
              {withNotes.length > 0 && <span className="chip tiny">{withNotes.length}</span>}
            </div>
            <div className="panel-body scroll col gap-3">
              {!loading && withNotes.length === 0 && (
                <div className="small muted">
                  Practice notes your teacher sends after a lesson will appear here.
                </div>
              )}
              {withNotes.slice(0, 6).map((b) => (
                <PracticeNoteCard key={b.id} booking={b} />
              ))}

              {past.length > withNotes.length && (
                <>
                  <div className="hr-hand" />
                  <div className="small muted">PAST LESSONS · {past.length}</div>
                  {past.slice(0, 5).map((b) => (
                    <PastLessonRow key={b.id} booking={b} />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            load();
          }}
        />
      )}
    </STFrame>
  );
}

function TodayLessonCard({ booking, now }: { booking: BookingPublic; now: Date }) {
  const coachName = booking.coach?.name ?? "your teacher";
  const piece = booking.skillTree?.title ?? booking.category?.title ?? "lesson";
  const durMin = Math.max(
    1,
    Math.round((new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000),
  );
  const isLive = new Date(booking.startsAt) <= now && new Date(booking.endsAt) > now;
  const corner = isLive ? "live now" : relativeFromNow(booking.startsAt, now);
  return (
    <div className="box thick" style={{ position: "relative" }}>
      <div className="corner">{corner}</div>
      <div className="row gap-3">
        <Avatar name={coachName} size={46} />
        <div className="grow">
          <div className="bold big">
            with {coachName.split(" ")[0]}
          </div>
          <div className="small muted">
            {formatTime(booking.startsAt)} · {durMin} min ·{" "}
            {booking.mode === "ONLINE" ? "online" : "in person"} · {piece}
          </div>
        </div>
      </div>
      <Squiggle w={70} color="var(--ink-faint)" />
      {booking.studentNote && (
        <div className="small mt-2" style={{ fontStyle: "italic" }}>
          "{booking.studentNote}"
        </div>
      )}
      <div className="row gap-2 mt-2">
        <Link to={`/my-bookings/${booking.id}`} className="btn small grow">open session</Link>
        {booking.mode === "ONLINE" && (
          <Link to={`/my-bookings/${booking.id}`} className="btn small primary">
            {isLive ? "rejoin call ↗" : "join call ↗"}
          </Link>
        )}
      </div>
    </div>
  );
}

function UpcomingLessonCard({
  booking,
  cancel,
  cancelSeries,
  cancellingId,
  onReschedule,
}: {
  booking: BookingPublic;
  cancel: (id: string) => void;
  cancelSeries: (scheduleId: string) => void;
  cancellingId: string | null;
  onReschedule: (booking: BookingPublic) => void;
}) {
  const coachName = booking.coach?.name ?? "your teacher";
  const piece = booking.skillTree?.title ?? booking.category?.title ?? "lesson";
  return (
    <div className="box">
      <div className="row gap-3">
        <Avatar name={coachName} size={36} />
        <div className="grow">
          <div className="bold">
            <Link
              to={`/my-bookings/${booking.id}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)}
            </Link>
          </div>
          <div className="tiny muted">
            with {coachName} · {piece}
            {booking.scheduleId && (
              <Tag color="yellow">recurring</Tag>
            )}
          </div>
        </div>
        <div className="col" style={{ alignItems: "flex-end", gap: 2 }}>
          <Link to={`/my-bookings/${booking.id}`} className="btn small">view</Link>
          <button
            onClick={() => onReschedule(booking)}
            className="btn small ghost"
          >
            reschedule
          </button>
          <button
            onClick={() => cancel(booking.id)}
            disabled={cancellingId === booking.id}
            className="btn small ghost"
            style={{ color: "var(--accent)" }}
          >
            {cancellingId === booking.id ? "cancelling…" : "cancel"}
          </button>
          {booking.scheduleId && (
            <button
              onClick={() => cancelSeries(booking.scheduleId!)}
              className="btn small ghost"
              style={{ fontSize: 11, color: "var(--ink-faint)" }}
            >
              cancel series
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PracticeNoteCard({ booking }: { booking: BookingPublic }) {
  const coachName = booking.coach?.name ?? "your teacher";
  return (
    <div className="box">
      <div className="row between mb-1">
        <span className="wf-scrawl bold" style={{ fontSize: 18 }}>
          After {formatDate(booking.startsAt)}
        </span>
        <span className="tiny muted">from {coachName.split(" ")[0]}</span>
      </div>
      <Squiggle w={50} color="var(--ink-faint)" />
      <div className="small mt-2" style={{ whiteSpace: "pre-line", lineHeight: 1.55 }}>
        {booking.practiceNotes}
      </div>
      <div className="row gap-2 mt-2">
        <Link to={`/my-bookings/${booking.id}`} className="btn small ghost">open session →</Link>
        {booking.coach && (
          <Link to={rebookHref(booking)} className="btn small primary">
            book again with {coachName.split(" ")[0]}
          </Link>
        )}
      </div>
    </div>
  );
}

type AvailSlot = { startsAt: string; endsAt: string; coachIds: string[] };

// Move a booking to a new time with the SAME coach. Pick a date, fetch the
// coach's open slots for that day (reusing GET /api/availability), pick a
// time, submit. The server re-validates the slot.
function RescheduleModal({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingPublic;
  onClose: () => void;
  onDone: () => void;
}) {
  const coachId = booking.coach?.id;
  const categoryId = booking.category?.id;
  const coachName = booking.coach?.name ?? "your coach";

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const minDate = ymd(new Date());
  const maxDate = ymd(new Date(Date.now() + 30 * 86_400_000));

  useEffect(() => {
    if (!date || !categoryId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelected(null);
    apiFetch<{ data: AvailSlot[] }>(`/api/availability?date=${date}&categoryId=${categoryId}`)
      .then((r) => setSlots(r.data.filter((s) => !!coachId && s.coachIds.includes(coachId))))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, categoryId, coachId]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setErr("");
    try {
      await apiFetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ newStartsAt: selected }),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.body.error : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        className="box thick"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(440px, 100%)", maxHeight: "85vh", overflow: "auto", background: "var(--paper, #fff)" }}
      >
        <div className="row between mb-2">
          <div className="bold big">Reschedule</div>
          <button onClick={onClose} className="btn small ghost">close</button>
        </div>
        <div className="small muted mb-2">
          Currently {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)} with{" "}
          {coachName.split(" ")[0]}. Pick a new time below.
        </div>

        <label className="small bold">New date</label>
        <input
          type="date"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            margin: "6px 0 12px",
            fontFamily: "var(--hand)",
            fontSize: 14,
            padding: "6px 8px",
            border: "1.5px solid var(--ink-faint)",
            borderRadius: 6,
            background: "var(--paper)",
            color: "var(--ink)",
            outline: "none",
          }}
        />

        {date && (
          <div className="col gap-2">
            {loadingSlots && <div className="small muted">Loading open times…</div>}
            {!loadingSlots && slots.length === 0 && (
              <div className="small muted">No open times with {coachName.split(" ")[0]} that day.</div>
            )}
            {!loadingSlots && slots.length > 0 && (
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                {slots.map((s) => (
                  <button
                    key={s.startsAt}
                    onClick={() => setSelected(s.startsAt)}
                    className={`btn small ${selected === s.startsAt ? "primary" : "ghost"}`}
                  >
                    {formatTime(s.startsAt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="small mt-2" style={{ color: "var(--accent)" }}>
            {err}
          </div>
        )}

        <div className="row gap-2 mt-3" style={{ justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn small ghost">cancel</button>
          <button
            onClick={submit}
            disabled={!selected || submitting}
            className="btn small primary"
          >
            {submitting ? "moving…" : "confirm new time"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PastLessonRow({ booking }: { booking: BookingPublic }) {
  const coachName = booking.coach?.name ?? "your teacher";
  const status = booking.status;
  return (
    <div className="box small filled">
      <div className="row between">
        <Link
          to={`/my-bookings/${booking.id}`}
          style={{ color: "inherit", textDecoration: "none" }}
          className="row gap-2"
        >
          <Icon name="clock" size={12} stroke="var(--ink-faint)" />
          <span className="small">
            <span className="bold">{formatDate(booking.startsAt)}</span> · with {coachName.split(" ")[0]}
          </span>
        </Link>
        <div className="row gap-2" style={{ alignItems: "center" }}>
          {booking.coach && (
            <Link to={rebookHref(booking)} className="btn small ghost" style={{ fontSize: 11 }}>
              book again
            </Link>
          )}
          <span
            className="tiny muted"
            style={{ color: status === "CANCELLED" ? "var(--accent)" : undefined }}
          >
            {status.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
