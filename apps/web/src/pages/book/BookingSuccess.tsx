import { Link } from "react-router-dom";
import type { BookingState } from "./BookPage";

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BookingSuccess({ state }: { state: BookingState }) {
  const slot = state.selectedSlot!;
  const typeName = state.selectedCategory?.title ?? "Open";

  return (
    <div className="text-center py-12">
      <div className="inline-block mb-8">
        <div className="w-16 h-16 rounded-full bg-sage/20 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        You're booked.
      </h2>
      <p className="text-text-secondary mb-8 max-w-md mx-auto">
        {typeName} lesson on {formatDate(slot.startsAt)} at{" "}
        {formatTime(slot.startsAt)}. A confirmation email is on its way.
      </p>

      <p className="font-handwritten text-xl text-gold mb-12">
        Come ready to work. Come ready to play.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/my-bookings"
          className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
        >
          View my bookings
        </Link>
        <Link
          to="/"
          className="text-[13px] font-medium text-text-secondary px-6 py-2.5 hover:text-charcoal transition-colors tracking-wide"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
