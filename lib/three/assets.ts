// Served from our own origin: the upstream CDN defaults are blocked by the CSP.
// scripts/assets/sync-vendor-assets.mjs copies the files under public/.

export const HDRI_ENVIRONMENTS = ["city", "studio", "park"] as const;

export type HdriEnvironment = (typeof HDRI_ENVIRONMENTS)[number];

export const DRACO_DECODER_PATH = "/draco/";

export function hdriPath(environment: HdriEnvironment): string {
  return `/hdri/${environment}.exr`;
}

export function modelPath(name: string): string {
  return `/models/${name}.glb`;
}
