import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The 3D, chart and icon layers each ship with an upstream default that fetches
// from a CDN -- drei's Environment presets, three's Draco decoder, troika's font
// resolver. Each is overridden, and each override is one line that would be easy
// to lose in a refactor without anything failing until a member with a strict
// network or a working CSP opens the page. These tests read the sources as text,
// in the same spirit as tests/no-personal-data.test.ts.

const root = resolve(__dirname, "..");

const VISUAL_DIRS = [
  "components/three",
  "components/charts",
  "components/icons",
  "components/motion",
  "lib/three",
  "lib/design",
];

function sourcesIn(dir: string): { path: string; text: string }[] {
  const absolute = join(root, dir);
  return readdirSync(absolute, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return { path: path.slice(root.length + 1), text: readFileSync(path, "utf8") };
    });
}

/** Comments carry URLs on purpose -- they say which CDN is being avoided. */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((raw) => {
      const line = raw.trim();
      return !line.startsWith("//") && !line.startsWith("*");
    })
    .join("\n");
}

const sources = VISUAL_DIRS.flatMap(sourcesIn);

describe("no visual-layer module reaches a third-party origin", () => {
  it("finds sources to check at all", () => {
    expect(sources.length).toBeGreaterThan(8);
  });

  it.each(sources.map((source) => source.path))("%s", (path) => {
    const source = sources.find((candidate) => candidate.path === path)!;
    expect(withoutComments(source.text)).not.toMatch(/https?:\/\//);
  });
});

describe("the upstream CDN defaults are actually overridden", () => {
  it("points three's Draco decoder at our own copy", () => {
    const loaders = readFileSync(join(root, "lib/three/loaders.ts"), "utf8");
    expect(loaders).toContain("useGLTF.setDecoderPath(DRACO_DECODER_PATH)");
  });

  it("gives drei's Environment a file instead of a preset", () => {
    const environment = readFileSync(join(root, "components/three/environment.tsx"), "utf8");
    expect(environment).toContain("files={hdriPath(environment)}");
    expect(environment).not.toMatch(/preset=/);
  });

  it("gives both drei text components a self-hosted font", () => {
    const text = readFileSync(join(root, "components/three/text.tsx"), "utf8");
    expect(text).toContain("font={SCENE_FONT.sdf}");
    expect(text).toContain("font={SCENE_FONT.typeface}");
  });
});

describe("the vendor sync and the paths the app loads agree", () => {
  const script = readFileSync(join(root, "scripts/assets/sync-vendor-assets.mjs"), "utf8");
  const assets = readFileSync(join(root, "lib/three/assets.ts"), "utf8");

  function list(text: string, name: string): string[] {
    const open = text.indexOf("[", text.indexOf(`${name} = [`));
    const close = text.indexOf("]", open);
    if (open < 0 || close < 0) throw new Error(`${name} not found`);
    return [...text.slice(open, close).matchAll(/"([^"]+)"/g)].map((entry) => entry[1]!);
  }

  it("extracts exactly the HDRIs the app can ask for", () => {
    expect(list(script, "HDRI_ENVIRONMENTS")).toEqual(list(assets, "HDRI_ENVIRONMENTS"));
  });

  it("extracts the fonts the scene text components reference", () => {
    const fonts = list(script, "SCENE_FONTS");
    for (const font of fonts) expect(assets).toContain(`/fonts/${font}`);
  });

  // Every directory the asset scripts write into has to be excluded from the
  // proxy matcher, or the session check turns an asset request into a redirect
  // to the sign-in page the moment a cookie expires mid-scene. Deriving the list
  // from the scripts means adding a fifth directory fails here rather than
  // silently 307-ing a decoder.
  it("excludes every generated asset directory from the proxy matcher", () => {
    const optimise = readFileSync(join(root, "scripts/assets/optimize-gltf.mts"), "utf8");
    const proxy = readFileSync(join(root, "proxy.ts"), "utf8");

    const written = new Set([
      ...[...script.matchAll(/"public", "([a-z]+)"/g)].map((match) => match[1]!),
      ...[...optimise.matchAll(/OUTPUT_DIR = "public\/([a-z]+)"/g)].map((match) => match[1]!),
    ]);

    expect(written.size).toBeGreaterThanOrEqual(4);
    for (const directory of written) expect(proxy).toContain(`${directory}/|`);
  });
});

describe("three never enters a server bundle", () => {
  const importsThree = sources.filter((source) =>
    /from "(three|@react-three\/|motion\/react|recharts)/.test(source.text),
  );

  it("finds the modules that import it", () => {
    expect(importsThree.length).toBeGreaterThan(4);
  });

  it.each(importsThree.map((source) => source.path))("%s is a client module", (path) => {
    const source = sources.find((candidate) => candidate.path === path)!;
    expect(source.text.split("\n")[0]!.trim()).toBe('"use client";');
  });
});

// D-46: motion is on for everyone and the member's own switch turns it down.
// Two things have to stay true for that to be honest -- the switch must reach
// every animated surface, and the operating system's setting must not quietly
// reintroduce itself as a second, invisible trigger.
describe("the member's switch reaches every animated surface", () => {
  it.each([
    ["components/three/canvas.tsx", "the canvas frame loop"],
    ["components/three/physics.tsx", "the physics simulation"],
    ["components/three/skeleton.tsx", "the loading shimmer"],
    ["components/charts/funnel-trend-chart.tsx", "chart animation"],
  ])("%s honours it for %s", (path) => {
    expect(readFileSync(join(root, path), "utf8")).toContain("useReduceMotion");
  });

  it("passes it to Motion, which is off unless the member asked for it", () => {
    const provider = readFileSync(join(root, "components/motion/motion-provider.tsx"), "utf8");
    expect(provider).toContain('reducedMotion={reduceMotion ? "always" : "never"}');
    expect(provider).not.toContain('reducedMotion="user"');
  });

  it("renders server-side, so the member never sees a frame they opted out of", () => {
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
    expect(layout).toContain("readReduceMotion");
    expect(layout).toContain("data-reduce-motion");
  });

  it("offers the control WCAG 2.2.2 asks for, on every page", () => {
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
    expect(layout).toContain("<ReduceMotionToggle />");
  });

  it("has a CSS backstop for anything animated outside React", () => {
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).toContain('[data-reduce-motion="true"] *');
  });
});

