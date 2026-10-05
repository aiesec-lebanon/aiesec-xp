"use client";

let cached: boolean | undefined;

export function supportsWebGL(): boolean {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    cached = gl !== null;
    // Chrome leaks the context until GC otherwise, and probing runs on every mount.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }

  return cached;
}
