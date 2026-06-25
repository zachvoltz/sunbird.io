import { useState, useEffect } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { AvailableSlot } from "@sunbird/shared";
import type { BookingState } from "./BookPage";

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
  nextStep: BookingState["step"];
};

// How many upcoming days' worth of slots to show before nudging the student to
// the date strip for anything further out.
const SOONEST_DAYS_SHOWN = 3;

function generateDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDateLabel(dateStr: string): { day: string; date: string; month: string } {
  const d = new Date(dateStr + "T12:00:00");
  return {
    day: d.toLocaleDateString("en-US", { weekday: "short" }),
    date: String(d.getDate()),
    month: d.toLocaleDateString("en-US", { month: "short" }),
  };
}

function formatGroupLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StepDateTime({ state, update, nextStep }: Props) {
  const [dates] = useState(() => generateDates(30));
  // null = the default "soonest available" view; a date string = that day only.
  const [selectedDate, setSelectedDate] = useState<string | null>(state.selectedDate);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [upcoming, setUpcoming] = useState<AvailableSlot[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);

  const catParam = state.selectedCategory?.id ? `&categoryId=${state.selectedCategory.id}` : "";
  // Pinned to a coach (booking from their page) → only show their times.
  const coachParam = state.pinnedCoachId ? `&coachId=${state.pinnedCoachId}` : "";

  // Soonest-available list, fetched up front so the student sees times without
  // having to pick a date first.
  useEffect(() => {
    setLoadingUpcoming(true);
    setUpcomingError(null);
    apiFetch<{ data: AvailableSlot[] }>(`/api/availability/upcoming?days=14${catParam}${coachParam}`)
      .then((res) => setUpcoming(res.data))
      .catch((err) =>
        setUpcomingError(err instanceof ApiError ? err.body.error : "Failed to load availability"),
      )
      .finally(() => setLoadingUpcoming(false));
  }, [state.pinnedCoachId, state.selectedCategory?.id]);

  // A specific day was picked from the strip.
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setError(null);
    apiFetch<{ data: AvailableSlot[] }>(`/api/availability?date=${selectedDate}${catParam}${coachParam}`)
      .then((res) => {
        // Sort by local hour (12AM first, 11PM last)
        const sorted = res.data.sort((a, b) => {
          const ha = new Date(a.startsAt).toLocaleString("en-US", { hour: "numeric", hour12: false });
          const hb = new Date(b.startsAt).toLocaleString("en-US", { hour: "numeric", hour12: false });
          return Number(ha) - Number(hb);
        });
        setSlots(sorted);
      })
      .catch((err) => {
        if (err instanceof ApiError) setError(err.body.error);
        else setError("Failed to load availability");
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, state.pinnedCoachId, state.selectedCategory?.id]);

  const selectSlot = (slot: AvailableSlot) => {
    update({
      // Derive the date from the slot itself, since in the soonest view no date
      // is selected in the strip.
      selectedDate: slot.startsAt.slice(0, 10),
      selectedSlot: slot,
      availableCoachIds: slot.coachIds ?? [],
      step: nextStep,
    });
  };

  // Group the soonest slots by day (already time-sorted from the API).
  const upcomingGroups: [string, AvailableSlot[]][] = (() => {
    const m = new Map<string, AvailableSlot[]>();
    for (const s of upcoming) {
      const k = s.startsAt.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return Array.from(m.entries());
  })();
  const visibleGroups = upcomingGroups.slice(0, SOONEST_DAYS_SHOWN);
  const hasMoreDays = upcomingGroups.length > visibleGroups.length;

  const typeName = state.selectedCategory?.title ?? "Open";
  const pinnedCoachName = state.pinnedCoachId
    ? state.coaches.find((c) => c.id === state.pinnedCoachId)?.name
    : null;

  const slotButtonClass =
    "py-3 px-4 text-sm font-medium text-charcoal bg-surface rounded-card shadow-card hover:shadow-elevated hover:bg-charcoal hover:text-cream transition-all duration-200";

  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-iris mb-4">
        {typeName}{pinnedCoachName ? ` · with ${pinnedCoachName}` : ""}
      </p>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        Pick a time
      </h2>
      <p className="text-text-secondary mb-10">
        All times shown in your local timezone.
      </p>

      {/* Date selector — led by a "Soonest" pill so the up-front view is one tap
          away after browsing a specific date. */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 -mx-2 px-2">
        <button
          onClick={() => setSelectedDate(null)}
          className={`flex flex-col items-center justify-center shrink-0 w-16 py-3 rounded-card transition-all duration-200 ${
            selectedDate === null
              ? "bg-charcoal text-cream"
              : "bg-surface shadow-card text-charcoal hover:shadow-elevated"
          }`}
        >
          <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] uppercase tracking-wider">Soonest</span>
        </button>
        {dates.map((d) => {
          const { day, date, month } = formatDateLabel(d);
          const isSelected = d === selectedDate;
          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`flex flex-col items-center shrink-0 w-16 py-3 rounded-card transition-all duration-200 ${
                isSelected
                  ? "bg-charcoal text-cream"
                  : "bg-surface shadow-card text-charcoal hover:shadow-elevated"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider">{day}</span>
              <span className="text-lg font-semibold">{date}</span>
              <span className="text-[10px] uppercase tracking-wider">{month}</span>
            </button>
          );
        })}
      </div>

      {/* Soonest-available view (default) */}
      {selectedDate === null && (
        <>
          {loadingUpcoming ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
            </div>
          ) : upcomingError ? (
            <p className="text-coral text-sm py-8 text-center">{upcomingError}</p>
          ) : upcomingGroups.length === 0 ? (
            <p className="text-text-secondary text-sm py-8 text-center">
              No openings in the next couple of weeks. Pick a date above to look further out.
            </p>
          ) : (
            <div className="space-y-8">
              {visibleGroups.map(([dateStr, daySlots]) => (
                <div key={dateStr}>
                  <p className="text-sm font-display font-semibold mb-3">{formatGroupLabel(dateStr)}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {daySlots.map((slot) => (
                      <button key={slot.startsAt} onClick={() => selectSlot(slot)} className={slotButtonClass}>
                        {formatTime(slot.startsAt)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {hasMoreDays && (
                <p className="text-text-secondary text-sm text-center pt-2">
                  Looking for a particular day? Pick a date above.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Single-date view */}
      {selectedDate !== null && (
        <>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-coral text-sm py-8 text-center">{error}</p>
          ) : slots.length === 0 ? (
            <p className="text-text-secondary text-sm py-8 text-center">
              No available slots on this date. Try another day.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {slots.map((slot) => (
                <button key={slot.startsAt} onClick={() => selectSlot(slot)} className={slotButtonClass}>
                  {formatTime(slot.startsAt)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
