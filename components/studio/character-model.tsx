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
  MathUtils,
  Vector3,
  type AnimationAction,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { useReduceMotion } from "@/components/motion/motion-provider";
import {
  ANIMATION_LIBRARY,
  CLIPS,
  SOCIAL_LIBRARY,
  characterModelPath,
  type CharacterMood,
} from "@/lib/design/character";
import { preloadModel, useModel } from "@/lib/three/loaders";

export type CharacterModelProps = {
  id: string;
  mood?: CharacterMood;
  heightFraction?: number;
  floorFraction?: number;
  /** Radians of yaw. */
  facing?: number;
  social?: boolean;
  /** Played once; changing it is the trigger. */
  beat?: string | null;
  /** Loops this exact clip instead of the mood pool, e.g. for locomotion. */
  lock?: string | null;
};

// What XpCanvas's camera sees at the origin: fov 42 (vertical), 6 units back.
export const FRAME_HEIGHT = 2 * 6 * Math.tan((42 * Math.PI) / 360);

const CROSSFADE = 0.35;
const DWELL = { min: 5, max: 11 };
const GREET_CHANCE = 0.25;

// Authored against a chair this set doesn't have.
const SIT_CLIPS = new Set(["idle-sitting", "idle-sitting-2"]);

function pick<T>(from: readonly T[], not?: T): T {
  const options = from.length > 1 && not !== undefined ? from.filter((v) => v !== not) : from;
  return options[Math.floor(Math.random() * options.length)]!;
}

function poolFor(mood: CharacterMood): readonly string[] {
  if (mood === "celebrate") return CLIPS.celebrate;
  if (mood === "dancing") return CLIPS.dancing;
  if (mood === "empty") return CLIPS.idleEmpty;
  if (mood === "calm") return CLIPS.idleCalm;
  return CLIPS.idle;
}

