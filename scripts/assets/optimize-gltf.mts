import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Run the bin through node, not npx, so no shell interprets on-disk filenames.
const CLI = path.join(
  path.dirname(createRequire(import.meta.url).resolve("@gltf-transform/cli")),
  "..",
  "bin",
  "cli.js",
);

const SOURCE_DIR = "assets/source";
const OUTPUT_DIR = "public/models";
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

await mkdir(OUTPUT_DIR, { recursive: true });

const kb = (bytes: number) => `${Math.round(bytes / 1024)}kB`;
let failures = 0;

for (const file of models) {
  const input = path.join(SOURCE_DIR, file);
  const output = path.join(OUTPUT_DIR, `${path.parse(file).name}.glb`);

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
    const saved = Math.round((1 - after / before) * 100);
    console.log(`${file.padEnd(28)} ${kb(before)} -> ${kb(after)}  (-${saved}%)  ${output}`);
  } catch (error) {
    failures += 1;
    console.error(`${file.padEnd(28)} FAILED: ${error instanceof Error ? error.message : error}`);
  }
}

if (failures > 0) process.exit(1);
