"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";

// The full DOM feature set -- including layout animation, which the FLIP rank
// transitions need -- is loaded, but only after first paint, which keeps the
// animation runtime out of the initial bundle on a leaderboard most members
// open on a phone. `strict` makes the trade-off enforceable: it throws on a
// `motion.*` component, so the saving cannot be silently undone later.
const loadDomFeatures = () => import("motion/react").then((mod) => mod.domMax);

const ReduceMotionContext = createContext(false);

/**
 * Whether this member asked for less motion. False for everyone who has not,
 * including everyone whose operating system says otherwise -- see D-46 and
 * lib/design/motion-preference.ts.
 */
export function useReduceMotion(): boolean {
  return useContext(ReduceMotionContext);
}

// The context carries the same value to three.js and Recharts, which cannot read
// Motion's own config, so one switch governs every animated surface.
export function MotionProvider({
  reduceMotion,
  children,
}: {
  reduceMotion: boolean;
  children: ReactNode;
}) {
  return (
    <ReduceMotionContext value={reduceMotion}>
      <LazyMotion features={loadDomFeatures} strict>
        <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>{children}</MotionConfig>
      </LazyMotion>
    </ReduceMotionContext>
  );
}
