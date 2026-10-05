"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { supportsWebGL } from "@/lib/three/webgl";

import { SceneSkeleton } from "./skeleton";

const XpCanvas = dynamic(() => import("./canvas").then((mod) => mod.XpCanvas), {
  ssr: false,
  loading: () => <SceneSkeleton className="absolute inset-0" />,
});

// GPU support never changes and supportsWebGL caches, so the snapshot is stable.
const noSubscription = () => () => {};
const unknownOnServer = () => undefined;

export type SceneProps = {
  children: ReactNode;
  /** Always rendered: visibly without a GPU, otherwise for screen readers. */
  fallback: ReactNode;
  /** Required unless `decorative`. */
  label?: string;
  decorative?: boolean;
  eager?: boolean;
  transparent?: boolean;
  className?: string;
};

export function Scene({
  children,
  fallback,
  label,
  decorative = false,
  eager = false,
  transparent = false,
  className = "",
}: SceneProps) {
  const container = useRef<HTMLDivElement>(null);
  const webgl = useSyncExternalStore(noSubscription, supportsWebGL, unknownOnServer);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager || visible) return;
    const node = container.current;
    if (!node) return;

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
        <XpCanvas
          fallback={fallback}
          transparent={transparent}
          aria-hidden
          tabIndex={-1}
          role="presentation"
        >
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
