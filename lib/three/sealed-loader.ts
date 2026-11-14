"use client";

import { useLoader } from "@react-three/fiber";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { openTransport } from "@/lib/models/transport";

import { DRACO_DECODER_PATH } from "./assets";

// The licensed characters arrive sealed from /api/models (D-91). This loader
// opens them in memory and parses the buffer directly, so the plain .glb never
// exists at a URL -- not even a blob: one -- that a viewer could save.
class SealedGLTFLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void {
    const fail = (error: unknown) => {
      onError?.(error);
      this.manager.itemError(url);
      this.manager.itemEnd(url);
    };
    this.manager.itemStart(url);
    fetch(url, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(openTransport)
      .then((buffer) =>
        this.parse(
          buffer,
          "",
          (gltf) => {
            onLoad(gltf);
            this.manager.itemEnd(url);
          },
          fail,
        ),
      )
      .catch(fail);
  }
}

let draco: DRACOLoader | null = null;

function withDraco(loader: SealedGLTFLoader): void {
  draco ??= new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
}

export function useSealedModel(path: string): GLTF {
  return useLoader(SealedGLTFLoader, path, withDraco);
}

export function preloadSealedModel(path: string): void {
  useLoader.preload(SealedGLTFLoader, path, withDraco);
}
