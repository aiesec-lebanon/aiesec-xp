"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";

import { GameIcon, ICON, STAGE_ICON } from "@/components/icons";
import { useReduceMotion } from "@/components/motion/motion-provider";
import { CountUp, Lift } from "./motion";

// The floor chips. One number is large on the stage above; these four carry the
// rest, and open only when asked -- which is also where the audit trail lives
// (Architecture.md 9), since a score nobody can expand is a score nobody trusts.

export type ChipEvent = { stage: string; product: string; date: string; points: string };

export type Chip = {
  key: string;
  kind: "stage" | "pace" | "reward";
  accent: string;
  ink: string;
  wash?: string;
  label: string;
  value: number | null;
  valueSuffix?: string;
  caption: string;
  /** Replaces the numeral, for the reward chip's title. */
  headline?: string;
  events?: ChipEvent[];
  ladder?: { label: string; detail: string; earned: boolean }[];
  /** Said instead of a drawer when there is nothing behind the number yet. */
  empty?: string;
};

const EASE = [0.2, 0.8, 0.25, 1] as const;

function chipIcon(chip: Chip) {
  if (chip.kind === "reward") return ICON.reward;
  if (chip.kind === "pace") return ICON.pace;
  return STAGE_ICON[chip.key] ?? ICON.pace;
}

export function StatChips({ chips }: { chips: Chip[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();
  const opened = chips.find((chip) => chip.key === open) ?? null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-3.5">
        {chips.map((chip) => {
          const isOpen = chip.key === open;
          return (
            <Lift key={chip.key} className="rounded-[20px]">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`chip-drawer-${chip.key}`}
                onClick={() => setOpen(isOpen ? null : chip.key)}
                style={{ background: chip.wash ?? "var(--surface-raised)" }}
                className={`h-full w-[190px] rounded-[20px] px-5 py-4.5 text-left shadow-e1 transition-shadow ${
                  chip.kind === "reward" || chip.kind === "pace" ? "w-[236px]" : ""
                } ${isOpen ? "ring-2 ring-ink" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <GameIcon
                    icon={chipIcon(chip)}
                    decorative
                    className="size-3.5"
                    style={{ color: chip.accent }}
                  />
                  <span
                    style={{ color: chip.ink }}
                    className="text-xs font-semibold uppercase tracking-[0.04em]"
                  >
                    {chip.label}
                  </span>
                </span>

                {chip.headline ? (
                  <span className="mt-2.5 block text-[17px] font-semibold text-ink">
                    {chip.headline}
                  </span>
                ) : (
                  <span className="mt-2 flex items-baseline gap-1.5">
                    <span className="tabular text-[42px] font-bold leading-[1.05] text-ink">
                      {chip.value === null ? "—" : <CountUp value={chip.value} />}
                    </span>
                    {chip.valueSuffix ? (
                      <span className="text-sm font-semibold text-ink-secondary">
                        {chip.valueSuffix}
                      </span>
                    ) : null}
                  </span>
                )}

                <span
                  style={{ color: chip.kind === "reward" ? "#6a4e0c" : "var(--ink-secondary)" }}
                  className="mt-0.5 block text-[13px]"
                >
                  {chip.caption}
                </span>
              </button>
            </Lift>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {opened ? (
          <m.div
            key={opened.key}
            id={`chip-drawer-${opened.key}`}
            initial={reduceMotion ? false : { opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="w-full max-w-[1000px] overflow-hidden"
          >
            {/* Capped and scrolled rather than free to grow: the dashboard is
                sized to the viewport, and a twelve-row trail that pushed the
                body off the top of the set would cost more than it showed. */}
            <div className="max-h-[34vh] overflow-y-auto rounded-[20px] bg-surface-raised p-6 shadow-e2">
              <ChipDrawer chip={opened} />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ChipDrawer({ chip }: { chip: Chip }) {
  if (chip.ladder) {
    return (
      <ul className="flex flex-col gap-2.5">
        {chip.ladder.map((step) => (
          <li
            key={step.label}
            className="flex items-baseline justify-between gap-4 border-b border-line pb-2.5 last:border-0 last:pb-0"
          >
            <span className="text-sm font-semibold text-ink">
              {step.label}
              {step.earned ? <span className="ml-2 text-apd-ink">earned</span> : null}
            </span>
            <span className="text-[13px] text-ink-secondary">{step.detail}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (!chip.events || chip.events.length === 0) {
    return <p className="text-[13px] text-ink-secondary">{chip.empty ?? "Nothing here yet."}</p>;
  }

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          <th className="pb-2 font-normal">Stage</th>
          <th className="pb-2 font-normal">Product</th>
          <th className="pb-2 font-normal">When</th>
          <th className="pb-2 text-right font-normal">Points</th>
        </tr>
      </thead>
      <tbody>
        {chip.events.map((event, index) => (
          <tr key={index} className="border-t border-line">
            <td className="py-2 text-[13px] font-semibold text-ink">{event.stage}</td>
            <td className="py-2 text-[13px] text-ink-secondary">{event.product}</td>
            <td className="py-2 text-[13px] text-ink-secondary">{event.date}</td>
            <td className="tabular py-2 text-right text-[13px] font-bold text-ink">
              {event.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
