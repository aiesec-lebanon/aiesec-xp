"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { formatPoints } from "@/lib/design/points";
import { DIRECTION_LABEL, PROGRAMME_LABEL } from "@/lib/scoring/labels";

export type PointsGuide = {
  periodLabel: string;
  aplPoints: number;
  apdPoints: number;
  rePoints: number;
  productWeights: Record<string, number>;
  directionWeights: Record<string, number>;
  /** Most senior first, only roles that earn something. */
  roleShares: { role: string; share: number }[];
};

const HEADING = "font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted";

export function PointsInfo({ guide }: { guide: PointsGuide }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const stages = [
    { label: "Application", short: "APL", points: guide.aplPoints, ink: "text-apl-ink", wash: "bg-apl-wash" },
    { label: "Approval", short: "APD", points: guide.apdPoints, ink: "text-apd-ink", wash: "bg-apd-wash" },
    { label: "Realization", short: "RE", points: guide.rePoints, ink: "text-re-ink", wash: "bg-re-wash" },
  ];

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="How points are given"
        title="How points are given"
        onClick={() => setOpen((current) => !current)}
        className={`grid size-10 place-items-center rounded-full font-display text-[15px] font-bold italic transition-colors ${
          open
            ? "bg-ink text-surface"
            : "bg-surface-raised text-ink-secondary shadow-e1 hover:bg-surface-sunken hover:text-ink"
        }`}
      >
        i
      </button>

      <AnimatePresence>
        {open ? (
          <m.div
            id={panelId}
            role="dialog"
            aria-label="How points are given"
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.25, 1] }}
            className="absolute right-0 top-full z-30 mt-2 flex max-h-[70vh] w-[min(360px,calc(100vw-3rem))] origin-top-right flex-col gap-4 overflow-y-auto rounded-[22px] bg-surface-raised p-5 text-left shadow-e3"
          >
            <div>
              <p className="text-sm font-semibold text-ink">How points are given</p>
              <p className="mt-0.5 text-xs text-ink-secondary">{guide.periodLabel}</p>
            </div>

            <div className="flex gap-2">
              {stages.map((stage) => (
                <div key={stage.short} className={`flex flex-1 flex-col items-center rounded-2xl py-2.5 ${stage.wash}`}>
                  <span className={`tabular text-2xl font-bold leading-none ${stage.ink}`}>
                    {formatPoints(stage.points)}
                  </span>
                  <span className={`mt-1 text-[10px] font-bold tracking-[0.06em] ${stage.ink}`}>
                    {stage.short}
                  </span>
                  <span className="sr-only"> points for each {stage.label.toLowerCase()}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <p className={HEADING}>Multiplied by</p>
              <WeightRow
                label="Programme"
                weights={Object.entries(guide.productWeights).map(([id, weight]) => ({
                  label: PROGRAMME_LABEL[id] ?? `Programme ${id}`,
                  weight,
                }))}
              />
              <WeightRow
                label="Direction"
                weights={Object.entries(guide.directionWeights).map(([key, weight]) => ({
                  label: DIRECTION_LABEL[key] ?? key,
                  weight,
                }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className={HEADING}>Shared EPs</p>
              <p className="text-xs text-ink-secondary">
                The EP&rsquo;s main manager gets all of its points and counts each stage as 1.
                Everyone else on it gets their role&rsquo;s share of the points and counts that
                part of the stage, so 15% counts as 0.15.
              </p>
              {guide.roleShares.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {guide.roleShares.map((row) => (
                    <span
                      key={row.role}
                      className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-semibold text-ink-secondary"
                    >
                      {row.role} <span className="tabular text-ink">{formatPoints(row.share)}%</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <p className="text-xs text-ink-muted">
              A lost approval or realization takes back what that stage paid.
            </p>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function WeightRow({ label, weights }: { label: string; weights: { label: string; weight: number }[] }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <span className="flex flex-wrap justify-end gap-1.5">
        {weights.map((entry) => (
          <span
            key={entry.label}
            className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-semibold text-ink-secondary"
          >
            {entry.label} <span className="tabular text-ink">×{formatPoints(entry.weight)}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
