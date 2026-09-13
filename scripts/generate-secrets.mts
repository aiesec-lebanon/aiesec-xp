// Fills in any missing local secret in .env.local. Generates 32 random bytes
// per secret and prints only whether each was written, never the value.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const path = ".env.local";
let text = readFileSync(path, "utf8");

for (const key of ["SESSION_SECRET", "CRON_SECRET"]) {
  const line = new RegExp(`^\s*${key}\s*=.*$`, "m");
  const current = line.exec(text)?.[0]?.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (current.length >= 32) {
    console.log(`${key}: already set, left alone`);
    continue;
  }
  const value = randomBytes(32).toString("base64");
  text = line.test(text)
    ? text.replace(line, `${key}="${value}"`)
    : `${text.replace(/\s*$/, "")}\n${key}="${value}"\n`;
  console.log(`${key}: generated`);
}

writeFileSync(path, text);
