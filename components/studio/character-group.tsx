"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, Group, type PerspectiveCamera as PerspectiveCameraImpl } from "three";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { SceneEnvironment } from "@/components/three/environment";
import { Scene } from "@/components/three/scene";
import { characterStillPath, type CharacterMood } from "@/lib/design/character";

import { CharacterModel, FRAME_HEIGHT } from "./character-model";
import { circleGroup, groundY, orbitDistance, type Placement } from "./group-layout";
import {
  angleDiff,
  dampAngle,
  makeSlot,
  pick,
  resolveSeparation,
  seconds,
  useCameraFacingScheduler,
  useExchangeScheduler,
  useRefArray,
  type Slot,
  BOUNCE_AMP,
  BOUNCE_FREQ,
  BOUNCE_RISE,
  CLUSTER_RADIUS,
  DECEL_RADIUS,
  FACE_LAMBDA,
  JUMP_BURST,
  JUMP_GAP,
  MEET_RADIUS,
  STAND_DWELL,
  TURN_ALIGN,
  TURN_LAMBDA,
  WALK_SPEED,
  WANDER_CHANCE,
} from "./group-wander";

export type GroupMember = {
  id: string;
  name: string;
};

const SURPRISE_CLIPS = ["cheer", "cheer-2", "clap", "rally", "victory", "dance", "dance-silly", "dance-silly-2"];

/**
 * Several bodies in one canvas, standing in a circle on one floor, a camera
 * orbiting around them.
 *
 * The group used to stand in a depth-staggered row in front of a fixed
 * camera (D-55) -- a stage a static viewer stands in front of. A circle asks
 * the opposite of the layout: nobody has a back row, everybody is close to
 * everybody else, and a camera that orbits is what makes it read as a circle
 * rather than a row seen from an angle (D-63). Reviewed first as a standalone
 * artifact before landing here, because the failure modes of several
 * independently wandering bodies -- walking through each other, spinning
 * the wrong way round a turn, jumping mid-stride -- are much cheaper to find
 * on a page that is not the shipped leaderboard.
 *
 * All the physics for every body -- position, facing, collision, who is
 * talking to whom, who is jumping -- is decided in one place (`Bodies`'
 * own frame, below) rather than independently per body, because collision
 * and conversation both need to see every position at once. Each body only
 * *reads* the result to drive its own node and its own React state; see the
 * comment on `Slot` in group-wander.ts for why the split runs this way round.
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
  /** Order does not matter any more -- a circle has no best seat. */
  members: GroupMember[];
  mood?: CharacterMood;
  /**
   * Lets each body break from `mood` into dancing now and then, on its own
   * independent timer, and adds the jump-in-place bursts that go with it.
   * Everybody reacting on the same beat is as artificial as nobody reacting
   * (D-54), and a group that all danced or jumped together would be the same
   * fault at a different clip (D-62/D-63).
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
  const { places, radius } = useMemo(
    () => circleGroup(members.length, heightFraction),
    [members.length, heightFraction],
  );
  const floor = groundY(floorFraction);
  const shadow = useShadowTexture();
  const reduceMotion = useReduceMotion();
  const camera = useThree((state) => state.camera);

  // One shared array, owned here and mutated only from this component's own
  // frame and the two schedulers below -- every body reads its own entry
  // (and its neighbours', for collision and conversation) but never writes
  // one, which is what let those reads stay plain, ref-cheap lookups instead
  // of needing their own state.
  const slots = useRefArray<Slot>(members.length, (index) => {
    const place = places[index]!;
    return makeSlot(place.x, place.z, place.angle + Math.PI);
  });

  useExchangeScheduler(slots);
  useCameraFacingScheduler(slots);

  const jump = flourish && mood === "celebrate";

  useFrame((_, delta) => {
    if (reduceMotion) return;
    const list = slots.current;

    for (let index = 0; index < list.length; index += 1) {
      const slot = list[index]!;
      const inBeat = false; // beats are fire-and-forget from here; see GroupBody.

      if (slot.moveState === "seek") {
        tickSeek(slot, index, list, delta);
      } else {
        tickStand(slot, list, delta, camera.position, inBeat);
      }
      tickBounce(slot, delta, jump && slot.moveState === "stand");
    }
  });

  const orbitRadius = orbitDistance(radius);
  const lookY = floor + FRAME_HEIGHT * heightFraction * 0.55;

  return (
    <>
      <OrbitingCamera distance={orbitRadius} lookY={lookY} active={!reduceMotion} />
      {members.map((member, index) => (
        <GroupBody
          key={`${member.id}-${index}`}
          id={member.id}
          index={index}
          place={places[index]!}
          mood={mood}
          floor={floor}
          floorFraction={floorFraction}
          slots={slots}
          shadow={shadow}
        />
      ))}
    </>
  );
}

/** The camera. The wall, floor and horizon stay exactly where they are --
 * only this moves, which is what makes a ring of bodies actually read as a
 * circle rather than a row seen edge-on. */
