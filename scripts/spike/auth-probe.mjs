import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Reports only which authentication scheme GIS accepts. Nothing derived from
// the token value is ever printed, including its length or any substring.

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();
const endpoint = env.GIS_GRAPHQL_URL;
const token = env.GIS_SERVICE_TOKEN ?? "";

console.log("GIS_GRAPHQL_URL:", endpoint ?? "(not set)");
console.log("MC_OFFICE_ID:", env.MC_OFFICE_ID ?? "(not set)");
console.log("GIS_SERVICE_TOKEN set:", token.length > 0);
console.log("GIS_SERVICE_TOKEN still the placeholder:", token === "");
console.log("GIS_SERVICE_TOKEN has surrounding whitespace:", token !== token.trim());
console.log("");

const QUERY = JSON.stringify({ query: "{ currentPerson { id } }" });

const schemes = {
  "Authorization: <token>": { url: endpoint, headers: { Authorization: token } },
  "Authorization: Bearer <token>": { url: endpoint, headers: { Authorization: `Bearer ${token}` } },
  "query param ?access_token=": {
    url: `${endpoint}?access_token=${encodeURIComponent(token)}`,
    headers: {},
  },
  "X-Auth-Token header": { url: endpoint, headers: { "X-Auth-Token": token } },
};

for (const [label, scheme] of Object.entries(schemes)) {
  try {
    const response = await fetch(scheme.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scheme.headers },
      body: QUERY,
    });
    const text = token ? (await response.text()).split(token).join("[redacted]") : await response.text();
    let verdict = `HTTP ${response.status}`;
    try {
      const body = JSON.parse(text);
      if (body?.data?.currentPerson?.id) verdict += " - ACCEPTED, currentPerson resolved";
      else if (body?.data && "currentPerson" in body.data) verdict += " - accepted but currentPerson is null";
      else if (body?.errors?.length) verdict += ` - ${body.errors.map((e) => e?.message).join("; ")}`;
      else if (body?.status) verdict += ` - ${body.status.sub_code ?? ""} ${body.status.message ?? ""}`.trimEnd();
    } catch {
      verdict += ` - non-JSON body (${text.slice(0, 80).replace(/\s+/g, " ")})`;
    }
    console.log(`${label}: ${verdict}`);
  } catch (error) {
    console.log(`${label}: request failed (${error?.message ?? error})`);
  }
}
