import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, GitBranch, LayoutGrid } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { BookingPublic } from "@sunbird/shared";

type StudentInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  bookingCount: number;
  lastLessonAt: string;
};

type Tab = "bookings" | "students";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TeacherDashboard() {
  const [tab, setTab] = useState<Tab>("bookings");
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesBookingId, setNotesBookingId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBookings = () => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((res) => setBookings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadStudents = () => {
    apiFetch<{ data: StudentInfo[] }>("/api/coaches/students")
      .then((res) => setStudents(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    loadBookings();
    loadStudents();
  }, []);

  const now = new Date().toISOString();
  const upcoming = bookings.filter(
    (b) => b.status === "CONFIRMED" && b.startsAt > now,
  );
  const needsNotes = bookings.filter(
    (b) =>
      (b.status === "CONFIRMED" && b.startsAt <= now && !b.practiceNotes) ||
      (b.status === "COMPLETED" && !b.practiceNotes),
  );
  const completed = bookings.filter(
    (b) => b.status === "COMPLETED" && b.practiceNotes,
  );
  const cancelled = bookings.filter((b) => b.status === "CANCELLED");

  const markComplete = async (id: string) => {
    try {
      await apiFetch(`/api/bookings/${id}/complete`, { method: "PATCH" });
      loadBookings();
    } catch (err) {
      if (err instanceof ApiError) alert(err.body.error);
    }
  };

  const submitNotes = async (id: string) => {
    if (!notesText.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/bookings/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ practiceNotes: notesText }),
      });
      setNotesBookingId(null);
      setNotesText("");
      loadBookings();
    } catch (err) {
      if (err instanceof ApiError) alert(err.body.error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  const BookingCard = ({ b, actions }: { b: BookingPublic; actions?: React.ReactNode }) => (
    <div className="bg-surface rounded-card shadow-card p-6">
      <div className="flex items-baseline justify-between mb-1">
        <Link
          to={`/coach/session/${b.id}`}
          className="font-display text-lg font-semibold hover:text-iris transition-colors"
        >
          {b.category?.title ?? b.lessonType?.title ?? "Open"}
        </Link>
        <span
          className={`text-[11px] uppercase tracking-wider ${
            b.status === "COMPLETED" ? "text-sage" : b.status === "CANCELLED" ? "text-coral" : "text-iris"
          }`}
        >
          {b.status}
        </span>
      </div>
      <p className="text-sm text-text-secondary mb-1">
        {b.skillTree?.title ?? b.lessonCategory?.title ?? "Open"} &middot;{" "}
        {formatDate(b.startsAt)} at {formatTime(b.startsAt)}
      </p>
      <p className="text-sm font-medium">{b.user?.name ?? "Unknown student"}</p>
      {b.studentNote && (
        <p className="text-sm text-text-secondary mt-2 italic">
          "{b.studentNote}"
        </p>
      )}
      {b.practiceNotes && (
        <div className="mt-4 border-l-2 border-gold/30 pl-4">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-secondary mb-1">
            Practice Notes (sent)
          </p>
          <p className="text-sm whitespace-pre-line">{b.practiceNotes}</p>
        </div>
      )}
      {actions && <div className="mt-4" onClick={(e) => e.stopPropagation()}>{actions}</div>}

      <div className="mt-4 pt-3 border-t border-charcoal/5">
        <Link
          to={`/coach/session/${b.id}`}
          className="text-[12px] font-medium text-iris hover:text-iris-hover transition-colors"
        >
          View session &rarr;
        </Link>
      </div>

      {/* Inline notes form */}
      {notesBookingId === b.id && (
        <div className="mt-4 space-y-3">
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Practice suggestions for the student..."
            rows={5}
            className="w-full px-4 py-3 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none transition-colors resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => submitNotes(b.id)}
              disabled={submitting || !notesText.trim()}
              className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send practice notes"}
            </button>
            <button
              onClick={() => { setNotesBookingId(null); setNotesText(""); }}
              className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          Coach Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <Link
            to="/coach/manage"
            className="text-text-secondary hover:text-charcoal transition-colors"
            title="Manage Categories & Skills"
          >
            <LayoutGrid className="w-5 h-5" strokeWidth={1.5} />
          </Link>
          <Link
            to="/coach/curriculum"
            className="text-text-secondary hover:text-charcoal transition-colors"
            title="Skill Tree Editor"
          >
            <GitBranch className="w-5 h-5" strokeWidth={1.5} />
          </Link>
          <Link
            to="/coach/settings"
            className="text-text-secondary hover:text-charcoal transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" strokeWidth={1.5} />
          </Link>
        </div>
        </div>

        {/* Tab toggle */}
        <div className="flex border-b border-warm-gray mb-10">
          <button
            onClick={() => setTab("bookings")}
            className={`pb-3 px-1 mr-8 text-sm font-medium tracking-wide transition-colors ${
              tab === "bookings"
                ? "text-charcoal border-b-2 border-charcoal"
                : "text-text-secondary hover:text-charcoal"
            }`}
          >
            Bookings
          </button>
          <button
            onClick={() => setTab("students")}
            className={`pb-3 px-1 text-sm font-medium tracking-wide transition-colors ${
              tab === "students"
                ? "text-charcoal border-b-2 border-charcoal"
                : "text-text-secondary hover:text-charcoal"
            }`}
          >
            Students ({students.length})
          </button>
        </div>

        {tab === "bookings" && (
          <>
            {/* Needs practice notes */}
            {needsNotes.length > 0 && (
              <section className="mb-12">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-gold mb-6">
                  Needs practice notes ({needsNotes.length})
                </h2>
                <div className="space-y-3">
                  {needsNotes.map((b) => (
                    <BookingCard
                      key={b.id}
                      b={b}
                      actions={
                        notesBookingId !== b.id && (
                          <div className="flex gap-3">
                            {b.status === "CONFIRMED" && (
                              <button
                                onClick={() => markComplete(b.id)}
                                className="text-[12px] font-medium text-sage hover:text-sage/80 transition-colors"
                              >
                                Mark complete
                              </button>
                            )}
                            <button
                              onClick={() => { setNotesBookingId(b.id); setNotesText(b.practiceNotes ?? ""); }}
                              className="text-[12px] font-medium text-iris hover:text-iris-hover transition-colors"
                            >
                              Add practice notes
                            </button>
                          </div>
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            <section className="mb-12">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-text-secondary text-sm py-4">No upcoming lessons.</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} b={b} />
                  ))}
                </div>
              )}
            </section>

            {/* Completed with notes */}
            {completed.length > 0 && (
              <section className="mb-12">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
                  Completed ({completed.length})
                </h2>
                <div className="space-y-3">
                  {completed.map((b) => (
                    <BookingCard key={b.id} b={b} />
                  ))}
                </div>
              </section>
            )}

            {/* Cancelled */}
            {cancelled.length > 0 && (
              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
                  Cancelled ({cancelled.length})
                </h2>
                <div className="space-y-3 opacity-60">
                  {cancelled.map((b) => (
                    <BookingCard key={b.id} b={b} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {tab === "students" && (
          <>
            {students.length === 0 ? (
              <p className="text-text-secondary text-sm py-8">
                No students yet. Students will appear here after their first booking.
              </p>
            ) : (
              <div className="space-y-3">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="bg-surface rounded-card shadow-card p-6 flex items-center gap-5"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full bg-warm-gray flex items-center justify-center">
                      {s.avatarUrl ? (
                        <img
                          src={s.avatarUrl}
                          alt={s.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-sm font-semibold text-text-secondary">
                          {s.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-base font-semibold truncate">
                        {s.name}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {s.bookingCount} lesson{s.bookingCount !== 1 ? "s" : ""} &middot; last {formatDate(s.lastLessonAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