function OrbitingCamera({
  distance,
  lookY,
  active,
  secondsPerRev = 70,
}: {
  distance: number;
  lookY: number;
  active: boolean;
  secondsPerRev?: number;
}) {
  const camera = useRef<PerspectiveCameraImpl>(null);
  const angle = useRef(0);
  const seeded = useRef(false);

  useEffect(() => {
    // A random starting angle, seeded once on mount -- reading `Math.random`
    // during render is what this effect avoids.
    angle.current = Math.random() * Math.PI * 2;
    seeded.current = true;
  }, []);

  useFrame((_, delta) => {
    const cam = camera.current;
    if (!cam || !seeded.current) return;
    if (active) angle.current += (delta * Math.PI * 2) / secondsPerRev;
    cam.position.set(Math.sin(angle.current) * distance, lookY + 0.35, Math.cos(angle.current) * distance);
    cam.lookAt(0, lookY, 0);
  });

  return <PerspectiveCamera ref={camera} makeDefault fov={42} near={0.1} far={60} />;
}

/**
 * One body: the shadow, a bounce group for the jump offset, and the model
 * itself. Reads its own entry in the shared `slots` every frame -- never
 * writes one, which is `Bodies`' job -- and owns its own Group node and its
 * own `mood`/`lock`/`beat` React state, which is what it writes.
 */
