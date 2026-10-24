import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendor assets copied out of node_modules by scripts/assets: minified
    // decoder builds, not our source.
    "public/draco/**",
    // Written by `npm run gis:codegen`, not by hand.
    "gis/generated.ts",
    // Git-ignored local folders: agent worktrees carry their own .next builds,
    // and ref/ holds design references.
    ".claude/**",
    "ref/**",
  ]),
]);

export default eslintConfig;
