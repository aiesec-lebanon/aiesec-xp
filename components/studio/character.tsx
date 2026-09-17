import Image from "next/image";

import {
  characterFor,
  characterPortraitPath,
  characterStillPath,
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
}: {
  /** The member this body stands for. Decides the variant, and labels the image. */
  name: string;
  /** Rendered height in pixels; the intrinsic aspect ratio sets the width. */
  height: number;
  idle?: Idle;
  priority?: boolean;
  className?: string;
  /** Render the model live. Worth a canvas only where one body is shown. */
  stage?: boolean;
  /** What the body does while it stands there. Only reaches the live stage. */
  mood?: CharacterMood;
  /** Radians of yaw, so bodies either side of a group angle inwards. */
  facing?: number;
  /** The member's chosen character, instead of the one `name` hashes to. */
  idOverride?: string;
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
        className={className}
      />
    );
  }

  // The still is rendered from the same .glb (D-52), so it is the same
  // character in the same pose as the live stage.
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

/** The member's profile picture: their character's face, for rows and pills. */
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

/** The radial contact shadow that plants a body on the floor. */
export function ContactShadow({
  width,
  height = 52,
  opacity = 0.17,
  className = "",
}: {
  width: number;
  height?: number;
  opacity?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={{
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
