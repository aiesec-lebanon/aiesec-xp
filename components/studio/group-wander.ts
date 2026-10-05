"use client";

import { useEffect, useState, type RefObject } from "react";

// Mutable per-frame state, not React state: it changes every frame and neighbours read it.
export type Slot = {
  x: number;
  z: number;
  facing: number;
  home: { x: number; z: number };
  moveState: "stand" | "seek";
  target: { x: number; z: number } | null;
  standTimer: number;
  /** For facing only; the scheduler fires the beats itself. */
  exchangeRole: "speaker" | "listener" | "onlooker" | null;
  exchangePartner: number | null;
  faceCamera: boolean;
  bouncePhase: number;
  bounceAmp: number;
  bounceWant: number;
  bounceY: number;
  nextJump: number;
  jumpUntil: number;
  /** Decided centrally, applied by the body's own frame. */
  lockWant: string | null;
  beatWant: string | null;
  /** Bumped per fire, so a repeated clip name still retriggers. */
  beatToken: number;
};

export function makeSlot(x: number, z: number, facing: number): Slot {
  return {
    x,
    z,
    facing,
    home: { x, z },
    moveState: "stand",
    target: null,
    standTimer: seconds(STAND_DWELL) / 1000,
    exchangeRole: null,
    exchangePartner: null,
    faceCamera: false,
    bouncePhase: Math.random() * 10,
    bounceAmp: 0,
    bounceWant: 0,
    bounceY: 0,
    nextJump: seconds(JUMP_GAP) / 1000,
    jumpUntil: 0,
    lockWant: null,
    beatWant: null,
    beatToken: 0,
  };
}

// Damps along the shortest signed difference so crossing the ±π seam never spins the long way.
export function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  const diff = angleDiff(current, target);
  return current + diff * (1 - Math.exp(-lambda * delta));
}

export function angleDiff(a: number, b: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function pick<T>(list: readonly T[], not?: T): T {
  const options = list.length > 1 && not !== undefined ? list.filter((v) => v !== not) : list;
  return options[Math.floor(Math.random() * options.length)]!;
}

export function seconds([min, max]: readonly [number, number]): number {
  return (min + Math.random() * (max - min)) * 1000;
}

export const CLUSTER_RADIUS = 0.55; // how far a wander target may sit from the body's own circle spot
export const MEET_RADIUS = 0.95;    // a walking body this close to another abandons the walk
const MIN_SEPARATION = 0.62; // closer than this and two standing bodies are pushed apart
export const WALK_SPEED = 0.8;
export const TURN_ALIGN = 0.72;     // cos(heading error) above this switches turn clip -> walk clip
export const DECEL_RADIUS = 0.5;
export const TURN_LAMBDA = 4.2;
export const FACE_LAMBDA = 3.2;
export const BOUNCE_AMP = 0.09;
export const BOUNCE_FREQ = 1.8;
export const BOUNCE_RISE = 0.5;
export const JUMP_BURST: readonly [number, number] = [1.6, 2.8];
export const JUMP_GAP: readonly [number, number] = [14, 30];
export const WANDER_CHANCE = 0.08;
export const STAND_DWELL: readonly [number, number] = [10, 24];
const EXCHANGE_GAP: readonly [number, number] = [6, 15];
const EXCHANGE_REPLY = 0.9;
const EXCHANGE_HOLD = 3.4;
const ONLOOKER_CHANCE = 0.4;
const FACE_CAMERA_REROLL: readonly [number, number] = [7, 14];
const FACE_CAMERA_HOLD: readonly [number, number] = [5, 10];

// Unlike useGroupExchange this works on moving positions and skips bodies mid-walk.
export function useExchangeScheduler(slots: RefObject<Slot[]>) {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(start, seconds(EXCHANGE_GAP));
    };

    const start = () => {
      if (cancelled) return;
      const list = slots.current;
      const eligible = list
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => slot.moveState === "stand" && !slot.faceCamera);

      if (eligible.length < 2) {
        schedule();
        return;
      }

      const speaker = pick(eligible);
      const listener = pick(eligible.filter((e) => e.index !== speaker.index));
      const rest = eligible.filter((e) => e.index !== speaker.index && e.index !== listener.index);
      const onlooker = rest.length && Math.random() < ONLOOKER_CHANCE ? pick(rest) : null;

      const fire = (slot: Slot, clip: string) => {
        slot.beatWant = clip;
        slot.beatToken += 1;
      };

      speaker.slot.exchangeRole = "speaker";
      speaker.slot.exchangePartner = listener.index;
      fire(speaker.slot, pick(TALK_CLIPS));

      listener.slot.exchangeRole = "listener";
      listener.slot.exchangePartner = speaker.index;

      if (onlooker) {
        onlooker.slot.exchangeRole = "onlooker";
        onlooker.slot.exchangePartner = speaker.index;
        fire(onlooker.slot, "glance");
      }

      const replyTimer = setTimeout(() => {
        if (!cancelled) fire(listener.slot, "agree");
      }, EXCHANGE_REPLY * 1000);
      void replyTimer;

      timer = setTimeout(() => {
        speaker.slot.exchangeRole = null;
        speaker.slot.exchangePartner = null;
        listener.slot.exchangeRole = null;
        listener.slot.exchangePartner = null;
        if (onlooker) {
          onlooker.slot.exchangeRole = null;
          onlooker.slot.exchangePartner = null;
        }
        if (!cancelled) schedule();
      }, EXCHANGE_HOLD * 1000);
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const TALK_CLIPS = ["talk", "talk-2", "talk-3", "talk-4"];

export function useCameraFacingScheduler(slots: RefObject<Slot[]>) {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(reroll, seconds(FACE_CAMERA_REROLL));
    };

    const reroll = () => {
      if (cancelled) return;
      const list = slots.current;
      for (const slot of list) slot.faceCamera = false;

      const count = Math.max(1, Math.round(list.length * 0.25));
      const candidates = list
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => slot.moveState === "stand" && !slot.exchangeRole);

      for (let i = 0; i < count && candidates.length; i += 1) {
        const [chosen] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
        if (chosen) chosen.slot.faceCamera = true;
      }

      const holdTimer = setTimeout(() => {
        for (const slot of list) slot.faceCamera = false;
      }, seconds(FACE_CAMERA_HOLD));
      void holdTimer;

      if (!cancelled) schedule();
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function resolveSeparation(
  self: number,
  nx: number,
  nz: number,
  slots: readonly Slot[],
): [number, number] {
  for (let i = 0; i < slots.length; i += 1) {
    if (i === self) continue;
    const other = slots[i]!;
    const dx = nx - other.x;
    const dz = nz - other.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-4 && dist < MIN_SEPARATION) {
      const push = (MIN_SEPARATION - dist) * 0.5;
      nx += (dx / dist) * push;
      nz += (dz / dist) * push;
    }
  }
  return [nx, nz];
}

// useState's lazy initialiser, since refs can't be read or written during render.
export function useRefArray<T>(length: number, make: (index: number) => T): RefObject<T[]> {
  const [container] = useState<{ current: T[] }>(() => ({
    current: Array.from({ length }, (_, index) => make(index)),
  }));
  return container;
}
