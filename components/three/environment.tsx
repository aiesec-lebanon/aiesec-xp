"use client";

import { Environment, type EnvironmentProps } from "@react-three/drei";

import { hdriPath, type HdriEnvironment } from "@/lib/three/assets";

export type SceneEnvironmentProps = Omit<EnvironmentProps, "preset" | "files" | "path"> & {
  environment?: HdriEnvironment;
};

// drei's preset prop loads from a CDN; local HDRIs keep a self-only CSP working.
export function SceneEnvironment({ environment = "city", ...props }: SceneEnvironmentProps) {
  return <Environment files={hdriPath(environment)} {...props} />;
}
