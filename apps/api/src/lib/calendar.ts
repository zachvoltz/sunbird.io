// UTC basic format for calendar links: 20260707T090000Z
function calStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Prefilled Google Calendar "add event" link. Mirrors the one the booking
// success screen builds client-side (BookingSuccess.tsx), so the email and the
// on-screen offer stay in sync.
export function googleCalendarUrl(opts: {
  title: string;
  start: Date;
  end: Date;
  details?: string;
  location?: string;
}): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${calStamp(opts.start)}/${calStamp(opts.end)}`,
  });
  if (opts.details) p.set("details", opts.details);
  if (opts.location) p.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
