"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { CharacterBeat, CharacterMood } from "@/lib/design/character";

import { ContactShadow } from "./character";
import { HeroBeatScope, HeroCharacter } from "./hero-beat";

// The dashboard's stage, sized to the room the page has left rather than to a
// number picked at design time. 440px is what this was drawn at and it is still
// the ceiling, but on a laptop it put the chips -- and on a short window the
// body itself -- under the fold, which is the one thing a member's own score
// must never be. Same trade the podium makes (Architecture.md 9): a canvas
// needs pixels, so the pixels come from a measurement.

/** The design size, and the tallest the body is ever drawn. */
const MAX_BODY = 440;

/** Below this the body stops reading as a person standing on a set. */
const MIN_BODY = 200;

/** `CharacterStage` draws a body this much wider than it is tall. */
const ASPECT = 0.72;

/** A body's canvas plus the contact shadow under it, as a multiple of itself. */
const BODY_WITH_SHADOW = 1.08;

/** Widest the body may be drawn, as a share of the stage it stands on. */
const WIDTH_SHARE = 0.5;

const SHADOW_WIDTH = 0.682;
const SHADOW_HEIGHT = 0.118;

/** The shadow overlaps the foot of the canvas rather than sitting under it. */
const SHADOW_LIFT = 0.032;

/**
 * Below `lg` the three columns stack, which is taller than any phone, so the
 * page scrolls and the body is drawn at its design size. Only from `lg` up is
 * the stage's height decided by the page instead of by the body standing in it
 * -- which is the one condition that makes measuring it safe rather than a loop.
 */
const FIT_QUERY = "(min-width: 64rem)";

export function HeroStage({
  ghost,
  left,
  right,
  ...character
}: {
  /** The ghost numeral the body stands in front of. */
  ghost: ReactNode;
  left: ReactNode;
  right: ReactNode;
  name: string;
  idOverride?: string;
  mood?: CharacterMood;
  beat?: CharacterBeat | null;
  leading?: boolean;
  points?: number;
  greetKey?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  // The design size on the first paint, which is right on anything roomy; the
  // observer corrects it before a frame of the entrance would show otherwise.
  const [body, setBody] = useState(MAX_BODY);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;

    const media = window.matchMedia(FIT_QUERY);

    const measure = () => {
      if (!media.matches) {
        setBody(MAX_BODY);
        return;
      }

      // Whichever runs out first. Height is what actually bites on a laptop,
      // but a narrow window at `lg` runs out of width while there is still
      // height to spare, and the body would grow into its own side columns.
      const box = node.getBoundingClientRect();
      const fitted = Math.min(
        box.height / BODY_WITH_SHADOW,
        (box.width * WIDTH_SHARE) / ASPECT
      );
      setBody(Math.round(Math.min(MAX_BODY, Math.max(MIN_BODY, fitted))));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    media.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
    };
  }, []);

  return (
    // `min-h-0` only from `lg`: below it the stage has to take its height from
    // the body, and a zeroed minimum there would collapse it to nothing and let
    // the body spill over the chips.
    <div
      ref={stage}
      className="relative flex flex-1 items-end justify-center pt-2 lg:min-h-0"
    >
      <div className="absolute inset-x-0 top-0">{ghost}</div>

      <HeroBeatScope>
        <div
          style={{ "--hero-body": `${body}px` } as CSSProperties}
          className="relative z-10 grid w-full max-w-[1250px] grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
        >
          {/* Named slots, not a list -- but they arrive as elements built by a
              server component, which React cannot tell apart from a dynamic
              array, so it asks for keys. The fragments are what answer it. */}
          <Fragment key="left">{left}</Fragment>

          <div className="relative order-first flex flex-col items-center lg:order-none">
            <HeroCharacter
              {...character}
              height={body}
              priority
              stage
              social
            />
            <ContactShadow
              width={Math.round(body * SHADOW_WIDTH)}
              height={Math.round(body * SHADOW_HEIGHT)}
              style={{ marginTop: -Math.round(body * SHADOW_LIFT) }}
            />
          </div>

          <Fragment key="right">{right}</Fragment>
        </div>
      </HeroBeatScope>
    </div>
  );
}
