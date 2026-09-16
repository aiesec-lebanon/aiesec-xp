"use client";

// A WebGL2 context is not guaranteed: the TV mode runs on whatever screen the
// office has, and members open the dashboard on old Android handsets. Every 3D
// surface has to answer "what does this look like without a GPU" before it
// renders, so detection is a precondition, not an error handler.

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
