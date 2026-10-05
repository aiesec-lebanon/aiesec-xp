import type { ReactNode } from "react";

export function Cyclorama({
  floor = "28%",
  className = "",
  children,
}: {
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
