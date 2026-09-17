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

/** Seconds a body gets to walk off, and the next to jump on. */
const TRAVEL = 0.85;

export type CharacterStageProps = {
  id: string;
  name: string;
  height: number;
  mood?: CharacterMood;
  eager?: boolean;
  /** Let the member turn the body. For the lab, not for a dashboard. */
  interactive?: boolean;
  /** Which side a new character arrives from; the old one leaves the other way. */
  enterFrom?: 1 | -1;
  className?: string;
};

export function CharacterStage({
  id,
  name,
  height,
  mood = "idle",
  eager = false,
  interactive = false,
  enterFrom = 1,
  className = "",
}: CharacterStageProps) {
  const width = Math.round(height * 0.72);

  return (
    <div style={{ width, height }} className={`flex items-end justify-center ${className}`}>
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
        <Swap id={id} mood={mood} enterFrom={enterFrom} />
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

/**
 * Keeps the outgoing body on stage while the new one arrives.
 *
 * The exit distance comes from the viewport rather than a constant: the canvas
 * is a different number of world units wide on a phone and on the TV, and a body
 * has to clear the edge of whichever it is on before it stops walking.
 */
function Swap({
  id,
  mood,
  enterFrom,
}: {
  id: string;
  mood: CharacterMood;
  enterFrom: 1 | -1;
}) {
  const viewport = useThree((state) => state.viewport);
  const reduceMotion = useReduceMotion();
  const [swap, setSwap] = useState<{ id: string; leaving: string | null }>({ id, leaving: null });

  // Adjusted during render rather than in an effect: an effect commits a frame
  // later, and in that frame the new body would stand at centre before jumping
  // in from the edge.
  if (swap.id !== id) {
    setSwap({ id, leaving: reduceMotion ? null : swap.id });
  }

  const leaving = swap.leaving;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setSwap((current) => ({ ...current, leaving: null })), TRAVEL * 1000);
    return () => clearTimeout(timer);
  }, [leaving]);

  const exitDistance = viewport.width / 2 + 1.1;

  return (
    <>
      {leaving ? (
        <CharacterModel
          key={`leaving-${leaving}`}
          id={leaving}
          mood={mood}
          phase="leaving"
          direction={(-enterFrom) as 1 | -1}
          exitDistance={exitDistance}
          travelSeconds={TRAVEL}
        />
      ) : null}
      <CharacterModel
        key={id}
        id={id}
        mood={mood}
        phase={leaving ? "arriving" : "settled"}
        direction={enterFrom}
        exitDistance={exitDistance}
        travelSeconds={TRAVEL}
      />
    </>
  );
}
