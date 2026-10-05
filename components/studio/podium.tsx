"use client";

import { useEffect, useRef, useState } from "react";

import { formatPoints } from "@/lib/design/points";

import { Character, ContactShadow } from "./character";
import { beatFor, facingFor, useGroupExchange } from "./group-exchange";
import { GhostNumber } from "./motion";
import { useMoodFlourish } from "./mood-flourish";

export type PodiumPlace = {
  rank: 1 | 2 | 3;
  name: string;
  office: string | null;
  points: number;
  characterId?: string;
};

const COLUMN: Record<1 | 2 | 3, number> = { 1: 0, 2: -1, 3: 1 };

const FORM = {
  1: { share: 1, shadow: 0.42, order: "order-2" },
  2: { share: 0.82, shadow: 0.36, order: "order-1" },
  3: { share: 0.76, shadow: 0.34, order: "order-3" },
} as const;

const MAX_BODY = 350;
const MIN_BODY = 84;
const CROWN_ROOM = 22;
const BODY_WITH_SHADOW = 1.12;
const ASPECT = 0.72;
const ROW_WIDTH = ASPECT * (FORM[1].share + FORM[2].share + FORM[3].share);
const ROW_GUTTER = 40;

// The fit measures the bind pose, but a cheer raises the hands well above it.
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

// Safe to observe: a `min-h-0` flex child is sized by the panel, not by the bodies in it.
function useStageBox() {
  const stage = useRef<HTMLDivElement>(null);
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
      <div
        ref={stage}
        className="relative flex min-h-0 flex-1 items-end justify-center gap-1 overflow-hidden bg-wall px-4"
      >
        {leader ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1">
            <GhostNumber>{formatPoints(leader.points)}</GhostNumber>
          </div>
        ) : null}

        {/* Not a list: screen readers get the ranking from the cards below. */}
        {places.map((place, index) => (
          <PodiumBody
            key={place.name}
            place={place}
            body={Math.round(winner * FORM[place.rank].share)}
            facing={facingFor(exchange, index, columnOf)}
            beat={beatFor(exchange, index)}
          />
        ))}
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
              {place.office ?? "No LC"}
            </p>
            <p
              className={`tabular mt-1.5 font-bold leading-none text-ink ${
                place.rank === 1 ? "text-[26px]" : "text-[21px]"
              }`}
            >
              {formatPoints(place.points)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PodiumBody({
  place,
  body,
  facing,
  beat,
}: {
  place: PodiumPlace;
  body: number;
  facing: number;
  beat: ReturnType<typeof beatFor>;
}) {
  const first = place.rank === 1;
  const form = FORM[place.rank];

  const mood = useMoodFlourish("celebrate", {
    active: first,
    moods: ["dancing"],
    hold: [6, 11],
    gap: [12, 26],
  });

  return (
    <div className={`relative z-10 flex flex-col items-center ${form.order}`}>
      {first ? <Crown /> : null}
      <Character
        name={place.name}
        height={body}
        idle={first ? "bob" : "small"}
        idOverride={place.characterId}
        stage
        social
        heightFraction={BODY_IN_FRAME}
        mood={mood}
        facing={facing}
        beat={beat}
      />
      <ContactShadow
        className="-mt-1.5"
        width={Math.round(body * form.shadow)}
        height={Math.max(12, Math.round(body * 0.1))}
        opacity={first ? 0.17 : 0.14}
      />
    </div>
  );
}