describe("the operating system's motion setting is not a second trigger", () => {
  // Comments name it on purpose -- they record that not consulting it was a
  // decision rather than an oversight.
  const css = readFileSync(join(root, "app/globals.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  it("is not consulted in CSS", () => {
    expect(css).not.toContain("prefers-reduced-motion");
  });

  it.each(sources.map((source) => source.path))("nor in %s", (path) => {
    const source = sources.find((candidate) => candidate.path === path)!;
    expect(withoutComments(source.text)).not.toContain("prefers-reduced-motion");
  });
});

describe("the design tokens have one source", () => {
  const tokens = readFileSync(join(root, "lib/design/tokens.ts"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");

  it.each([
    ["base", "surface-base"],
    ["raised", "surface-raised"],
    ["sunken", "surface-sunken"],
    ["line", "surface-line"],
  ])("surface %s matches --%s in globals.css", (key, variable) => {
    const value = new RegExp(`${key}: "(#[0-9a-fA-F]{6})"`).exec(tokens)?.[1]!.toLowerCase();
    expect(css).toContain(`--${variable}: ${value};`);
  });

  it.each(["APL", "APD", "RE", "BREAK"])("stage %s matches its CSS custom property", (stage) => {
    const value = new RegExp(`${stage}: "(#[0-9a-fA-F]{6})"`).exec(tokens)?.[1]!.toLowerCase();
    expect(css).toContain(`--stage-${stage.toLowerCase()}: ${value};`);
  });
});
