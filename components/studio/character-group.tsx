"use client";

import { useThree } from "@react-three/fiber";
import Image from "next/image";
import { useMemo } from "react";
import { CanvasTexture } from "three";

import { SceneEnvironment } from "@/components/three/environment";
import { Scene } from "@/components/three/scene";
import { beatClip, characterStillPath, type CharacterMood } from "@/lib/design/character";

import { CharacterModel, FRAME_HEIGHT } from "./character-model";
import { beatFor, facingFor, useGroupExchange } from "./group-exchange";
import { groundY, placeGroup } from "./group-layout";
import { useMoodFlourish } from "./mood-flourish";

export type GroupMember = {
  id: string;
  name: string;
};

/**
 * Several bodies in one canvas, standing on one floor.
 *
 * One canvas per character meant each had its own box, so the bodies overlapped
 * and clipped each other -- and a context was spent per body where one would do.
 * Sharing a scene is also what lets them turn towards each other, which is the
 * part that stops a group reading as separate renders.
 */
export function CharacterGroup({
  members,
  mood = "celebrate",
  flourish = false,
  className = "",
  heightFraction = 0.6,
  floorFraction = 0.12,
  eager = false,
}: {
  /** In the order they should stand, best placed first. */
  members: GroupMember[];
  mood?: CharacterMood;
  /**
   * Each body breaks from `mood` into dancing now and then, on its own
   * independent timer -- everybody reacting on the same beat is as artificial
   * as nobody reacting (D-54), and a group that all danced together would be
   * the same fault at a different clip (D-60).
   */
  flourish?: boolean;
  className?: string;
  heightFraction?: number;
  floorFraction?: number;
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
            {members.slice(0, 5).map((member, index) => (
              <Image
                key={`${member.id}-${index}`}
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
        <Bodies
          members={members}
          mood={mood}
          flourish={flourish}
          heightFraction={heightFraction}
          floorFraction={floorFraction}
        />
      </Scene>
    </div>
  );
}

function Bodies({
  members,
  mood,
  flourish,
  heightFraction,
  floorFraction,
}: {
  members: GroupMember[];
  mood: CharacterMood;
  flourish: boolean;
  heightFraction: number;
  floorFraction: number;
}) {
  // The canvas is a different number of world units wide on a phone and on the
  // TV, and how many bodies fit without touching depends on that, not on a guess.
  const width = useThree((state) => state.viewport.width);
  const exchange = useGroupExchange(members.length);

  const places = useMemo(
    () => placeGroup(members.length, width, heightFraction),
    [members.length, width, heightFraction],
  );
  const shadow = useShadowTexture();
  const floor = groundY(floorFraction);

  return (
    <>
      {members.map((member, index) => {
        const place = places[index]!;
        const beat = beatFor(exchange, index);
        // In world units, which is the body's height times its share of it.
        const blob = place.fraction * FRAME_HEIGHT * 0.52;
        return (
          <group key={`${member.id}-${index}`} position={[place.x, 0, place.z]}>
            <mesh
              position={[0, floor + 0.01, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={-1}
            >
              <planeGeometry args={[blob, blob * 0.62]} />
              <meshBasicMaterial map={shadow} transparent depthWrite={false} />
            </mesh>
            <GroupBody
              id={member.id}
              mood={mood}
              flourish={flourish}
              facing={facingFor(exchange, index, (at) => places[at]!.x)}
              beat={beat ? beatClip(beat) : null}
              heightFraction={place.fraction}
              floorFraction={floorFraction}
            />
          </group>
        );
      })}
    </>
  );
}

/**
 * One body in the group. Its own component, not `CharacterModel` inlined in
 * the `.map` above, because `useMoodFlourish` is a hook and belongs to a
 * component whose instance count is stable -- a list item is, a bare callback
 * is not. Each instance times its own flourish independently, which is the
 * whole point: everybody switching together would look as staged as everybody
 * standing still.
 */
function GroupBody({
  id,
  mood,
  flourish,
  facing,
  beat,
  heightFraction,
  floorFraction,
}: {
  id: string;
  mood: CharacterMood;
  flourish: boolean;
  facing: number;
  beat: string | null;
  heightFraction: number;
  floorFraction: number;
}) {
  const resolved = useMoodFlourish(mood, {
    active: flourish && mood === "celebrate",
    moods: ["dancing"],
    hold: [5, 10],
    gap: [8, 20],
  });

  return (
    <CharacterModel
      id={id}
      mood={resolved}
      facing={facing}
      beat={beat}
      heightFraction={heightFraction}
      floorFraction={floorFraction}
      social
    />
  );
}

/**
 * A soft blob under each body.
 *
 * There is no ground plane in this scene to catch a real shadow, and a single
 * DOM ellipse under the canvas cannot ground bodies standing at different
 * depths -- it lands under the nearest one and leaves the rest floating.
 */
function useShadowTexture(): CanvasTexture {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(23,22,20,0.30)");
    gradient.addColorStop(0.45, "rgba(23,22,20,0.13)");
    gradient.addColorStop(1, "rgba(23,22,20,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    return new CanvasTexture(canvas);
  }, []);
}
