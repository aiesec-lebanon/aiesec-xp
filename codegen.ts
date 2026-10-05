import type { CodegenConfig } from "@graphql-codegen/cli";

// Uses the committed SDL so CI needs no token; refresh with `npm run gis:schema`.
const config: CodegenConfig = {
  schema: "gis/schema.graphql",
  documents: "gis/operations.graphql",
  generates: {
    "gis/generated.ts": {
      plugins: ["typescript-operations", "typescript-graphql-request"],
      config: {
        scalars: {
          DateTime: "string",
          Date: "string",
          ISO8601DateTime: "string",
          JSON: "unknown",
        },
        avoidOptionals: false,
        skipTypename: true,
      },
    },
  },
};

export default config;
