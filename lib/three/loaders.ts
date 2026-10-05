"use client";

import { useGLTF } from "@react-three/drei";

import { DRACO_DECODER_PATH } from "./assets";

// drei defaults the Draco decoder to a Google CDN, which the CSP blocks.
useGLTF.setDecoderPath(DRACO_DECODER_PATH);

export function useModel(path: string) {
  return useGLTF(path, true);
}

export function preloadModel(path: string): void {
  useGLTF.preload(path, true);
}
