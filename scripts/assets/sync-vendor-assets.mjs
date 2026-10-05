import { createRequire } from "node:module";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Must match lib/three/assets.ts (asserted by tests/visual-stack.test.ts).
const HDRI_ENVIRONMENTS = ["city", "studio", "park"];

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
    // Decoded to a binary so the data URI never lands in the JS bundle.
    const bytes = Buffer.from(encoded, "base64");
    await writeFile(path.join(to, `${name}.exr`), bytes);
    written.push(`${name} ${Math.round(bytes.length / 1024)}kB`);
  }
  return `${path.relative(root, to).replaceAll("\\", "/")} (${written.join(", ")})`;
}

const [draco, hdri] = await Promise.all([syncDraco(), syncHdris()]);
console.log(`vendor assets: ${draco}, ${hdri}`);
