"use client";

import { useEffect, useRef, useState } from "react";

import { Character, ContactShadow } from "./character";
import { beatFor, facingFor, useGroupExchange } from "./group-exchange";
import { Rise } from "./motion";

// The top three, standing rather than listed. Height is the ranking: the winner
// is simply the tallest thing on the page, which is legible before any numeral
// is read.
//
// The bodies are sized in pixels because a canvas needs pixels, and at the
// design sizes below the whole block runs to about 550px. Under a page header
// and two rows of filters that put the name and points cards under the fold on
// a laptop -- the winner was on screen and nobody could read who they were. So
// the bodies shrink to whatever height is actually left. The cards do not: they
// carry the names, which is the part that has to stay legible.

export type PodiumPlace = {
  rank: 1 | 2 | 3;
  name: string;
  office: string | null;
  points: number;
  /** The member's chosen character, if it has been resolved. */
  characterId?: string;
};

const FORM = {
  1: { body: 350, frame: 360, card: 200, shadow: 220, order: "order-1 sm:order-2" },
  2: { body: 288, frame: 296, card: 170, shadow: 190, order: "order-2 sm:order-1" },
  3: { body: 265, frame: 273, card: 170, shadow: 180, order: "order-3" },
} as const;

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

// Where each rank stands on screen, which is not the order the data arrives in:
// second is laid out to the left of first, third to its right.
const COLUMN: Record<1 | 2 | 3, number> = { 1: 0, 2: -1, 3: 1 };

/**
 * What the bodies do not get: the contact shadow, the name card, and the
 * floating dock, which is sticky and was sitting straight over the winner's
 * name -- first place was on screen and unreadable.
 */
const RESERVED_BELOW = 340;

/** Shrinking past this stops reading as a person and starts reading as a bug. */
const MIN_SCALE = 0.4;

/**
 * How much of its design height the podium can actually have.
 *
 * Measured from the podium's own offset down the document rather than from a
 * guess about the header, because the filters above it wrap on a narrow screen
 * and change height when they do. The observer catches that wrap, and the
 * listener catches a viewport that changes height without the document doing so.
 */
function useFitScale() {
  const frame = useRef<HTMLOListElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function measure() {
      const node = frame.current;
      if (!node) return;

      // Offset within the document, not the viewport: a resize after scrolling
      // would otherwise measure from wherever the page happens to sit.
      const top = node.getBoundingClientRect().top + window.scrollY;
      const available = window.innerHeight - top - RESERVED_BELOW;
      setScale(Math.min(1, Math.max(MIN_SCALE, available / FORM[1].frame)));
    }

    measure();
    window.addEventListener("resize", measure);

    const observer = new ResizeObserver(measure);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, []);

  return [frame, scale] as const;
}

export function Podium({ places }: { places: PodiumPlace[] }) {
  const exchange = useGroupExchange(places.length);
  const [frame, scale] = useFitScale();
  const columnOf = (index: number) => COLUMN[places[index]!.rank];

  return (
    <ol
      ref={frame}
      className="flex flex-wrap items-end justify-center gap-8 sm:gap-16"
    >
      {places.map((place, index) => {
        const form = FORM[place.rank];
        const first = place.rank === 1;
        const body = Math.round(form.body * scale);
        const frameHeight = Math.round(form.frame * scale);

        return (
          <Rise
            key={place.name}
            delay={0.1 + index * 0.08}
            style={{ width: `min(100%, ${form.card + 50}px)` }}
            className={`flex flex-col items-center ${form.order}`}
          >
            <div
              className="relative flex items-end justify-center"
              style={{ height: frameHeight }}
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
            </div>

            <ContactShadow
              width={Math.round(form.shadow * scale)}
              height={Math.round((first ? 38 : 32) * scale)}
              opacity={first ? 0.17 : 0.14}
            />

            <div
              style={{ width: form.card }}
              className={`-mt-2 rounded-[18px] bg-surface-raised p-4 text-center ${
                first ? "shadow-e3" : "shadow-e2"
              }`}
            >
              <p
                className={`tabular text-2xl font-bold ${first ? "text-re-ink" : "text-ink-faint"}`}
              >
                {place.rank}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink">{place.name}</p>
              <p className="text-xs text-ink-secondary">{place.office ?? "No office"}</p>
              <p className="tabular mt-2 text-3xl font-bold text-ink">{place.points}</p>
            </div>
          </Rise>
        );
      })}
    </ol>
  );
}
