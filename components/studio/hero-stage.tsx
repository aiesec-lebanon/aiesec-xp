"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { CharacterBeat, CharacterMood } from "@/lib/design/character";

import { ContactShadow } from "./character";
import { HeroBeatScope, HeroCharacter } from "./hero-beat";

const MAX_BODY = 440;
const MIN_BODY = 200;
const ASPECT = 0.72;
const BODY_WITH_SHADOW = 1.08;
const WIDTH_SHARE = 0.5;

const SHADOW_WIDTH = 0.682;
const SHADOW_HEIGHT = 0.118;
const SHADOW_LIFT = 0.032;

// Only from `lg` does the page, not the body, decide the stage height, so measuring can't loop.
const FIT_QUERY = "(min-width: 64rem)";

export function HeroStage({
  ghost,
  left,
  right,
  ...character
}: {
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
    // `min-h-0` only from `lg`: below it the stage must take its height from the body.
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
          {/* Server-built slots look like a dynamic array to React, so they need keys. */}
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
