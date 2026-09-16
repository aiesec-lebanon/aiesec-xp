"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, Preload } from "@react-three/drei";
import { Suspense, useCallback, useState, type ReactNode } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { SURFACE } from "@/lib/design/tokens";

export type XpCanvasProps = {
  children: ReactNode;
  /** Rendered when WebGL is unavailable or the context is lost. */
  fallback: ReactNode;
  /** Raised when the GPU context is lost, so the caller can drop to `fallback`. */
  onContextLost?: () => void;
} & Omit<CanvasProps, "children" | "fallback">;

// Defaults chosen for the two screens this has to survive: a mid-range Android
// phone and whatever the office TV is. dpr is clamped rather than left to
// devicePixelRatio, which on a 3x phone quadruples the fragment cost for no
// visible gain, and AdaptiveDpr drops it further under load instead of dropping
// frames. The frame loop runs for everyone by default (D-46); `demand` renders
// the scene once and then only on invalidation, for the member who asked for
// less motion -- the still image, not the animation.
export function XpCanvas({ children, fallback, onContextLost, ...props }: XpCanvasProps) {
  const reduceMotion = useReduceMotion();
  const [contextLost, setContextLost] = useState(false);

  const handleCreated = useCallback<NonNullable<CanvasProps["onCreated"]>>(
    (state) => {
      // Backgrounding a tab on mobile routinely takes the context with it, and
      // three does not recover on its own; showing the DOM equivalent beats
      // showing a dead black rectangle.
      state.gl.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        setContextLost(true);
        onContextLost?.();
      });
    },
    [onContextLost],
  );

  if (contextLost) return <>{fallback}</>;

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={reduceMotion ? "demand" : "always"}
      performance={{ min: 0.5 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0, 0, 6], fov: 42 }}
      onCreated={handleCreated}
      {...props}
    >
      <color attach="background" args={[SURFACE.base]} />
      <Suspense fallback={null}>{children}</Suspense>
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <Preload all />
    </Canvas>
  );
}

export default XpCanvas;
