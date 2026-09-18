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
  /** Radians of yaw while standing, so a group can face inwards. */
  facing?: number;
  /** Load the social clips too. Only the surfaces that use them pay for them. */
  social?: boolean;
  /**
   * A clip to play once because something happened. Changing this is the whole
   * trigger, so a surface bumps it rather than calling into the body.
   */
  beat?: string | null;
  /**
   * Loops this exact clip instead of cycling `mood`'s pool at random --
   * for locomotion (walk, turn-left, turn-right), where a caller needs the
   * specific clip playing right now, not a random pool member. Releasing it
   * (passing null) resumes the mood pool immediately, not on its next dwell.
   */
  lock?: string | null;
};

// What XpCanvas's camera sees at the origin: fov 42 vertical, 6 units back. fov
// is vertical, so a share of this is the same share of the canvas at any size.
export const FRAME_HEIGHT = 2 * 6 * Math.tan((42 * Math.PI) / 360);

const CROSSFADE = 0.35;
const DWELL = { min: 5, max: 11 };
const GREET_CHANCE = 0.25;

/** Clips authored for a chair this set does not have (D-62's own idle pool). */
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
      // three culls on a bounding sphere it derives from the skin, and these
      // rigs put that sphere about twenty units behind the camera -- so a body
      // standing in plain sight was judged off-screen and never drawn. It is
      // the same bad measurement the fit below refuses to trust, and with a
      // handful of bodies on screen culling was never buying anything.
      node.frustumCulled = false;
    });
    return copy;
  }, [scene]);

  // Measured on the loader's template, which is never added to a scene, rather
  // than on the copy this component mounts. `Box3.setFromObject` reports world
  // space, so measuring the mounted copy folds its own parent group -- and the
  // scale this very memo produced -- back into the next measurement. It only
  // ever recomputes after mount, which is why a group whose size depends on the
  // canvas width (unknown for the first frame) sent bodies to z = -21.
  // Measured on the loader's template, which is never added to a scene. Box3
  // reports world space, so measuring the mounted copy would fold this
  // component's own group -- and the scale this memo produced -- back into the
  // next measurement.
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
    // In model units, because this offset is applied inside the scaled group.
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
    // Hold the idle picker off until the beat has played out, or the next frame
    // whose dwell has expired cuts it short.
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

    // Mixamo's sitting idles are authored against a chair this set does not
    // have, so the hips settle at chair height and the body floats above the
    // floor `fit` put it on rather than sitting on it. Corrected by measuring
    // the actually-posed lowest point -- not just assumed from the clip's
    // name -- so it also catches any other clip that turns out to sit or
    // crouch. Checked a few times a second, not every frame: the pose is
    // holding still by the time it matters, and a full posed bounding box is
    // not free.
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
    // Eased rather than snapped, and driven every frame regardless of whether
    // a correction is active: JSX's own `position` prop on this same group
    // would otherwise re-apply `fit.floor` verbatim on the next unrelated
    // re-render (a mood or beat change) and cancel this out.
    node.position.y = MathUtils.damp(node.position.y, fit.floor - groundCorrection.current, 8, delta);

    // Locked to an exact clip -- a caller driving locomotion, not this
    // component's own random pool -- so the dwell cycle below is not running.
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

  // Two groups, because the pivot has to be the body.
  //
  // Three of the four models carry their vertices metres in front of their own
  // origin -- the bounding sphere of one sits 8.7 units out on z. Turning the
  // group they hang from therefore swung the body through an arc nine units
  // wide, which is what threw a row of characters into a heap and, at a wide
  // enough angle, put one behind the camera. The outer group carries the scale,
  // the turn and where the body stands; the inner one brings the body's centre
  // line and the soles of its feet onto that origin first.
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
