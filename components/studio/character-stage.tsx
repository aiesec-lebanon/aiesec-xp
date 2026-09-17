"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Group } from "three";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { SceneEnvironment } from "@/components/three/environment";
import { Scene } from "@/components/three/scene";
import {
  beatClip,
  characterStillPath,
  type CharacterBeat,
  type CharacterMood,
} from "@/lib/design/character";

import { CharacterModel } from "./character-model";

/** How long a newly chosen body takes to settle into place. */
const ENTRANCE = 0.42;

export type CharacterStageProps = {
  id: string;
  name: string;
  /** Rendered height in pixels. Ignored when `fill` is set. */
  height: number;
  mood?: CharacterMood;
  eager?: boolean;
  /** Let the member turn the body. For the lab, not for a dashboard. */
  interactive?: boolean;
  /** Fill the parent instead of a portrait box. */
  fill?: boolean;
  heightFraction?: number;
  floorFraction?: number;
  /** Radians of yaw while standing, so bodies either side of a group angle inwards. */
  facing?: number;
  /** Load the social clips. Needed by `empty` and by every beat but `greet`. */
  social?: boolean;
  /** A one-shot played because something happened. Changing it is the trigger. */
  beat?: CharacterBeat | null;
  /** Greet once per browser session, so returning to the page is not a fanfare. */
  greetKey?: string;
  className?: string;
};

export function CharacterStage({
  id,
  name,
  height,
  mood = "idle",
  eager = false,
  interactive = false,
  fill = false,
  heightFraction,
  floorFraction,
  facing = 0,
  social = false,
  beat = null,
  greetKey,
  className = "",
}: CharacterStageProps) {
  const width = Math.round(height * 0.72);
  const greeting = useSessionGreeting(greetKey);

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
          heightFraction={heightFraction}
          floorFraction={floorFraction}
          facing={facing}
          social={social}
          beat={greeting ?? (beat ? beatClip(beat) : null)}
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

/**
 * One body on stage at a time, swapped where it stands.
 *
 * It used to walk: the outgoing character left the frame the way the arrow
 * pointed and the next followed it in. That read badly -- the body spent the
 * transition in profile, off-centre, and a swap interrupted mid-stride left it
 * stranded at the edge of the canvas. Choosing a character is not a journey, so
 * the new one simply arrives, settles, and says hello.
 */
function Swap({
  id,
  mood,
  heightFraction,
  floorFraction,
  facing,
  social,
  beat,
}: {
  id: string;
  mood: CharacterMood;
  heightFraction?: number;
  floorFraction?: number;
  facing?: number;
  social?: boolean;
  beat?: string | null;
}) {
  const [shown, setShown] = useState(id);
  const [entry, setEntry] = useState<string | null>(null);

  // Derived during render rather than in an effect, so the body that mounts is
  // already the one holding its greeting.
  if (shown !== id) {
    setShown(id);
    setEntry(beatClip("greet"));
  }

  // Let go of it once it has played, or a surface beat clearing later would fall
  // back to the greeting and wave again for no reason.
  useEffect(() => {
    if (!entry) return;
    const timer = setTimeout(() => setEntry(null), 2400);
    return () => clearTimeout(timer);
  }, [entry]);

  return (
    <Entrance key={id}>
      <CharacterModel
        id={id}
        mood={mood}
        heightFraction={heightFraction}
        floorFraction={floorFraction}
        facing={facing}
        social={social}
        beat={beat ?? entry}
      />
    </Entrance>
  );
}

/** Settles a body into place: down a little, up to full size, once. */
function Entrance({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const reduceMotion = useReduceMotion();

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    if (reduceMotion) {
      node.scale.setScalar(1);
      node.position.y = 0;
      return;
    }
    if (elapsed.current >= ENTRANCE) return;

    elapsed.current = Math.min(ENTRANCE, elapsed.current + delta);
    const eased = 1 - (1 - elapsed.current / ENTRANCE) ** 3;
    node.scale.setScalar(0.93 + 0.07 * eased);
    node.position.y = (1 - eased) * 0.22;
  });

  return (
    <group ref={group} scale={0.93} position={[0, 0.22, 0]}>
      {children}
    </group>
  );
}

/**
 * The greeting fires on the first view of a surface in a browser session.
 *
 * A wave on every render is not a greeting, it is a tic -- and the thing being
 * greeted is the member arriving, which happens once.
 */
function useSessionGreeting(key: string | undefined): string | null {
  const reduceMotion = useReduceMotion();
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    if (!key || reduceMotion) return;
    const storageKey = `xp:greeted:${key}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // Private mode, or storage refused. A missed greeting is not worth a throw.
      return;
    }
    const enter = setTimeout(() => setGreeting(beatClip("greet")), 700);
    const clear = setTimeout(() => setGreeting(null), 4200);
    return () => {
      clearTimeout(enter);
      clearTimeout(clear);
    };
  }, [key, reduceMotion]);

  return greeting;
}
