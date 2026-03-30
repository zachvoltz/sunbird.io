import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { BookingPublic } from "@sunbird/shared";
import type { BookingState } from "./BookPage";

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
};

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function StepConfirm({ state, update }: Props) {
  const [note, setNote] = useState(state.studentNote);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeName = state.selectedType?.title ?? "Open";
  const categoryName =
    state.notSureCategory
      ? "Open"
      : state.selectedType?.categories.find(
          (c) => c.id === state.selectedCategoryId,
        )?.title ?? "Open";
  const slot = state.selectedSlot!;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch<{ data: BookingPublic }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          lessonTypeId: state.selectedType?.id ?? state.lessonTypes[0]?.id,
          lessonCategoryId: state.selectedCategoryId,
          startsAt: slot.startsAt,
          studentNote: note || undefined,
        }),
      });

      update({
        studentNote: note,
        bookingId: res.data.id,
        step: "success",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.error);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        Confirm your booking
      </h2>
      <p className="text-text-secondary mb-10">
        Review the details below and book when you're ready.
      </p>

      <div className="bg-surface rounded-card shadow-card p-8 mb-8">
        <div className="space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] uppercase tracking-[0.1em] text-text-secondary">
              Lesson
            </span>
            <span className="font-display font-semibold">{typeName}</span>
          </div>
          <hr className="editorial-rule" />
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] uppercase tracking-[0.1em] text-text-secondary">
              Focus
            </span>
            <span className="font-medium">{categoryName}</span>
          </div>
          <hr className="editorial-rule" />
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] uppercase tracking-[0.1em] text-text-secondary">
              Date
            </span>
            <span className="font-medium">{formatDate(slot.startsAt)}</span>
          </div>
          <hr className="editorial-rule" />
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] uppercase tracking-[0.1em] text-text-secondary">
              Time
            </span>
            <span className="font-medium">
              {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-[11px] uppercase tracking-[0.1em] text-text-secondary mb-2">
          Anything you'd like to work on? (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="A song I'm stuck on, a vocal technique, a feeling I can't name..."
          maxLength={500}
          rows={3}
          className="w-full px-4 py-3 text-sm bg-surface border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="text-coral text-sm mb-4">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full text-[14px] font-medium text-cream bg-iris py-3 rounded-card hover:bg-iris-hover transition-all duration-300 disabled:opacity-50"
      >
        {submitting ? "Booking..." : "Confirm booking"}
      </button>
    </>
  );
}
