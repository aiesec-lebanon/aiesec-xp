// Re-seals every optimised licensed model in assets/models/ into assets/sealed/
// (D-91). `npm run assets:models` already seals what it writes; this is for a
// new MODEL_KEY, or a checkout that has the models but not their sealed copies.
//
//   npm run assets:seal

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseModelKey, sealAtRest } from "../../lib/models/sealing";

const SOURCE_DIR = "assets/models";
const SEALED_DIR = "assets/sealed";

process.loadEnvFile(".env.local");
const key = parseModelKey(process.env.MODEL_KEY);

const models = (await readdir(SOURCE_DIR)).filter((file) => file.endsWith(".glb"));
if (models.length === 0) {
  console.error(`No .glb files in ${SOURCE_DIR}. Run npm run assets:models first.`);
  process.exit(1);
}

await mkdir(SEALED_DIR, { recursive: true });
for (const file of models) {
  const name = path.parse(file).name;
  await writeFile(path.join(SEALED_DIR, `${name}.bin`), sealAtRest(await readFile(path.join(SOURCE_DIR, file)), key));
  console.log(`sealed ${name}`);
}
