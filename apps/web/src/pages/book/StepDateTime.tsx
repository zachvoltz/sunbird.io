import { useState, useEffect } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { AvailableSlot } from "@sunbird/shared";
import type { BookingState } from "./BookPage";

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
  nextStep: BookingState["step"];
};

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

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function StepDateTime({ state, update, nextStep }: Props) {
  const [dates] = useState(() => generateDates(30));
  const [selectedDate, setSelectedDate] = useState<string | null>(state.selectedDate);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setError(null);
    apiFetch<{ data: AvailableSlot[] }>(`/api/availability?date=${selectedDate}`)
      .then((res) => setSlots(res.data))
      .catch((err) => {
        if (err instanceof ApiError) setError(err.body.error);
        else setError("Failed to load availability");
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  const selectSlot = (slot: AvailableSlot) => {
    update({
      selectedDate,
      selectedSlot: slot,
      step: nextStep,
    });
  };

  const typeName = state.selectedType?.title ?? "Open";
  const categoryName =
    state.notSureCategory
      ? "Open"
      : state.selectedType?.categories.find(
          (c) => c.id === state.selectedCategoryId,
        )?.title ?? "Open";

  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-iris mb-4">
        {typeName} {categoryName !== "Open" ? `/ ${categoryName}` : ""}
      </p>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        Pick a date and time
      </h2>
      <p className="text-text-secondary mb-10">
        All times shown in Central Time (Nashville).
      </p>

      {/* Date selector */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 -mx-2 px-2">
        {dates.map((d) => {
          const { day, date, month } = formatDateLabel(d);
          const isSelected = d === selectedDate;
          const dayOfWeek = new Date(d + "T12:00:00").getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              disabled={isWeekend}
              className={`flex flex-col items-center shrink-0 w-16 py-3 rounded-card transition-all duration-200 ${
                isSelected
                  ? "bg-charcoal text-cream"
                  : isWeekend
                    ? "text-text-secondary/30 cursor-not-allowed"
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

      {/* Time slots */}
      {selectedDate && (
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  onClick={() => selectSlot(slot)}
                  className="py-3 px-4 text-sm font-medium text-charcoal bg-surface rounded-card shadow-card hover:shadow-elevated hover:bg-charcoal hover:text-cream transition-all duration-200"
                >
                  {formatTime(slot.startsAt)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {!selectedDate && (
        <p className="text-text-secondary text-sm py-8 text-center">
          Select a date above to see available times.
        </p>
      )}
    </>
  );
}
