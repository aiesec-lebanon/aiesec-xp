"use client";

import { useReduceMotion } from "@/components/motion/motion-provider";

// Architecture.md 9: skeletons, never spinners. The shimmer is itself motion, so
// it follows the switch too -- a member who reduced motion gets the plate
// without the sweep.
export function SceneSkeleton({ className = "" }: { className?: string }) {
  const reduceMotion = useReduceMotion();

  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-xl bg-surface-raised ${className}`}
    >
      {reduceMotion ? null : (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      )}
    </div>
  );
}
