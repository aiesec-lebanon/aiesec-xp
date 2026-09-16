"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, ReactNode } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";

// Rapier inlines a 1.5MB WebAssembly module as base64, so it is loaded only when
// a scene actually asks for physics -- never as a cost of the dashboard booting.
// The `loading` fallback has to be null: this renders inside the three.js
// reconciler, which cannot mount a DOM node.
const RapierPhysics = dynamic(
  () => import("@react-three/rapier").then((mod) => mod.Physics),
  { ssr: false, loading: () => null },
);

export type ScenePhysicsProps = Omit<ComponentProps<typeof RapierPhysics>, "children"> & {
  children: ReactNode;
};

// The simulation runs for everyone by default. For the member who has asked for
// less motion it is paused rather than skipped, so bodies hold the transforms
// they were authored at: a physics scene has to be authored at rest, because
// anything left mid-air stays mid-air.
export function ScenePhysics({ children, ...props }: ScenePhysicsProps) {
  const reduceMotion = useReduceMotion();

  return (
    <RapierPhysics timeStep="vary" paused={reduceMotion} {...props}>
      {children}
    </RapierPhysics>
  );
}
