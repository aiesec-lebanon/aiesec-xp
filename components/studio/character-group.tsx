"use client";

import Image from "next/image";

import { SceneEnvironment } from "@/components/three/environment";
import { Scene } from "@/components/three/scene";
import { characterStillPath, type CharacterMood } from "@/lib/design/character";

import { CharacterModel } from "./character-model";

export type GroupMember = {
  id: string;
  name: string;
  /** 0 is the centre of the group; negative is left. */
  offset: number;
  /** Relative to the tallest body in the group. */
  scale?: number;
};

/**
 * Several bodies in one canvas.
 *
 * One canvas per character meant each had its own box, so on the LC podium the
 * three overlapped and clipped each other -- and three contexts were spent where
 * one would do. Sharing a scene is also what lets them turn towards each other,
 * which is the part that stops a group reading as three separate renders.
 */
export function CharacterGroup({
  members,
  mood = "celebrate",
  className = "",
  heightFraction = 0.6,
  floorFraction = 0.12,
  spread = 1.25,
  eager = false,
}: {
  members: GroupMember[];
  mood?: CharacterMood;
  className?: string;
  heightFraction?: number;
  floorFraction?: number;
  /** World units between neighbours. */
  spread?: number;
  eager?: boolean;
}) {
  if (members.length === 0) return null;

  return (
    <div className={`absolute inset-0 ${className}`}>
      <Scene
        eager={eager}
        transparent
        label={`${members.map((member) => member.name).join(", ")}`}
        className="size-full"
        fallback={
          <div className="flex size-full items-end justify-center gap-2">
            {members.map((member) => (
              <Image
                key={member.id + member.offset}
                src={characterStillPath(member.id)}
                alt=""
                width={120}
                height={167}
                className="block h-4/5 w-auto"
              />
            ))}
          </div>
        }
      >
        <SceneEnvironment environment="studio" />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <directionalLight position={[-4, 2, -3]} intensity={0.4} />

        {members.map((member) => (
          <group key={`${member.id}-${member.offset}`} position={[member.offset * spread, 0, 0]}>
            <CharacterModel
              id={member.id}
              mood={mood}
              // Turned a little towards the middle of the group rather than all
              // square to camera, which is what made three bodies look posed.
              facing={member.offset === 0 ? 0 : -Math.sign(member.offset) * 0.42}
              heightFraction={heightFraction * (member.scale ?? 1)}
              floorFraction={floorFraction}
              social
            />
          </group>
        ))}
      </Scene>
    </div>
  );
}
