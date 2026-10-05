"use client";

import { animate, m, useInView } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";

const EASE = [0.2, 0.8, 0.25, 1] as const;

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

export function Lift({
  children,
  className,
  lift = -4,
  as: Tag = "div",
  layout = false,
}: {
  children: ReactNode;
  className?: string;
  lift?: number;
  as?: "div" | "li";
  layout?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const Component = Tag === "li" ? m.li : m.div;

  return (
    <Component
      layout={layout && !reduceMotion ? "position" : false}
      whileHover={reduceMotion ? undefined : { y: lift, boxShadow: "var(--elevation-2)" }}
      transition={{
        duration: 0.3,
        ease: EASE,
        layout: { type: "spring", stiffness: 380, damping: 34 },
      }}
      className={className}
    >
      {children}
    </Component>
  );
}

// Writes the DOM directly to avoid re-rendering 60x/s; the server text is already the final value.
export function CountUp({
  value,
  decimals = 0,
  format,
  duration = 1.1,
  className,
}: {
  value: number;
  decimals?: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
}) {
  const settled = format ? format(value) : value.toFixed(decimals);
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
      onComplete: () => {
        node.textContent = settled;
      },
    });

    return () => controls.stop();
  }, [inView, reduceMotion, value, decimals, duration, settled]);

  return (
    <span ref={ref} className={className}>
      {settled}
    </span>
  );
}

export function GrowBar({
  height,
  colour,
  delay = 0,
}: {
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
