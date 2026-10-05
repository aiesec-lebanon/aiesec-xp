const OFFICE_TIME_ZONE = "Asia/Beirut";

// en-US for the parts only: it abbreviates September as "Sep", like the calendar.
const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: OFFICE_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatOfficeTime(date: Date): string {
  const part = Object.fromEntries(PARTS.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${part.weekday} ${part.day} ${part.month}, ${part.hour}:${part.minute}`;
}

export function timeAgo(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  return `${Math.floor(hours / 24)} days ago`;
}
