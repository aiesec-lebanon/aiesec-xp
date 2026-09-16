"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { supportsWebGL } from "@/lib/three/webgl";

import { SceneSkeleton } from "./skeleton";

// three, drei and the scene graph are a large client bundle that most of the
// dashboard never needs, so they load on demand and never on the server.
const XpCanvas = dynamic(() => import("./canvas").then((mod) => mod.XpCanvas), {
  ssr: false,
  loading: () => <SceneSkeleton className="absolute inset-0" />,
});

// Whether this device has a GPU never changes, so there is nothing to subscribe
// to -- but it also cannot be known on the server, and supportsWebGL caches, so
// the snapshot stays stable across renders.
const noSubscription = () => () => {};
const unknownOnServer = () => undefined;

export type SceneProps = {
  children: ReactNode;
  /**
   * The same information in plain DOM. Always rendered -- visibly when there is
   * no GPU, and to assistive technology otherwise -- because a <canvas> is
   * invisible to a screen reader and unreachable by keyboard.
   */
  fallback: ReactNode;
  /** Required unless `decorative`: the scene's accessible name. */
  label?: string;
  /** A scene that carries no information of its own; its fallback is dropped. */
  decorative?: boolean;
  /** Mount without waiting for the viewport, for a scene above the fold. */
  eager?: boolean;
  className?: string;
};

export function Scene({
  children,
  fallback,
  label,
  decorative = false,
  eager = false,
  className = "",
}: SceneProps) {
  const container = useRef<HTMLDivElement>(null);
  const webgl = useSyncExternalStore(noSubscription, supportsWebGL, unknownOnServer);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager || visible) return;
    const node = container.current;
    if (!node) return;

    // Booting a WebGL context for a canvas that is still below the fold costs a
    // phone real memory and battery before the member has scrolled to it.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, visible]);

  if (webgl === false) return <>{fallback}</>;

  return (
    <div ref={container} className={`relative ${className}`}>
      {webgl && visible ? (
        <XpCanvas fallback={fallback} aria-hidden tabIndex={-1} role="presentation">
          {children}
        </XpCanvas>
      ) : (
        <SceneSkeleton className="absolute inset-0" />
      )}
      {decorative ? null : (
        <div className="sr-only" role="img" aria-label={label}>
          {fallback}
        </div>
      )}
    </div>
  );
}
