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

const ENTRANCE = 0.42;

export type CharacterStageProps = {
  id: string;
  name: string;
  /** Ignored when `fill` is set. */
  height: number;
  mood?: CharacterMood;
  eager?: boolean;
  interactive?: boolean;
  fill?: boolean;
  heightFraction?: number;
  floorFraction?: number;
  /** Radians of yaw. */
  facing?: number;
  /** Load the social clips; needed by `empty` and every beat but `greet`. */
  social?: boolean;
  /** Changing it is the trigger. */
  beat?: CharacterBeat | null;
  /** Greets once per browser session. */
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
            // Zoom would hijack page scroll and pull the body out of its frame.
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

  // Set during render so the body that mounts already holds its greeting.
  if (shown !== id) {
    setShown(id);
    setEntry(beatClip("greet"));
  }

  // Clear it after playing, or a later beat clearing would fall back to the greeting.
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
