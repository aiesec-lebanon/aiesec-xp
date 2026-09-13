// Diagnoses the sign-in redirect. Prints the authorize URL with the client id
// masked, then follows it to see where AIESEC actually sends the browser.
import { readFileSync } from "node:fs";

const raw = readFileSync(".env.local", "utf8");
const env: Record<string, string> = {};
for (const line of raw.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const base = env.AIESEC_AUTH_URL ?? "";
const clientId = env.AIESEC_CLIENT_ID ?? "";
const redirectUri = env.AIESEC_REDIRECT_URI ?? "";

console.log("AIESEC_AUTH_URL      :", base || "(not set)");
console.log("AIESEC_REDIRECT_URI  :", redirectUri || "(not set)");
console.log("AIESEC_CLIENT_ID set :", clientId.length > 0, `(length ${clientId.length})`);
console.log("AIESEC_CLIENT_SECRET set :", (env.AIESEC_CLIENT_SECRET ?? "").length > 0);

const mask = (s: string) => (clientId ? s.split(clientId).join("<client_id>") : s);

const params = new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  redirect_uri: redirectUri,
  state: "diagnostic",
});
const url = `${base.replace(/\/$/, "")}/authorize?${params.toString()}`;
console.log("\nauthorize URL        :", mask(url));

const response = await fetch(url, { redirect: "manual" });
console.log("\nresponse status      :", response.status);
console.log("location             :", mask(response.headers.get("location") ?? "(none)"));

// Follow the chain so we can see the final destination the browser reaches.
let current = url;
for (let hop = 0; hop < 5; hop += 1) {
  const res = await fetch(current, { redirect: "manual" });
  const next = res.headers.get("location");
  console.log(`  hop ${hop}: ${res.status} -> ${mask(next ?? "(end)")}`);
  if (!next) break;
  current = next.startsWith("http") ? next : new URL(next, current).toString();
}
