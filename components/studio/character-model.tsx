"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Box3, Group, Mesh, Vector3 } from "three";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { characterModelPath } from "@/lib/design/character";
import { preloadModel, useModel } from "@/lib/three/loaders";

/** Seconds the body takes to turn and settle when it is swapped in. */
const ENTRY_SECONDS = 0.5;

export type CharacterModelProps = {
  /** Which of the four bodies. */
  id: string;
  /** Rendered height in world units. Defaults to most of the frame. */
  height?: number;
  /** Turn and settle on mount, for a body that has just been swapped in. */
  animate?: boolean;
};

// What XpCanvas's camera sees at the origin: fov 42 vertical, 6 units back.
// fov is vertical, so a body given a share of this fills that same share of the
// canvas at any pixel size.
export const FRAME_HEIGHT = 2 * 6 * Math.tan((42 * Math.PI) / 360);

export function CharacterModel({
  id,
  height = FRAME_HEIGHT * 0.9,
  animate = false,
}: CharacterModelProps) {
  const { scene } = useModel(characterModelPath(id));
  const reduceMotion = useReduceMotion();
  const group = useRef<Group>(null);
  const elapsed = useRef(0);

  const body = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return copy;
  }, [scene]);

  // The export bakes the pose into the geometry and stands the body at the
  // origin (D-52), so these bounds are the body that gets drawn. They were not
  // when the models shipped rigged: Box3 reads geometry, which was still the
  // bind pose, and each character came out a different size.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(body);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const scale = size.y > 0 ? height / size.y : 1;
    const floor = -FRAME_HEIGHT / 2 + FRAME_HEIGHT * 0.02;
    return {
      scale,
      position: [-centre.x * scale, floor - box.min.y * scale, -centre.z * scale] as const,
    };
  }, [body, height]);

  const playing = animate && !reduceMotion;

  useFrame((_, delta) => {
    const node = group.current;
    if (!node || !playing || elapsed.current >= ENTRY_SECONDS) return;

    elapsed.current = Math.min(ENTRY_SECONDS, elapsed.current + delta);
    const t = elapsed.current / ENTRY_SECONDS;
    const eased = 1 - (1 - t) ** 3;
    node.rotation.y = (1 - eased) * -0.8;
    node.scale.setScalar(fit.scale * (0.88 + 0.12 * eased));
  });

  return (
    <group
      ref={group}
      position={fit.position}
      scale={playing ? fit.scale * 0.88 : fit.scale}
      rotation={[0, playing ? -0.8 : 0, 0]}
    >
      <primitive object={body} />
    </group>
  );
}

export function preloadCharacter(id: string): void {
  preloadModel(characterModelPath(id));
}

/* ---------------------------------------------------------------------------
 * Parked: per-part recolouring (D-52).
 *
 * The models ship with their authored materials -- one per character -- so
 * there are no per-part slots to tint. This ran when `avatar-parts.py` split
 * them, and needs that export back before it means anything again. It also
 * needed SkeletonUtils.clone and the posed-bounds walk above, because the split
 * models shipped rigged.
 *
 * const PART_OF_MATERIAL = new Map<string, CharacterPart>();
 *
 * function partOf(materialName: string): CharacterPart | undefined {
 *   const cached = PART_OF_MATERIAL.get(materialName);
 *   if (cached) return cached;
 *   const part = CHARACTER_PARTS.find((p) => materialName.endsWith(`-${p}`));
 *   if (part) PART_OF_MATERIAL.set(materialName, part);
 *   return part;
 * }
 *
 * // Materials cannot be shared between two members wearing different colours.
 * node.material = Array.isArray(node.material)
 *   ? node.material.map((m) => m.clone())
 *   : node.material.clone();
 *
 * // What each part was authored with, so clearing a choice puts it back -- and
 * // so the lab could show it as the default a member starts on.
 * const authored = useMemo(() => {
 *   const byMaterial = new Map<string, Color>();
 *   const byPart: Partial<Record<CharacterPart, string>> = {};
 *   body.traverse((node) => {
 *     if (!(node instanceof Mesh)) return;
 *     for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
 *       if (!(material instanceof MeshStandardMaterial)) continue;
 *       byMaterial.set(material.uuid, material.color.clone());
 *       const part = partOf(material.name);
 *       if (part) byPart[part] = `#${material.color.getHexString().toUpperCase()}`;
 *     }
 *   });
 *   return { byMaterial, byPart };
 * }, [body]);
 *
 * useEffect(() => {
 *   body.traverse((node) => {
 *     if (!(node instanceof Mesh)) return;
 *     for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
 *       if (!(material instanceof MeshStandardMaterial)) continue;
 *       // A material with no part is `detail` -- eyes, a printed logo, a shoe's
 *       // trim -- which keeps the colour it was painted with.
 *       const part = partOf(material.name);
 *       if (!part) continue;
 *
 *       const chosen = colours?.[part];
 *       // set() converts from sRGB itself under three's colour management.
 *       if (chosen) material.color.set(chosen);
 *       else material.color.copy(authored.byMaterial.get(material.uuid) ?? material.color);
 *       material.needsUpdate = true;
 *     }
 *   });
 * }, [authored, body, colours]);
 * ------------------------------------------------------------------------- */
