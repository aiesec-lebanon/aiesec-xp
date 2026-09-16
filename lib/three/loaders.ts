"use client";

import { useGLTF } from "@react-three/drei";

import { DRACO_DECODER_PATH } from "./assets";

// drei defaults the Draco decoder to a Google CDN. Pointing it at our own copy
// once, here, is what makes every useModel call below safe under the CSP --
// there is no per-call path to forget.
useGLTF.setDecoderPath(DRACO_DECODER_PATH);

/** Loads a Draco-compressed model produced by `npm run assets:models`. */
export function useModel(path: string) {
  return useGLTF(path, true);
}

export function preloadModel(path: string): void {
  useGLTF.preload(path, true);
}
