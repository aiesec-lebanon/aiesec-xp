import Image from "next/image";
import type { CSSProperties } from "react";

import {
  characterFor,
  characterPortraitPath,
  characterStillPath,
  type CharacterBeat,
  type CharacterMood,
} from "@/lib/design/character";

import { CharacterStage } from "./character-stage";

type Idle = "bob" | "small" | "squash" | "none";

const IDLE_CLASS: Record<Idle, string> = {
  bob: "idle",
  small: "idle-small",
  squash: "idle-squash",
  none: "",
};

export function Character({
  name,
  height,
  idle = "bob",
  priority = false,
  className = "",
  stage = false,
  mood,
  facing,
  idOverride,
  social,
  beat,
  greetKey,
  heightFraction,
}: {
  name: string;
  height: number;
  idle?: Idle;
  priority?: boolean;
  className?: string;
  stage?: boolean;
  mood?: CharacterMood;
  /** Radians of yaw. */
  facing?: number;
  idOverride?: string;
  /** Load the social clips; needed by the `empty` mood and most beats. */
  social?: boolean;
  beat?: CharacterBeat | null;
  greetKey?: string;
  /** Lower it for clips that raise the arms above standing height, or the pose crops. */
  heightFraction?: number;
}) {
  const id = idOverride ?? characterFor(name).id;

  if (stage) {
    return (
      <CharacterStage
        id={id}
        name={name}
        height={height}
        mood={mood}
        facing={facing}
        social={social}
        beat={beat}
        greetKey={greetKey}
        heightFraction={heightFraction}
        className={className}
      />
    );
  }

  return (
    <Image
      data-model-slot="character"
      src={characterStillPath(id)}
      alt={`${name}'s character`}
      width={Math.round(height * 0.72)}
      height={height}
      priority={priority}
      style={{ height, width: "auto" }}
      className={`block ${IDLE_CLASS[idle]} ${className}`}
    />
  );
}

export function CharacterAvatar({
  name,
  idOverride,
  size = 46,
  rounded = "rounded-[14px]",
  tone = "bg-floor",
}: {
  name: string;
  idOverride?: string;
  size?: number;
  rounded?: string;
  tone?: string;
}) {
  const id = idOverride ?? characterFor(name).id;

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden ${rounded} ${tone}`}
    >
      <Image
        data-model-slot="character"
        src={characterPortraitPath(id)}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="size-full object-cover"
      />
    </div>
  );
}

export function ContactShadow({
  width,
  height = 52,
  opacity = 0.17,
  className = "",
  style,
}: {
  width: number;
  height?: number;
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        ...style,
        width,
        height,
        background: `radial-gradient(ellipse at center, rgba(23,22,20,${opacity}) 0%, rgba(23,22,20,${
          opacity * 0.35
        }) 46%, rgba(23,22,20,0) 72%)`,
      }}
      className={className}
    />
  );
}
