"use client";

import { OrbitControls } from "@react-three/drei";
import Image from "next/image";

import { SceneEnvironment } from "@/components/three/environment";
import { Scene } from "@/components/three/scene";
import { characterStillPath } from "@/lib/design/character";

import { CharacterModel } from "./character-model";

export type CharacterStageProps = {
  id: string;
  /** Labels the scene and its DOM fallback. */
  name: string;
  /** Rendered height in pixels; the canvas is sized to it. */
  height: number;
  eager?: boolean;
  /** Let the member turn the body. For the lab, not for a dashboard. */
  interactive?: boolean;
  /** Play the entry animation when the body changes. */
  animate?: boolean;
  className?: string;
};

export function CharacterStage({
  id,
  name,
  height,
  eager = false,
  interactive = false,
  animate = false,
  className = "",
}: CharacterStageProps) {
  const width = Math.round(height * 0.72);

  // The canvas is absolutely positioned inside <Scene>, so the box is sized
  // here -- outside <Scene>, which drops to the bare fallback with no GPU.
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
        {/* Keyed on the body so a change remounts it, which is what the entry
            animation plays on. */}
        <CharacterModel key={id} id={id} animate={animate} />
        {interactive ? (
          <OrbitControls
            makeDefault
            enablePan={false}
            // Turning is the whole interaction. Zoom took the body off its floor
            // and out of the frame it was composed for, and scrolling over a
            // canvas mid-page stole the page's own scroll.
            enableZoom={false}
            // Aimed at the chest rather than the origin, which sits near the feet
            // once the body is stood on the floor of the frame.
            target={[0, -0.2, 0]}
            // Stops short of the poles: from directly overhead or below, a body
            // standing on a floor reads as a mistake.
            minPolarAngle={0.7}
            maxPolarAngle={1.8}
          />
        ) : null}
      </Scene>
    </div>
  );
}
