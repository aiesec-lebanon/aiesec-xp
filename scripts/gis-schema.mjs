import { writeFileSync } from "node:fs";
import { buildClientSchema, getIntrospectionQuery, printSchema } from "graphql";

// Captures the GIS schema as SDL so codegen is reproducible in CI without the
// service token. The GIS schema is a public third-party contract; committing it
// pins what we generated against and turns schema drift into a reviewable diff.
//
// Run this deliberately, not on every build: regenerating should be a commit.

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
