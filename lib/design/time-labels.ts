// Moments shown to an admin: when a sync last ran, when hackathon mode ends.
// Every other date in the product is a UTC calendar day (lib/design/calendar.ts);
// these carry a time of day, which only reads correctly in the office's zone.

const OFFICE_TIME_ZONE = "Asia/Beirut";

// en-US for the parts only, because it abbreviates September as "Sep", like
// the calendar does; the order is composed below, on a 24-hour clock.
const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: OFFICE_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Sun 27 Sep, 18:00", Beirut time. */
export function formatOfficeTime(date: Date): string {
  const part = Object.fromEntries(PARTS.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${part.weekday} ${part.day} ${part.month}, ${part.hour}:${part.minute}`;
}

/** "just now", "4 min ago", "5 h ago", "3 days ago". */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;

  return `${Math.floor(hours / 24)} days ago`;
}
