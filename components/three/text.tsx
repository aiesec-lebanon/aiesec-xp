"use client";

import { Text, Text3D, type Text3DProps } from "@react-three/drei";
import type { ComponentProps } from "react";

import { SCENE_FONT } from "@/lib/three/assets";

// Both of drei's text components need a font URL, and the fallback when they are
// not given one is a CDN: troika resolves <Text> through jsdelivr. These wrappers
// default to the self-hosted copies, so text in a scene works offline and is not
// silently blocked by connect-src.

export function SceneText(props: ComponentProps<typeof Text>) {
  return <Text font={SCENE_FONT.sdf} {...props} />;
}

export function SceneText3D(props: Omit<Text3DProps, "font"> & { font?: string }) {
  return <Text3D font={SCENE_FONT.typeface} {...props} />;
}
