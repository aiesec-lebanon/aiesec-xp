"use client";

import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import Image from "next/image";
import { useEffect, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { SceneEnvironment } from "@/components/three/environment";
import { Scene } from "@/components/three/scene";
import { characterStillPath, type CharacterMood } from "@/lib/design/character";

import { CharacterModel } from "./character-model";

/** How fast a body walks, in world units a second. */
const WALK_SPEED = 4.2;
const WALK_BOUNDS = { min: 0.7, max: 1.7 };

export type CharacterStageProps = {
  id: string;
  name: string;
  /** Rendered height in pixels. Ignored when `fill` is set. */
  height: number;
  mood?: CharacterMood;
  eager?: boolean;
  /** Let the member turn the body. For the lab, not for a dashboard. */
  interactive?: boolean;
  /** Which way the walk heads: the side of the arrow the member pressed. */
  walkDirection?: 1 | -1;
  /**
   * Fill the parent instead of a portrait box. A character that walks off has to
   * leave *the frame the member can see*, and a 310px box inside a wide panel
   * puts the edge of the canvas in the middle of the screen.
   */
  fill?: boolean;
  heightFraction?: number;
  floorFraction?: number;
  /** Radians of yaw while standing, so bodies either side of a group angle inwards. */
  facing?: number;
  className?: string;
};

export function CharacterStage({
  id,
  name,
  height,
  mood = "idle",
  eager = false,
  interactive = false,
  walkDirection = 1,
  fill = false,
  heightFraction,
  floorFraction,
  facing = 0,
  className = "",
}: CharacterStageProps) {
  const width = Math.round(height * 0.72);

  return (
    <div
      style={fill ? undefined : { width, height }}
      className={
        fill
          ? `absolute inset-0 ${className}`
          : `flex items-end justify-center ${className}`
      }
    >
      <Scene
        eager={eager}
        transparent
        label={`${name}'s character`}
        className="size-full"
        fallback={
          <Image
            src={characterStillPath(id)}
            alt={`${name}'s character`}
            width={width}
            height={height}
            style={{ height, width: "auto" }}
            className="block"
          />
        }
      >
        <SceneEnvironment environment="studio" />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <directionalLight position={[-4, 2, -3]} intensity={0.4} />
        <Swap
          id={id}
          mood={mood}
          walkDirection={walkDirection}
          heightFraction={heightFraction}
          floorFraction={floorFraction}
          facing={facing}
        />
        {interactive ? (
          <OrbitControls
            makeDefault
            enablePan={false}
            // Turning is the whole interaction. Zoom took the body off its floor
            // and out of the frame it was composed for, and scrolling over a
            // canvas mid-page stole the page's own scroll.
            enableZoom={false}
            target={[0, -0.2, 0]}
            minPolarAngle={0.7}
            maxPolarAngle={1.8}
          />
        ) : null}
      </Scene>
    </div>
  );
}

type Stage =
  | { kind: "settled"; id: string }
  | { kind: "leaving"; id: string; next: string }
  | { kind: "arriving"; id: string };

/**
 * One body on stage at a time: the outgoing character walks clear of the frame
 * the way the arrow pointed, and the next walks in from the far side after it.
 *
 * Overlapping the two read as a collision, and it also meant both models were
 * mounted at once -- so a character whose file had not finished loading took the
 * whole Suspense boundary down with it and the one walking off vanished.
 */
function Swap({
  id,
  mood,
  walkDirection,
  heightFraction,
  floorFraction,
  facing,
}: {
  id: string;
  mood: CharacterMood;
  walkDirection: 1 | -1;
  heightFraction?: number;
  floorFraction?: number;
  facing?: number;
}) {
  const viewport = useThree((state) => state.viewport);
  const reduceMotion = useReduceMotion();
  const [stage, setStage] = useState<Stage>({ kind: "settled", id });

  // Adjusted during render rather than in an effect, which commits a frame later
  // -- long enough for the new body to be seen standing where the old one was.
  if (stage.kind === "settled" && stage.id !== id) {
    setStage(reduceMotion ? { kind: "settled", id } : { kind: "leaving", id: stage.id, next: id });
  } else if (stage.kind === "leaving" && stage.next !== id) {
    setStage({ kind: "leaving", id: stage.id, next: id });
  } else if (stage.kind === "arriving" && stage.id !== id) {
    setStage(reduceMotion ? { kind: "settled", id } : { kind: "arriving", id });
  }

  // The frame the member can actually see, not a guess: the canvas is a
  // different number of world units wide on a phone and on the TV.
  const exitDistance = viewport.width / 2 + 1.2;
  // Timed from the distance rather than fixed, so the walk holds one pace
  // whatever the canvas is: a fixed duration makes a wide frame a sprint.
  const walkSeconds = Math.min(
    WALK_BOUNDS.max,
    Math.max(WALK_BOUNDS.min, exitDistance / WALK_SPEED),
  );

  useEffect(() => {
    if (stage.kind === "settled") return;
    const hold = walkSeconds;
    const timer = setTimeout(
      () =>
        setStage((current) =>
          current.kind === "leaving"
            ? { kind: "arriving", id: current.next }
            : { kind: "settled", id: current.id },
        ),
      hold * 1000,
    );
    return () => clearTimeout(timer);
  }, [stage, walkSeconds]);

  return (
    <CharacterModel
      key={`${stage.id}-${stage.kind}`}
      id={stage.id}
      mood={mood}
      phase={stage.kind}
      direction={walkDirection}
      exitDistance={exitDistance}
      travelSeconds={walkSeconds}
      heightFraction={heightFraction}
      floorFraction={floorFraction}
      facing={facing}
    />
  );
}
