"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  Vector3,
  type AnimationAction,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { useReduceMotion } from "@/components/motion/motion-provider";
import {
  ANIMATION_LIBRARY,
  CLIPS,
  characterModelPath,
  type CharacterMood,
} from "@/lib/design/character";
import { preloadModel, useModel } from "@/lib/three/loaders";

export type CharacterPhase = "settled" | "leaving" | "arriving";

export type CharacterModelProps = {
  id: string;
  mood?: CharacterMood;
  phase?: CharacterPhase;
  /** Which way the walk heads: the side of the arrow the member pressed. */
  direction?: 1 | -1;
  /** How far off-centre the frame edge is, in world units. */
  exitDistance?: number;
  /** Seconds the walk across the frame gets. */
  travelSeconds?: number;
  /** Share of the frame's height the body fills. */
  heightFraction?: number;
  /** Where the floor sits, as a share of the frame's height from its bottom. */
  floorFraction?: number;
};

// What XpCanvas's camera sees at the origin: fov 42 vertical, 6 units back. fov
// is vertical, so a share of this is the same share of the canvas at any size.
export const FRAME_HEIGHT = 2 * 6 * Math.tan((42 * Math.PI) / 360);

const CROSSFADE = 0.35;
const DWELL = { min: 5, max: 11 };
/** How often an idle change is a wave instead of another idle. */
const GREET_CHANCE = 0.25;

function pick<T>(from: readonly T[], not?: T): T {
  const options = from.length > 1 && not !== undefined ? from.filter((v) => v !== not) : from;
  return options[Math.floor(Math.random() * options.length)]!;
}

/**
 * Drop tracks that address a bone this character does not have.
 *
 * Juno was auto-rigged onto the 33-bone skeleton, which is the 65-bone one minus
 * fingers, so the clips carry finger tracks she has no target for. three warns
 * once per track per clip otherwise, which is hundreds of lines.
 */
function bindable(clip: AnimationClip, names: Set<string>): AnimationClip {
  const tracks = clip.tracks.filter((track) => names.has(track.name.split(".")[0] ?? ""));
  if (tracks.length === clip.tracks.length) return clip;
  const trimmed = clip.clone();
  trimmed.tracks = tracks;
  return trimmed;
}

export function CharacterModel({
  id,
  mood = "idle",
  phase = "settled",
  direction = 1,
  exitDistance = 4,
  travelSeconds = 0.9,
  heightFraction = 0.9,
  floorFraction = 0.02,
}: CharacterModelProps) {
  const { scene } = useModel(characterModelPath(id));
  const library = useModel(characterModelPath(ANIMATION_LIBRARY));
  const reduceMotion = useReduceMotion();
  const invalidate = useThree((state) => state.invalidate);

  const group = useRef<Group>(null);
  const mixer = useRef<AnimationMixer | null>(null);
  const actions = useRef(new Map<string, AnimationAction>());
  const active = useRef<AnimationAction | null>(null);
  const nextChange = useRef(0);
  const elapsed = useRef(0);

  const body = useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return copy;
  }, [scene]);

  // The export normalises every character to 1.5m with its feet on the floor and
  // freezes the transform into the data (D-53), so the bind pose measures the
  // same for all four and this scale is stable.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(body);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const scale = size.y > 0 ? (FRAME_HEIGHT * heightFraction) / size.y : 1;
    const floor = -FRAME_HEIGHT / 2 + FRAME_HEIGHT * floorFraction;
    return {
      scale,
      position: [-centre.x * scale, floor - box.min.y * scale, -centre.z * scale] as const,
    };
  }, [body, heightFraction, floorFraction]);

  useEffect(() => {
    const bones = new Set<string>();
    body.traverse((node) => bones.add(node.name));

    const next = new AnimationMixer(body);
    const table = new Map<string, AnimationAction>();
    for (const clip of library.animations as AnimationClip[]) {
      table.set(clip.name, next.clipAction(bindable(clip, bones)));
    }
    mixer.current = next;
    actions.current = table;
    active.current = null;
    return () => {
      next.stopAllAction();
      mixer.current = null;
    };
  }, [body, library]);

  const play = (name: string, { once = false, fade = CROSSFADE, speed = 1 } = {}) => {
    const action = actions.current.get(name);
    if (!action || action === active.current) return;

    action.reset();
    action.setEffectiveTimeScale(speed);
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    if (active.current) action.crossFadeFrom(active.current, fade, true);
    action.play();
    active.current = action;
  };

  useEffect(() => {
    if (!mixer.current) return;
    elapsed.current = 0;

    if (phase !== "settled") {
      play(CLIPS.walk, { fade: 0.2 });
      return;
    }

    const pool = mood === "celebrate" ? CLIPS.celebrate : CLIPS.idle;
    play(pick(pool), { fade: 0.25 });
    nextChange.current = DWELL.min + Math.random() * (DWELL.max - DWELL.min);
  }, [phase, direction, mood, body, library]);

  // A member who asked for less motion puts the canvas on `demand`, where
  // useFrame never runs -- so the pose has to be written once here, or the body
  // renders in the T-pose it was bound in.
  useEffect(() => {
    if (!reduceMotion || !mixer.current) return;
    mixer.current.update(0);
    invalidate();
  }, [reduceMotion, invalidate, phase, mood, body, library]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node || !mixer.current) return;

    if (reduceMotion) {
      mixer.current.update(0);
      return;
    }
    mixer.current.update(delta);

    if (phase === "settled") {
      nextChange.current -= delta;
      if (nextChange.current <= 0) {
        const pool = mood === "celebrate" ? CLIPS.celebrate : CLIPS.idle;
        const greet = mood === "idle" && Math.random() < GREET_CHANCE;
        const name = greet ? pick(CLIPS.greet) : pick(pool, active.current?.getClip().name);
        play(name, { once: greet });
        nextChange.current = greet
          ? (actions.current.get(name)?.getClip().duration ?? 2)
          : DWELL.min + Math.random() * (DWELL.max - DWELL.min);
      }
      return;
    }

    // Linear on both legs: a walk that eases is a walk that slows down for no
    // reason. Leaving runs centre to edge, arriving runs the far edge to centre,
    // both heading the same way, so the two read as one body passing through.
    elapsed.current = Math.min(1, elapsed.current + delta / travelSeconds);
    const travelled = phase === "leaving" ? elapsed.current : elapsed.current - 1;
    node.position.x = fit.position[0] + direction * exitDistance * travelled;
  });

  const walking = phase !== "settled" && !reduceMotion;
  // The bodies are exported facing +Z, so a quarter turn puts them in profile,
  // walking the way they are travelling.
  const facing = walking ? (direction * Math.PI) / 2 : 0;
  const start = phase === "arriving" && walking ? -direction * exitDistance : 0;

  return (
    <group
      ref={group}
      position={[fit.position[0] + start, fit.position[1], fit.position[2]]}
      scale={fit.scale}
      rotation={[0, facing, 0]}
    >
      <primitive object={body} />
    </group>
  );
}

export function preloadCharacter(id: string): void {
  preloadModel(characterModelPath(id));
  preloadModel(characterModelPath(ANIMATION_LIBRARY));
}
