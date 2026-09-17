"use client";

import Image from "next/image";

import { SceneEnvironment } from "@/components/three/environment";
import { Scene } from "@/components/three/scene";
import { characterStillPath, type CharacterColours } from "@/lib/design/character";

import { CharacterModel } from "./character-model";

export type CharacterStageProps = {
  id: string;
  /** Labels the scene and its DOM fallback. */
  name: string;
  /** Rendered height in pixels; the canvas is sized to it. */
  height: number;
  colours?: CharacterColours;
  eager?: boolean;
  className?: string;
};

export function CharacterStage({
  id,
  name,
  height,
  colours,
  eager = false,
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
        <CharacterModel id={id} colours={colours} />
      </Scene>
    </div>
  );
}
