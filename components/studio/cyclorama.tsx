import type { ReactNode } from "react";

// The set every member-facing screen is shot on: an infinite-white wall, a
// horizon line, a floor. It is one element rather than three because the horizon
// has to land on the same fraction of the frame on every screen -- a character
// standing on a floor that moved would read as a different room.

export function Cyclorama({
  floor = "28%",
  className = "",
  children,
}: {
  /** Height of the floor as a share of the frame. */
  floor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative isolate ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 bg-wall" style={{ bottom: floor }} />
        <div className="absolute inset-x-0 bottom-0 bg-floor" style={{ height: floor }} />
        <div className="absolute inset-x-0 h-0.5 bg-horizon" style={{ bottom: floor }} />
      </div>
      {children}
    </div>
  );
}
