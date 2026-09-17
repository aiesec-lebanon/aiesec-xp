import Image from "next/image";

import { characterFor } from "@/lib/design/character";

// The slot D-47's posed glTF drops into. Until then the body is the flat render
// the design comps run on, so every screen already reserves the right height and
// the right contact shadow -- swapping in a <Scene> here changes no layout.
//
// The idle loop is CSS rather than Motion on purpose: a body breathes on the
// leaderboard, the podium, the dock avatar and the ticker at once, and a single
// declarative keyframe costs nothing per instance where thirty animation
// controllers would. The member's reduce-motion switch reaches it through the
// [data-reduce-motion="true"] backstop in globals.css.

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
  srcOverride,
}: {
  /** The member this body stands for. Decides the variant, and labels the image. */
  name: string;
  /** Rendered height in pixels; the intrinsic aspect ratio sets the width. */
  height: number;
  idle?: Idle;
  priority?: boolean;
  className?: string;
  /** Renders this variant instead of the one `name` hashes to -- the character lab's preview carousel is the only caller. */
  srcOverride?: string;
}) {
  return (
    <Image
      data-model-slot="character"
      src={srcOverride ?? characterFor(name)}
      alt={`${name}'s character`}
      width={Math.round(height * 0.72)}
      height={height}
      priority={priority}
      style={{ height, width: "auto" }}
      className={`block ${IDLE_CLASS[idle]} ${className}`}
    />
  );
}

/** The same body cropped into a circle or a rounded tile, for rows and pills. */
export function CharacterAvatar({
  name,
  size = 46,
  rounded = "rounded-[14px]",
  tone = "bg-floor",
}: {
  name: string;
  size?: number;
  rounded?: string;
  tone?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden ${rounded} ${tone}`}
    >
      {/* Inset rather than `fill`: the renders carry headroom above and a floor
          line below, so the body is nudged up inside its own frame. `fill` would
          pin the image to 100% height and lose that. */}
      <Image
        data-model-slot="character"
        src={characterFor(name)}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          width: "100%",
          height: "88%",
          objectFit: "contain",
        }}
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
