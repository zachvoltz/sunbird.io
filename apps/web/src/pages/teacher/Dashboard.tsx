import { useState, useEffect } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { BookingPublic } from "@sunbird/shared";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function TeacherDashboard() {
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesBookingId, setNotesBookingId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((res) => setBookings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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
      load();
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
      load();
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
        <h3 className="font-display text-lg font-semibold">
          {b.lessonType.title}
        </h3>
        <span
          className={`text-[11px] uppercase tracking-wider ${
            b.status === "COMPLETED" ? "text-sage" : b.status === "CANCELLED" ? "text-coral" : "text-iris"
          }`}
        >
          {b.status}
        </span>
      </div>
      <p className="text-sm text-text-secondary mb-1">
        {b.lessonCategory?.title ?? "Open"} &middot;{" "}
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
      {actions && <div className="mt-4">{actions}</div>}

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
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-12">
          Teacher Dashboard
        </h1>

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
      </div>
    </div>
  );
}
