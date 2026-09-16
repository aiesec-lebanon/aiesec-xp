// Every 3D asset is served from our own origin. The upstream defaults are CDNs
// -- three points DRACOLoader at google.com, drei points Environment at the
// pmndrs GitHub CDN -- which Architecture.md 10 rules out and the CSP blocks.
// scripts/assets/sync-vendor-assets.mjs puts the real files under public/.

export const HDRI_ENVIRONMENTS = ["city", "studio", "park"] as const;

export type HdriEnvironment = (typeof HDRI_ENVIRONMENTS)[number];

export const DRACO_DECODER_PATH = "/draco/";

/**
 * drei's <Text> falls back to a jsdelivr-hosted font resolver when given no
 * `font`, and <Text3D> needs a typeface JSON. Both are served from here instead;
 * components/three/text.tsx wires them in so no call site has to remember.
 */
export const SCENE_FONT = {
  sdf: "/fonts/inter_bold.woff",
  typeface: "/fonts/inter_bold.json",
} as const;

export function hdriPath(environment: HdriEnvironment): string {
  return `/hdri/${environment}.exr`;
}

export function modelPath(name: string): string {
  return `/models/${name}.glb`;
}
