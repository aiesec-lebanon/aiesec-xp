"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";

// Lazy-loaded; `strict` throws on `motion.*` so the bundle saving can't regress.
// domMax (not domAnimation) because leaderboard rows need layout projection.
const loadDomFeatures = () => import("motion/react").then((mod) => mod.domMax);

const ReduceMotionContext = createContext(false);

// Deliberately ignores the OS preference; only the member's own switch counts.
export function useReduceMotion(): boolean {
  return useContext(ReduceMotionContext);
}

// three.js can't read MotionConfig, so the same value is also exposed via context.
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
