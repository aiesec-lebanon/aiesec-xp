"use client";

import { Environment, type EnvironmentProps } from "@react-three/drei";

import { hdriPath, type HdriEnvironment } from "@/lib/three/assets";

export type SceneEnvironmentProps = Omit<EnvironmentProps, "preset" | "files" | "path"> & {
  environment?: HdriEnvironment;
};

// drei's `preset` prop resolves to the pmndrs GitHub CDN. These are the same
// CC0 Poly Haven maps, extracted from @pmndrs/assets into public/hdri at install
// time, so the lighting works offline and under a self-only CSP.
export function SceneEnvironment({ environment = "city", ...props }: SceneEnvironmentProps) {
  return <Environment files={hdriPath(environment)} {...props} />;
}
