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

export type CharacterPhase = "settled" | "leaving" | "arriving";

export type CharacterModelProps = {
  id: string;
  mood?: CharacterMood;
  phase?: CharacterPhase;
  direction?: 1 | -1;
  exitDistance?: number;
  travelSeconds?: number;
  heightFraction?: number;
  floorFraction?: number;
  /** Radians of yaw while standing, so a group can face inwards. */
  facing?: number;
  /** Load the social clips too. Only the surfaces that use them pay for them. */
  social?: boolean;
  /**
   * A clip to play once because something happened. Changing this is the whole
   * trigger, so a surface bumps it rather than calling into the body.
   */
  beat?: string | null;
};

// What XpCanvas's camera sees at the origin: fov 42 vertical, 6 units back. fov
// is vertical, so a share of this is the same share of the canvas at any size.
export const FRAME_HEIGHT = 2 * 6 * Math.tan((42 * Math.PI) / 360);

const CROSSFADE = 0.35;
const DWELL = { min: 5, max: 11 };
const GREET_CHANCE = 0.25;
/** Seconds the walk takes to get going, and to come to a halt. */
const START = 0.42;
const STOP = 0.5;

function pick<T>(from: readonly T[], not?: T): T {
  const options = from.length > 1 && not !== undefined ? from.filter((v) => v !== not) : from;
  return options[Math.floor(Math.random() * options.length)]!;
}

function poolFor(mood: CharacterMood): readonly string[] {
  if (mood === "celebrate") return CLIPS.celebrate;
  if (mood === "empty") return CLIPS.idleEmpty;
  if (mood === "calm") return CLIPS.idleCalm;
  return CLIPS.idle;
}

/**
 * Drop tracks that address a bone this character does not have.
 *
 * Juno was auto-rigged onto the 33-bone skeleton, which is the 65-bone one minus
 * fingers, so the clips carry finger tracks she has no target for.
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
  facing = 0,
  social = false,
  beat = null,
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
  const elapsed = useRef(0);
  const legPhase = useRef<"start" | "cruise" | "stop">("start");

  const body = useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return copy;
  }, [scene]);

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
    // Starting part-way in is what stops a row of characters moving as one body:
    // three identical clips begun on the same frame stay locked together forever.
    if (offset) action.time = offset % action.getClip().duration;
    if (active.current) action.crossFadeFrom(active.current, fade, true);
    action.play();
    active.current = action;
  };

  const settle = (fade = 0.3) => {
    const clip = pick(poolFor(mood));
    const duration = actions.current.get(clip)?.getClip().duration ?? 4;
    play(clip, { fade, offset: Math.random() * duration, speed: 0.94 + Math.random() * 0.12 });
    // A random first interval too, or every body in a group changes on the same beat.
    nextChange.current = Math.random() * DWELL.max;
  };

  useEffect(() => {
    if (!mixer.current) return;
    elapsed.current = 0;

    if (phase === "leaving") {
      legPhase.current = "start";
      const start = actions.current.get(CLIPS.walkStart);
      play(CLIPS.walkStart, {
        once: true,
        fade: 0.18,
        speed: start ? start.getClip().duration / START : 1,
      });
      return;
    }
    if (phase === "arriving") {
      legPhase.current = "cruise";
      play(CLIPS.walk, { fade: 0.12 });
      return;
    }

    settle(0.25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, direction, mood, body, core, extra]);

  useEffect(() => {
    if (!beat || !mixer.current || phase !== "settled" || reduceMotion) return;
    play(beat, { once: true, fade: 0.2 });
    // Hold the idle picker off until the beat has played out, or the next frame
    // whose dwell has expired cuts it short.
    nextChange.current = actions.current.get(beat)?.getClip().duration ?? 2;
  }, [beat, phase, reduceMotion, body, core, extra]);

  useEffect(() => {
    if (!reduceMotion || !mixer.current) return;
    mixer.current.update(0);
    invalidate();
  }, [reduceMotion, invalidate, phase, mood, body, core, extra]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node || !mixer.current) return;

    if (reduceMotion) {
      mixer.current.update(0);
      return;
    }
    mixer.current.update(delta);

    if (phase === "settled") {
      node.rotation.y = MathUtils.damp(node.rotation.y, facing, 3.2, delta);
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
      return;
    }

    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / travelSeconds);

    if (phase === "leaving") {
      if (legPhase.current === "start" && elapsed.current >= START) {
        legPhase.current = "cruise";
        play(CLIPS.walk, { fade: 0.22 });
      }
      // Eased out of standing, then a constant pace: a walk that eases the whole
      // way is a walk that never commits.
      const eased = t < 0.3 ? (t / 0.3) ** 2 * 0.3 : t;
      node.position.x = fit.position[0] + direction * exitDistance * eased;
      return;
    }

    const remaining = travelSeconds - elapsed.current;
    if (legPhase.current === "cruise" && remaining <= STOP) {
      legPhase.current = "stop";
      const stop = actions.current.get(CLIPS.walkStop);
      play(CLIPS.walkStop, {
        once: true,
        fade: 0.18,
        speed: stop ? stop.getClip().duration / STOP : 1,
      });
    }
    const eased = t > 0.7 ? 0.7 + (1 - (1 - (t - 0.7) / 0.3) ** 2) * 0.3 : t;
    node.position.x = fit.position[0] + direction * exitDistance * (eased - 1);
  });

  const walking = phase !== "settled" && !reduceMotion;
  // The bodies are exported facing +Z, so a quarter turn puts them in profile,
  // walking the way they are travelling.
  const heading = walking ? (direction * Math.PI) / 2 : facing;
  const start = phase === "arriving" && walking ? -direction * exitDistance : 0;

  return (
    <group
      ref={group}
      position={[fit.position[0] + start, fit.position[1], fit.position[2]]}
      scale={fit.scale}
      rotation={[0, heading, 0]}
    >
      <primitive object={body} />
    </group>
  );
}

export function preloadCharacter(id: string): void {
  preloadModel(characterModelPath(id));
  preloadModel(characterModelPath(ANIMATION_LIBRARY));
}
