"use client";

import { animate, m, useInView } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";

// Every animated primitive this direction uses, in one client module. `m` rather
// than `motion` because the provider mounts LazyMotion in strict mode: the
// animation runtime arrives after first paint, and strict mode makes that saving
// impossible to undo by accident.
//
// Nothing here consults the operating system's prefers-reduced-motion. The
// member's own switch is the trigger (D-46), read through useReduceMotion.

const EASE = [0.2, 0.8, 0.25, 1] as const;

/** The page's entrance: content settles down onto the paper, once, in order. */
export function Rise({
  children,
  delay = 0,
  distance = 14,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduceMotion = useReduceMotion();

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      className={className}
      style={style}
    >
      {children}
    </m.div>
  );
}

/** A card that lifts under the pointer. Used for the floor chips and list rows. */
export function Lift({
  children,
  className,
  lift = -4,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  lift?: number;
  as?: "div" | "li";
}) {
  const reduceMotion = useReduceMotion();
  const Component = Tag === "li" ? m.li : m.div;

  return (
    <Component
      whileHover={reduceMotion ? undefined : { y: lift, boxShadow: "var(--elevation-2)" }}
      transition={{ duration: 0.3, ease: EASE }}
      className={className}
    >
      {children}
    </Component>
  );
}

/**
 * A score that counts up to itself once, when it first comes into view.
 *
 * The DOM is written directly rather than through state, because these are the
 * largest numerals on the page and re-rendering a React tree sixty times a
 * second to move one of them is the wrong trade. The final value is the server's
 * text before any of this runs, so it is correct without JavaScript.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 1.1,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const reduceMotion = useReduceMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView || reduceMotion) return;

    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => {
        node.textContent = latest.toFixed(decimals);
      },
    });

    return () => controls.stop();
  }, [inView, reduceMotion, value, decimals, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}
    </span>
  );
}

/** A bar that grows out of the floor when the chart scrolls into view. */
export function GrowBar({
  height,
  colour,
  delay = 0,
}: {
  /** Share of the track, 0 to 1. */
  height: number;
  colour: string;
  delay?: number;
}) {
  const reduceMotion = useReduceMotion();

  return (
    <m.div
      initial={reduceMotion ? false : { scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      style={{
        height: `${Math.max(height * 100, 2)}%`,
        background: colour,
        transformOrigin: "bottom",
      }}
      className="w-full max-w-[34px] rounded-t-lg rounded-b-[3px]"
    />
  );
}

/**
 * The stage's ghost numeral, sized to the frame it sits in.
 *
 * It is set in the numeral face at 400px in the comps, which overflows a narrow
 * viewport; measuring the frame and scaling to it keeps the proportion the
 * design depends on at every width.
 */
export function GhostNumber({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => setScale(Math.min(1, node.offsetWidth / 1440));
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 select-none">
      <div
        className="tabular text-center font-extrabold leading-[0.82] text-ghost"
        style={{ fontSize: `${400 * scale}px` }}
      >
        {children}
      </div>
    </div>
  );
}
