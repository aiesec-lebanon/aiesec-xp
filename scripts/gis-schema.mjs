import { writeFileSync } from "node:fs";
import { buildClientSchema, getIntrospectionQuery, printSchema } from "graphql";

process.loadEnvFile(".env.local");

const endpoint = process.env.GIS_GRAPHQL_URL;
const token = process.env.GIS_SERVICE_TOKEN;
const target = process.argv[2] ?? "gis/schema.graphql";

if (!endpoint || !token) {
  throw new Error("GIS_GRAPHQL_URL and GIS_SERVICE_TOKEN must be set in .env.local");
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: token },
  body: JSON.stringify({ query: getIntrospectionQuery({ descriptions: true }) }),
});

if (!response.ok) {
  throw new Error(`GIS responded ${response.status}`);
}

const body = await response.json();
if (body.errors?.length) {
  const messages = body.errors.map((e) => e?.message ?? "unknown").join("; ");
  throw new Error(`GIS returned GraphQL errors: ${messages.split(token).join("[redacted]")}`);
}

const sdl = printSchema(buildClientSchema(body.data));
writeFileSync(target, sdl);

console.log(`Wrote ${target} (${sdl.split("\n").length} lines)`);
