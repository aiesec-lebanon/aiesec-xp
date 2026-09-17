"use client";

import { useEffect, useMemo, useRef } from "react";
import { Box3, Color, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh, Vector3 } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  CHARACTER_PARTS,
  characterModelPath,
  type CharacterColours,
  type CharacterPart,
} from "@/lib/design/character";
import { preloadModel, useModel } from "@/lib/three/loaders";

const PART_OF_MATERIAL = new Map<string, CharacterPart>();

function partOf(materialName: string): CharacterPart | undefined {
  const cached = PART_OF_MATERIAL.get(materialName);
  if (cached) return cached;
  const part = CHARACTER_PARTS.find((p) => materialName.endsWith(`-${p}`));
  if (part) PART_OF_MATERIAL.set(materialName, part);
  return part;
}

/**
 * The bounds of the body as it is actually posed.
 *
 * Box3.setFromObject reads a skinned mesh's geometry, which is still the bind
 * pose the rig was authored in -- it does not see the skeleton at all. Measuring
 * that way gave each character a different, wrong height, which is why they
 * rendered at inconsistent sizes.
 */
function posedBounds(root: Object3D): Box3 {
  const box = new Box3();
  const point = new Vector3();
  root.updateWorldMatrix(true, true);

  let skinned = false;
  root.traverse((node) => {
    if (node instanceof SkinnedMesh) {
      skinned = true;
      const position = node.geometry.attributes.position;
      for (let i = 0; i < position.count; i += 1) {
        point.fromBufferAttribute(position, i);
        node.applyBoneTransform(i, point);
        box.expandByPoint(node.localToWorld(point));
      }
    } else if (node instanceof Mesh) {
      box.expandByObject(node);
    }
  });

  return skinned ? box : new Box3().setFromObject(root);
}

export type CharacterModelProps = {
  /** Which of the four bodies, from `characterFor(name)`. */
  id: string;
  colours?: CharacterColours;
  /** Rendered height in world units. Defaults to most of the frame. */
  height?: number;
  /**
   * The colour each part was authored with, reported once the body has loaded.
   * Read off the materials rather than held in a table here, so the default a
   * member is shown cannot drift from the .glb it came from.
   */
  onAuthoredColours?: (colours: Partial<Record<CharacterPart, string>>) => void;
};

// What XpCanvas's camera sees at the origin: fov 42 vertical, 6 units back.
// fov is vertical, so a body given a share of this fills that same share of the
// canvas at any pixel size.
const FRAME_HEIGHT = 2 * 6 * Math.tan((42 * Math.PI) / 360);

export function CharacterModel({
  id,
  colours,
  height = FRAME_HEIGHT * 0.9,
  onAuthoredColours,
}: CharacterModelProps) {
  const { scene } = useModel(characterModelPath(id));

  // A skinned mesh cannot be shared between two places in the graph, and its
  // materials cannot be shared between two members wearing different colours.
  const body = useMemo(() => {
    const clone = cloneSkinned(scene);
    clone.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.material = Array.isArray(node.material)
        ? node.material.map((m) => m.clone())
        : node.material.clone();
    });
    return clone;
  }, [scene]);

  // Authoring offsets and proportions differ per character, so the body is
  // measured rather than trusted to arrive at a known size. Its feet land just
  // above the bottom of the frame, which is where the DOM draws the contact
  // shadow; centring it instead left the body floating above its own shadow.
  const fit = useMemo(() => {
    const box = posedBounds(body);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const scale = size.y > 0 ? height / size.y : 1;
    const floor = -FRAME_HEIGHT / 2 + FRAME_HEIGHT * 0.02;
    return {
      scale,
      position: [-centre.x * scale, floor - box.min.y * scale, -centre.z * scale] as const,
    };
  }, [body, height]);

  // What each part was authored with, so clearing a choice puts it back -- and
  // so the lab can show it as the default a member starts on.
  const authored = useMemo(() => {
    const byMaterial = new Map<string, Color>();
    const byPart: Partial<Record<CharacterPart, string>> = {};
    body.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        byMaterial.set(material.uuid, material.color.clone());
        const part = partOf(material.name);
        if (part) byPart[part] = `#${material.color.getHexString().toUpperCase()}`;
      }
    });
    return { byMaterial, byPart };
  }, [body]);

  // Held in a ref, and reported only when the body changes: a caller passing an
  // inline function would otherwise re-run this on every render, and the state
  // it sets would render again.
  const report = useRef(onAuthoredColours);
  useEffect(() => {
    report.current = onAuthoredColours;
  }, [onAuthoredColours]);
  useEffect(() => {
    report.current?.(authored.byPart);
  }, [authored]);

  useEffect(() => {
    body.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        // A material with no part is `detail` -- eyes, a printed logo, a shoe's
        // trim -- which keeps the colour it was painted with.
        const part = partOf(material.name);
        if (!part) continue;

        const chosen = colours?.[part];
        // set() converts from sRGB itself under three's colour management.
        if (chosen) material.color.set(chosen);
        else material.color.copy(authored.byMaterial.get(material.uuid) ?? material.color);
        material.needsUpdate = true;
      }
    });
  }, [authored, body, colours]);

  return (
    <group position={fit.position} scale={fit.scale}>
      <primitive object={body} />
    </group>
  );
}

export function preloadCharacter(id: string): void {
  preloadModel(characterModelPath(id));
}
