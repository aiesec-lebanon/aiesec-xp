"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, Preload } from "@react-three/drei";
import { Suspense, useCallback, useState, type ReactNode } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { SURFACE } from "@/lib/design/tokens";

export type XpCanvasProps = {
  children: ReactNode;
  fallback: ReactNode;
  onContextLost?: () => void;
  transparent?: boolean;
} & Omit<CanvasProps, "children" | "fallback">;

// dpr is clamped: on a 3x phone devicePixelRatio quadruples fragment cost for no visible gain.
export function XpCanvas({
  children,
  fallback,
  onContextLost,
  transparent = false,
  ...props
}: XpCanvasProps) {
  const reduceMotion = useReduceMotion();
  const [contextLost, setContextLost] = useState(false);

  const handleCreated = useCallback<NonNullable<CanvasProps["onCreated"]>>(
    (state) => {
      // Mobile tab backgrounding drops the context and three doesn't recover on its own.
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
      {transparent ? null : <color attach="background" args={[SURFACE.base]} />}
      <Suspense fallback={null}>{children}</Suspense>
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <Preload all />
    </Canvas>
  );
}