// Some rigs lack finger bones the shared clips animate.
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
  heightFraction = 0.9,
  floorFraction = 0.02,
  facing = 0,
  social = false,
  beat = null,
  lock = null,
}: CharacterModelProps) {
  const { scene } = useModel(characterModelPath(id));
  const core = useModel(characterModelPath(ANIMATION_LIBRARY));
  const extra = useModel(characterModelPath(social ? SOCIAL_LIBRARY : ANIMATION_LIBRARY));
  const reduceMotion = useReduceMotion();
  const invalidate = useThree((state) => state.invalidate);

  const group = useRef<Group>(null);
  const mixer = useRef<AnimationMixer | null>(null);
  const actions = useRef(new Map<string, AnimationAction>());
  const active = useRef<AnimationAction | null>(null);
  const nextChange = useRef(0);
  const groundCorrection = useRef(0);
  const groundCheck = useRef(0);
  const scratchBox = useRef(new Box3());

  const body = useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      // These rigs' skinned bounding spheres sit ~20 units off, so culling hides visible bodies.
      node.frustumCulled = false;
    });
    return copy;
  }, [scene]);

  // Measure the unmounted template: Box3 is world-space, so the mounted copy would
  // fold this group's own scale back into the measurement.
  const bounds = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    return {
      height: box.max.y - box.min.y,
      centre: box.getCenter(new Vector3()),
      lowest: box.min.y,
    };
  }, [scene]);

  const fit = useMemo(() => {
    const scale = bounds.height > 0 ? (FRAME_HEIGHT * heightFraction) / bounds.height : 1;
    const floor = -FRAME_HEIGHT / 2 + FRAME_HEIGHT * floorFraction;
    // Model units: applied inside the scaled group.
    return { scale, floor, offset: [-bounds.centre.x, -bounds.lowest, -bounds.centre.z] as const };
  }, [bounds, heightFraction, floorFraction]);

  useEffect(() => {
    const bones = new Set<string>();
    body.traverse((node) => bones.add(node.name));

    const next = new AnimationMixer(body);
    const table = new Map<string, AnimationAction>();
    for (const clip of [...core.animations, ...extra.animations] as AnimationClip[]) {
      if (table.has(clip.name)) continue;
      table.set(clip.name, next.clipAction(bindable(clip, bones)));
    }
    mixer.current = next;
    actions.current = table;
    active.current = null;
    return () => {
      next.stopAllAction();
      mixer.current = null;
    };
  }, [body, core, extra]);

  const play = (
    name: string,
    { once = false, fade = CROSSFADE, speed = 1, offset = 0 } = {},
  ) => {
    const action = actions.current.get(name);
    if (!action || action === active.current) return;

    action.reset();
    action.setEffectiveTimeScale(speed);
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    // Random start offset, or identical clips begun together stay in lockstep forever.
    if (offset) action.time = offset % action.getClip().duration;
    if (active.current) action.crossFadeFrom(active.current, fade, true);
    action.play();
    active.current = action;
  };

  const settle = (fade = 0.3) => {
    const clip = pick(poolFor(mood));
    const duration = actions.current.get(clip)?.getClip().duration ?? 4;
    play(clip, { fade, offset: Math.random() * duration, speed: 0.94 + Math.random() * 0.12 });
    nextChange.current = Math.random() * DWELL.max;
  };

  useEffect(() => {
    if (!mixer.current) return;
    if (lock) {
      play(lock, { fade: 0.25 });
    } else {
      settle(0.25);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, lock, body, core, extra]);

  useEffect(() => {
    if (!beat || !mixer.current || reduceMotion) return;
    play(beat, { once: true, fade: 0.2 });
    // Hold the idle picker off until the beat has played out.
    nextChange.current = actions.current.get(beat)?.getClip().duration ?? 2;
  }, [beat, reduceMotion, body, core, extra]);

  useEffect(() => {
    if (!reduceMotion || !mixer.current) return;
    mixer.current.update(0);
    invalidate();
  }, [reduceMotion, invalidate, mood, body, core, extra]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node || !mixer.current) return;

    if (reduceMotion) {
      mixer.current.update(0);
      return;
    }
    mixer.current.update(delta);

    node.rotation.y = MathUtils.damp(node.rotation.y, facing, 3.2, delta);

    // Sitting clips float at chair height; drop to the posed lowest point (throttled, it's costly).
    groundCheck.current -= delta;
    if (groundCheck.current <= 0) {
      groundCheck.current = 0.12;
      const clip = active.current?.getClip().name;
      if (clip && SIT_CLIPS.has(clip)) {
        body.updateMatrixWorld(true);
        scratchBox.current.setFromObject(body);
        groundCorrection.current = Math.max(0, scratchBox.current.min.y - fit.floor);
      } else if (groundCorrection.current !== 0) {
        groundCorrection.current = 0;
      }
    }
    // Driven every frame, or a re-render's `position` prop would reapply fit.floor and undo it.
    node.position.y = MathUtils.damp(node.position.y, fit.floor - groundCorrection.current, 8, delta);

    if (lock) return;
    nextChange.current -= delta;
    if (nextChange.current <= 0) {
      const greet = (mood === "idle" || mood === "calm") && Math.random() < GREET_CHANCE;
      const name = greet
        ? pick(CLIPS.greet)
        : pick(poolFor(mood), active.current?.getClip().name);
      play(name, { once: greet });
      nextChange.current = greet
        ? (actions.current.get(name)?.getClip().duration ?? 2)
        : DWELL.min + Math.random() * (DWELL.max - DWELL.min);
    }
  });

  // Two groups: most models sit metres off their origin, so the inner one recentres
  // the body before the outer one turns it.
  return (
    <group ref={group} position={[0, fit.floor, 0]} scale={fit.scale} rotation={[0, facing, 0]}>
      <group position={fit.offset}>
        <primitive object={body} />
      </group>
    </group>
  );
}

export function preloadCharacter(id: string): void {
  preloadModel(characterModelPath(id));
  preloadModel(characterModelPath(ANIMATION_LIBRARY));
}