function GroupBody({
  id,
  index,
  place,
  mood,
  floor,
  floorFraction,
  slots,
  shadow,
}: {
  id: string;
  index: number;
  place: Placement;
  mood: CharacterMood;
  floor: number;
  floorFraction: number;
  slots: React.RefObject<Slot[]>;
  shadow: CanvasTexture;
}) {
  const reduceMotion = useReduceMotion();
  const outer = useRef<Group>(null);
  const bounceGroup = useRef<Group>(null);

  const [lock, setLock] = useState<string | null>(null);
  const [beat, setBeat] = useState<string | null>(null);
  const appliedBeatToken = useRef(0);
  const pendingBeat = useRef<string | null>(null);

  const blob = place.fraction * FRAME_HEIGHT * 0.52;

  useEffect(() => {
    const node = outer.current;
    if (!node) return;
    node.position.set(place.x, 0, place.z);
    node.rotation.y = place.angle + Math.PI;
    // Mount only: this component's own frame below owns both from here on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const node = outer.current;
    const slot = slots.current[index];
    if (!node || !slot || reduceMotion) return;

    node.position.set(slot.x, 0, slot.z);
    node.rotation.y = slot.facing;
    if (bounceGroup.current) bounceGroup.current.position.y = slot.bounceY;

    setLock(slot.lockWant);

    // A beat can repeat the same clip two exchanges in a row ("agree" is a
    // single clip), which a plain string can't tell apart from "still
    // playing the last one" -- `beatToken` is what actually changed, and a
    // one-frame null in between is what lets CharacterModel's own beat
    // effect, which only fires on a *change*, re-fire the repeat.
    if (slot.beatToken !== appliedBeatToken.current) {
      appliedBeatToken.current = slot.beatToken;
      pendingBeat.current = slot.beatWant;
      setBeat(null);
    } else if (pendingBeat.current) {
      setBeat(pendingBeat.current);
      pendingBeat.current = null;
    }
  });

  return (
    <group ref={outer}>
      <mesh position={[0, floor + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[blob, blob * 0.62]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <group ref={bounceGroup}>
        <CharacterModel
          id={id}
          mood={mood}
          facing={0}
          lock={lock}
          beat={beat}
          heightFraction={place.fraction}
          floorFraction={floorFraction}
          social
        />
      </group>
    </group>
  );
}

function tickStand(
  slot: Slot,
  slots: readonly Slot[],
  delta: number,
  cameraPos: { x: number; y: number; z: number },
  inBeat: boolean,
) {
  if (slot.exchangeRole && slot.exchangePartner !== null) {
    const partner = slots[slot.exchangePartner];
    if (partner) {
      const desired = Math.atan2(partner.x - slot.x, partner.z - slot.z);
      slot.facing = dampAngle(slot.facing, desired, FACE_LAMBDA, delta);
    }
  } else if (slot.faceCamera) {
    const desired = Math.atan2(cameraPos.x - slot.x, cameraPos.z - slot.z);
    slot.facing = dampAngle(slot.facing, desired, FACE_LAMBDA, delta);
  }

  if (slot.lockWant !== null) slot.lockWant = null;

  if (!slot.exchangeRole && !inBeat) {
    slot.standTimer -= delta;
    if (slot.standTimer <= 0) {
      if (Math.random() < WANDER_CHANCE) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * CLUSTER_RADIUS;
        slot.target = { x: slot.home.x + Math.cos(angle) * dist, z: slot.home.z + Math.sin(angle) * dist };
        slot.moveState = "seek";
      }
      slot.standTimer = seconds(STAND_DWELL) / 1000;
    }
  }
}

function tickSeek(slot: Slot, index: number, slots: readonly Slot[], delta: number) {
  // Meeting someone ends the walk on the spot, before anything else moves
  // this frame -- a different animation, exactly as asked, never another
  // walk into the body it just met.
  for (let i = 0; i < slots.length; i += 1) {
    if (i === index) continue;
    const other = slots[i]!;
    if (other.moveState === "seek") continue;
    if (Math.hypot(slot.x - other.x, slot.z - other.z) < MEET_RADIUS) {
      slot.moveState = "stand";
      slot.target = null;
      slot.standTimer = seconds(STAND_DWELL) / 1000;
      slot.lockWant = null;
      slot.beatWant = pick(SURPRISE_CLIPS);
      slot.beatToken += 1;
      return;
    }
  }

  const target = slot.target;
  if (!target) {
    slot.moveState = "stand";
    return;
  }

  const dx = target.x - slot.x;
  const dz = target.z - slot.z;
  const distance = Math.hypot(dx, dz);

  if (distance < 0.05) {
    slot.moveState = "stand";
    slot.target = null;
    slot.standTimer = seconds(STAND_DWELL) / 1000;
    slot.lockWant = null;
    return;
  }

  const desiredHeading = Math.atan2(dx, dz);
  slot.facing = dampAngle(slot.facing, desiredHeading, TURN_LAMBDA, delta);
  const alignment = Math.cos(angleDiff(slot.facing, desiredHeading));
  const speedScale = clamp01(alignment) * clamp01(distance / DECEL_RADIUS);
  const speed = WALK_SPEED * speedScale;

  // Turn-left/turn-right are decorative here, not the rotation authority:
  // the body's actual heading is always the damped value above, so nothing
  // about this clip ending or crossfading out can ever snap it back to a
  // stale direction.
  slot.lockWant =
    alignment < TURN_ALIGN ? (angleDiff(slot.facing, desiredHeading) > 0 ? "turn-right" : "turn-left") : "walk";

  const move = speed * delta;
  const [nx, nz] = resolveSeparation(index, slot.x + Math.sin(slot.facing) * move, slot.z + Math.cos(slot.facing) * move, slots);
  slot.x = nx;
  slot.z = nz;
}

/** Jump-in-place: its own rare event, never while walking, eased in and out
 * so a burst starting or ending is never a pop. `wantsToJump` is only ever
 * true for a group that opted into flourishing -- a calm group never jumps. */
function tickBounce(slot: Slot, delta: number, wantsToJump: boolean) {
  if (wantsToJump) {
    slot.nextJump -= delta;
    if (slot.nextJump <= 0 && slot.jumpUntil <= 0) slot.jumpUntil = seconds(JUMP_BURST) / 1000;
    if (slot.jumpUntil > 0) {
      slot.jumpUntil -= delta;
      slot.bounceWant = BOUNCE_AMP;
      if (slot.jumpUntil <= 0) slot.nextJump = seconds(JUMP_GAP) / 1000;
    } else {
      slot.bounceWant = 0;
    }
  } else {
    slot.bounceWant = 0;
  }
  slot.bounceAmp += (slot.bounceWant - slot.bounceAmp) * (1 - Math.exp(-(1 / BOUNCE_RISE) * delta));
  slot.bouncePhase += delta * BOUNCE_FREQ * Math.PI * 2;
  slot.bounceY = Math.abs(Math.sin(slot.bouncePhase)) * slot.bounceAmp;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
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
