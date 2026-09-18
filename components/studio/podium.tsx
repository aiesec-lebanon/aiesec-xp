"use client";

import { useEffect, useRef, useState } from "react";

import { Character, ContactShadow } from "./character";
import { beatFor, facingFor, useGroupExchange } from "./group-exchange";
import { GhostNumber } from "./motion";

// The top three, standing rather than listed. Height is the ranking: the winner
// is simply the tallest thing on the panel, which is legible before any numeral
// is read.
//
// The panel fills whatever height it is given and sizes the bodies to what is
// left after its own chrome. It used to be sized in fixed pixels, which put the
// name cards under the fold on a laptop -- the winner was on screen and nobody
// could read who they were. Nothing here decides how tall the podium is; the
// page does, and this fits into it.

export type PodiumPlace = {
  rank: 1 | 2 | 3;
  name: string;
  office: string | null;
  points: number;
  /** The member's chosen character, if it has been resolved. */
  characterId?: string;
};

/** Second stands to the left of first, third to its right. */
const COLUMN: Record<1 | 2 | 3, number> = { 1: 0, 2: -1, 3: 1 };

/** Each rank as a share of the winner's height, and where it sits in the row. */
const FORM = {
  1: { share: 1, shadow: 0.42, order: "order-2" },
  2: { share: 0.82, shadow: 0.36, order: "order-1" },
  3: { share: 0.76, shadow: 0.34, order: "order-3" },
} as const;

/** Never taller than the original design size, however much room there is. */
const MAX_BODY = 350;

/** Below this a body stops reading as a person. */
const MIN_BODY = 84;

/** Headroom over the winner for the crown. */
const CROWN_ROOM = 22;

/** A body's canvas plus the contact shadow under it, as a multiple of itself. */
const BODY_WITH_SHADOW = 1.12;

/** `CharacterStage` draws a body this much wider than it is tall. */
const ASPECT = 0.72;

/** The three bodies' combined width, as a multiple of the winner's height. */
const ROW_WIDTH = ASPECT * (FORM[1].share + FORM[2].share + FORM[3].share);

/** The stage's own padding plus the gaps between the three. */
const ROW_GUTTER = 40;

// A cheer puts the hands a long way above standing height, and the fit measures
// the bind pose -- at 0.9 the winner was photographed with her head cropped off.
const BODY_IN_FRAME = 0.72;

export function Crown() {
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-[-20px] h-[22px] w-[34px] -translate-x-1/2 bg-stage-re"
      style={{
        clipPath:
          "polygon(0% 100%, 0% 45%, 18% 68%, 32% 8%, 50% 55%, 68% 8%, 82% 68%, 100% 45%, 100% 100%)",
        boxShadow: "0 2px 4px rgba(23,22,20,.15)",
      }}
    />
  );
}

/**
 * The stage's own box, watched.
 *
 * Safe to observe the node itself: it is a flex child with `min-h-0` in a
 * column of a definite height, so what it gets is decided by the panel and not
 * by the bodies standing in it -- measuring cannot feed back into the measure.
 */
function useStageBox() {
  const stage = useRef<HTMLDivElement>(null);
  // A guess that looks right on the first paint; the observer corrects it
  // before anything but the entrance animation would notice.
  const [box, setBox] = useState({ width: 460, height: 380 });

  useEffect(() => {
    const node = stage.current;
    if (!node) return;

    const measure = () =>
      setBox({ width: node.clientWidth, height: node.clientHeight });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [stage, box] as const;
}

export function Podium({ places }: { places: PodiumPlace[] }) {
  const exchange = useGroupExchange(places.length);
  const [stage, box] = useStageBox();
  const columnOf = (index: number) => COLUMN[places[index]!.rank];

  // Whichever runs out first. Fitting the height alone was not enough: in a
  // narrow column three bodies are wider than the panel long before they are
  // taller than it, and the stage clips rather than scrolls. The height side
  // pays for the shadow under the winner and the crown over her, or the two of
  // them push the row past the stage they are standing in.
  const winner = Math.min(
    MAX_BODY,
    Math.max(
      MIN_BODY,
      Math.min(
        (box.height - CROWN_ROOM) / BODY_WITH_SHADOW,
        (box.width - ROW_GUTTER) / ROW_WIDTH
      )
    )
  );
  const leader = places.find((place) => place.rank === 1);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] bg-surface-raised shadow-e2">
      <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Top three
        </span>
      </div>

      <div
        ref={stage}
        className="relative flex min-h-0 flex-1 items-end justify-center gap-1 overflow-hidden bg-wall px-4"
      >
        {leader ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1">
            <GhostNumber>{Math.round(leader.points)}</GhostNumber>
          </div>
        ) : null}

        {/* Plain divs, not a list: the ranking a screen reader should read is
            the cards below, which carry the names and the scores. These are the
            same three people drawn. */}
        {places.map((place, index) => {
          const form = FORM[place.rank];
          const first = place.rank === 1;
          const body = Math.round(winner * form.share);

          return (
            <div
              key={place.name}
              className={`relative z-10 flex flex-col items-center ${form.order}`}
            >
              {first ? <Crown /> : null}
              <Character
                name={place.name}
                height={body}
                idle={first ? "bob" : "small"}
                idOverride={place.characterId}
                stage
                social
                heightFraction={BODY_IN_FRAME}
                mood="celebrate"
                // Second and third turn in towards the winner rather than all
                // three standing square to camera -- and towards whoever is
                // talking to them when the group has something to say.
                facing={facingFor(exchange, index, columnOf)}
                beat={beatFor(exchange, index)}
              />
              <ContactShadow
                className="-mt-1.5"
                width={Math.round(body * form.shadow)}
                height={Math.max(12, Math.round(body * 0.1))}
                opacity={first ? 0.17 : 0.14}
              />
            </div>
          );
        })}
      </div>

      <div className="h-0.5 shrink-0 bg-horizon" />
      <div className="h-5 shrink-0 bg-floor" />

      <ol className="flex shrink-0 items-stretch gap-2 px-4 pb-4 pt-3">
        {places.map((place) => (
          <li
            key={place.name}
            className={`min-w-0 flex-1 basis-0 rounded-[18px] bg-surface-raised px-2 py-3 text-center ${
              FORM[place.rank].order
            } ${place.rank === 1 ? "shadow-e3" : "shadow-e1"}`}
          >
            <p
              className={`tabular text-lg font-bold leading-none ${
                place.rank === 1 ? "text-re-ink" : "text-ink-faint"
              }`}
            >
              {place.rank}
            </p>
            <p className="mt-1 truncate text-[13px] font-semibold text-ink">{place.name}</p>
            <p className="truncate text-[11px] text-ink-secondary">
              {place.office ?? "No office"}
            </p>
            <p
              className={`tabular mt-1.5 font-bold leading-none text-ink ${
                place.rank === 1 ? "text-[26px]" : "text-[21px]"
              }`}
            >
              {place.points}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
