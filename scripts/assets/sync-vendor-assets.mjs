// Copies the Draco decoder and the CC0 HDRIs out of node_modules into public/,
// so the browser fetches them from our own origin. drei's Environment presets
// and three's DRACOLoader both default to a CDN, which the CSP blocks and
// Architecture.md 10 forbids. Runs on postinstall, so the shipped copies can
// never drift from the installed `three` / `@pmndrs/assets` versions.
//
// Keep HDRI_ENVIRONMENTS and SCENE_FONTS in step with lib/three/assets.ts; a
// test asserts it.

import { createRequire } from "node:module";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HDRI_ENVIRONMENTS = ["city", "studio", "park"];

// drei's <Text> resolves fonts through a jsdelivr CDN unless handed a URL, and
// <Text3D> needs a typeface JSON. Both come from @pmndrs/assets instead.
const SCENE_FONTS = ["inter_bold.woff", "inter_bold.json"];

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function syncDraco() {
  // three exports ./examples/jsm/* but not ./package.json, so resolve a file.
  const decoder = require.resolve("three/examples/jsm/libs/draco/gltf/draco_decoder.js");
  const to = path.join(root, "public", "draco");
  await rm(to, { recursive: true, force: true });
  await cp(path.dirname(decoder), to, { recursive: true });
  return path.relative(root, to).replaceAll("\\", "/");
}

async function syncHdris() {
  const to = path.join(root, "public", "hdri");
  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });

  const written = [];
  for (const name of HDRI_ENVIRONMENTS) {
    const source = require.resolve(`@pmndrs/assets/hdri/${name}.exr.js`);
    const encoded = (await readFile(source, "utf8")).match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
    if (!encoded) throw new Error(`@pmndrs/assets/hdri/${name}.exr is not a base64 data URI`);
    // The package inlines each HDRI as a data URI, which would otherwise land in
    // the JS bundle a third larger than the binary it encodes.
    const bytes = Buffer.from(encoded, "base64");
    await writeFile(path.join(to, `${name}.exr`), bytes);
    written.push(`${name} ${Math.round(bytes.length / 1024)}kB`);
  }
  return `${path.relative(root, to).replaceAll("\\", "/")} (${written.join(", ")})`;
}

async function syncFonts() {
  const to = path.join(root, "public", "fonts");
  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });

  const written = [];
  for (const name of SCENE_FONTS) {
    const source = require.resolve(`@pmndrs/assets/fonts/${name}.js`);
    const contents = await readFile(source, "utf8");
    const encoded = contents.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
    if (!encoded) throw new Error(`@pmndrs/assets/fonts/${name} is not a base64 data URI`);
    const bytes = Buffer.from(encoded, "base64");
    await writeFile(path.join(to, name), bytes);
    written.push(`${name} ${Math.round(bytes.length / 1024)}kB`);
  }
  return `${path.relative(root, to).replaceAll("\\", "/")} (${written.join(", ")})`;
}

const [draco, hdri, fonts] = await Promise.all([syncDraco(), syncHdris(), syncFonts()]);
console.log(`vendor assets: ${draco}, ${hdri}, ${fonts}`);
