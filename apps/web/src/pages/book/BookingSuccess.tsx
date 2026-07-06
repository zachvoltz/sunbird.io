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

// UTC basic format for calendar links: 20260625T130000Z
function calStamp(isoStr: string): string {
  return new Date(isoStr).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function BookingSuccess({ state }: { state: BookingState }) {
  const slot = state.selectedSlot!;
  const typeName = state.selectedCategory?.title ?? "Open";
  const coach = state.coaches.find((c) => c.id === state.selectedCoachId);
  const isOnline = state.mode === "ONLINE";
  const sessionPath = state.bookingId ? `/my-bookings/${state.bookingId}` : "/my-bookings";

  // Calendar invite details. For online lessons we point the location/notes at
  // the in-app session page (where the student joins the call); for in-person we
  // use the coach's address.
  const title = `${typeName} lesson${coach ? ` with ${coach.name}` : ""}`;
  const sessionUrl =
    state.bookingId && typeof window !== "undefined"
      ? `${window.location.origin}${sessionPath}`
      : undefined;
  const location = isOnline
    ? "Online"
    : coach?.sessionAddress || "At the studio";
  const details =
    `Your ${typeName} lesson${coach ? ` with ${coach.name}` : ""}.` +
    (isOnline && sessionUrl ? `\n\nJoin your lesson: ${sessionUrl}` : "");

  const gcalUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${calStamp(slot.startsAt)}/${calStamp(slot.endsAt)}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(location)}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sunbird//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${state.bookingId ?? slot.startsAt}@sunbird`,
    `DTSTAMP:${calStamp(slot.startsAt)}`,
    `DTSTART:${calStamp(slot.startsAt)}`,
    `DTEND:${calStamp(slot.endsAt)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;

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

      {/* Add to calendar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-charcoal border border-charcoal/20 px-5 py-2.5 rounded-card hover:border-charcoal/40 transition-colors tracking-wide"
        >
          Add to Google Calendar
        </a>
        <a
          href={icsHref}
          download={`${typeName.toLowerCase().replace(/\s+/g, "-")}-lesson.ics`}
          className="text-[13px] font-medium text-charcoal border border-charcoal/20 px-5 py-2.5 rounded-card hover:border-charcoal/40 transition-colors tracking-wide"
        >
          Download .ics
        </a>
      </div>

      {/* Online lessons: point the student at where they'll join. */}
      {isOnline && (
        <p className="text-[13px] text-text-secondary mb-8 max-w-md mx-auto">
          This is an online lesson — you'll join the video call from{" "}
          <Link to={sessionPath} className="font-medium text-iris hover:text-iris-hover">
            your session page
          </Link>
          , which opens 15 minutes before the start.
        </p>
      )}

      <p className="font-handwritten text-xl text-gold mb-12">
        Come ready to work. Come ready to play.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to={sessionPath}
          className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
        >
          {state.bookingId ? "View this lesson" : "View my bookings"}
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
