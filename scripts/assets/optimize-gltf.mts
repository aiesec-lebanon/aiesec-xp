// Compresses the models in assets/source/ into public/models/, ready to ship --
// except the licensed avatars, which go to assets/models/ (not tracked) and are
// then sealed into assets/sealed/ for app/api/models to serve (D-91).
// A Blender export, a Kenney pack or a Poly Haven download is routinely ten to
// fifty times larger than it needs to be on a phone; this is the step between
// "it looks right in Blender" and "it loads over Lebanese mobile data".
//
//   npm run assets:models            every model in assets/source
//   npm run assets:models mascot     just assets/source/mascot.glb
//
// Draco is the geometry codec because lib/three/loaders.ts already serves its
// decoder from public/draco. Textures become WebP rather than KTX2, which would
// need a second self-hosted transcoder for a saving this product's handful of
// props will not notice.

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

import { parseModelKey, sealAtRest } from "../../lib/models/sealing";

const run = promisify(execFile);

// Invoked through node on the resolved bin rather than npx: the arguments
// include filenames off the disk, and a shell would be free to interpret them.
const CLI = path.join(
  path.dirname(createRequire(import.meta.url).resolve("@gltf-transform/cli")),
  "..",
  "bin",
  "cli.js",
);

const SOURCE_DIR = "assets/source";
const OUTPUT_DIR = "public/models";
const LICENSED_DIR = "assets/models";
const SEALED_DIR = "assets/sealed";
const isLicensed = (name: string) => name.startsWith("avatar-");
const MAX_TEXTURE_PX = 1024;

const requested = process.argv.slice(2).map((name) => name.replace(/\.(glb|gltf)$/i, ""));

const entries = await readdir(SOURCE_DIR).catch(() => {
  console.error(`No ${SOURCE_DIR}/ directory. See assets/README.md.`);
  process.exit(1);
});

const models = entries
  .filter((file) => /\.(glb|gltf)$/i.test(file))
  .filter((file) => requested.length === 0 || requested.includes(path.parse(file).name));

if (models.length === 0) {
  console.error(
    requested.length > 0
      ? `No match in ${SOURCE_DIR} for: ${requested.join(", ")}`
      : `No .glb or .gltf files in ${SOURCE_DIR}.`,
  );
  process.exit(1);
}

if (models.some((file) => isLicensed(path.parse(file).name))) process.loadEnvFile(".env.local");
const key = () => parseModelKey(process.env.MODEL_KEY);

for (const dir of [OUTPUT_DIR, LICENSED_DIR, SEALED_DIR]) await mkdir(dir, { recursive: true });

const kb = (bytes: number) => `${Math.round(bytes / 1024)}kB`;
let failures = 0;

for (const file of models) {
  const input = path.join(SOURCE_DIR, file);
  const name = path.parse(file).name;
  const output = path.join(isLicensed(name) ? LICENSED_DIR : OUTPUT_DIR, `${name}.glb`);

  try {
    const { size: before } = await stat(input);
    await run(process.execPath, [
      CLI,
      "optimize",
      input,
      output,
      "--compress",
      "draco",
      "--texture-compress",
      "webp",
      "--texture-size",
      String(MAX_TEXTURE_PX),
    ]);
    const { size: after } = await stat(output);
    if (isLicensed(name)) {
      await writeFile(path.join(SEALED_DIR, `${name}.bin`), sealAtRest(await readFile(output), key()));
    }
    const saved = Math.round((1 - after / before) * 100);
    console.log(`${file.padEnd(28)} ${kb(before)} -> ${kb(after)}  (-${saved}%)  ${output}`);
  } catch (error) {
    failures += 1;
    console.error(`${file.padEnd(28)} FAILED: ${error instanceof Error ? error.message : error}`);
  }
}

if (failures > 0) process.exit(1);
