import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

export function MyBookings() {
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
  const past = bookings.filter(
    (b) => b.status !== "CONFIRMED" || b.startsAt <= now,
  );

  const cancelBooking = async (id: string) => {
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[800px]">
        <div className="flex items-baseline justify-between mb-12">
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            My Bookings
          </h1>
          <Link
            to="/book"
            className="text-[13px] font-medium text-charcoal border border-charcoal px-5 py-1.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
          >
            Book a lesson
          </Link>
        </div>

        {/* Upcoming */}
        <section className="mb-16">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-text-secondary text-sm py-8">
              No upcoming lessons.{" "}
              <Link to="/book" className="text-iris hover:text-iris-hover">
                Book one?
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b) => (
                <div
                  key={b.id}
                  className="bg-surface rounded-card shadow-card p-6 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex-1">
                    <Link
                      to={`/my-bookings/${b.id}`}
                      className="font-display text-lg font-semibold hover:text-iris transition-colors"
                    >
                      {b.lessonType.title}
                    </Link>
                    <p className="text-sm text-text-secondary">
                      {b.lessonCategory?.title ?? "Open"} &middot;{" "}
                      {formatDate(b.startsAt)} at {formatTime(b.startsAt)}
                    </p>
                    <Link
                      to={`/my-bookings/${b.id}`}
                      className="text-[12px] font-medium text-iris hover:text-iris-hover transition-colors mt-1 inline-block"
                    >
                      View session &rarr;
                    </Link>
                  </div>
                  <button
                    onClick={() => cancelBooking(b.id)}
                    disabled={cancellingId === b.id}
                    className="text-[12px] font-medium text-coral hover:text-coral/80 transition-colors shrink-0"
                  >
                    {cancellingId === b.id ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
              Past
            </h2>
            <div className="space-y-3">
              {past.map((b) => (
                <div
                  key={b.id}
                  className="bg-surface/50 rounded-card p-6"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <Link
                      to={`/my-bookings/${b.id}`}
                      className="font-display text-lg font-semibold hover:text-iris transition-colors"
                    >
                      {b.lessonType.title}
                    </Link>
                    <span
                      className={`text-[11px] uppercase tracking-wider ${
                        b.status === "COMPLETED"
                          ? "text-sage"
                          : b.status === "CANCELLED"
                            ? "text-coral"
                            : "text-text-secondary"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-1">
                    {b.lessonCategory?.title ?? "Open"} &middot;{" "}
                    {formatDate(b.startsAt)} at {formatTime(b.startsAt)}
                  </p>
                  <Link
                    to={`/my-bookings/${b.id}`}
                    className="text-[12px] font-medium text-iris hover:text-iris-hover transition-colors inline-block mb-3"
                  >
                    View session &rarr;
                  </Link>
                  {b.practiceNotes && (
                    <div className="mt-4 border-l-2 border-gold/30 pl-4">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-text-secondary mb-2">
                        Practice Notes
                      </p>
                      <p className="text-sm text-charcoal whitespace-pre-line">
                        {b.practiceNotes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
