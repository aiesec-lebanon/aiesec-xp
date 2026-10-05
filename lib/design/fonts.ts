import localFont from "next/font/local";

// next/font preloads every family declared in any bundled module, so keep all
// declarations here. Local files because next/font/google's build breaks on some responses.

const display = localFont({ src: "./faces/fredoka.woff2", weight: "300 700", variable: "--face-display" });

const ui = localFont({ src: "./faces/figtree.woff2", weight: "300 900", variable: "--face-ui" });

// Fredoka's figures are too soft to read as a score at a glance.
const numeric = localFont({ src: "./faces/baloo2.woff2", weight: "400 800", variable: "--face-numeric" });

const mono = localFont({
  src: [
    { path: "./faces/space-mono-regular.woff2", weight: "400" },
    { path: "./faces/space-mono-bold.woff2", weight: "700" },
  ],
  variable: "--face-mono",
});

export const typeSystem = {
  name: "studio",
  className: `${display.variable} ${ui.variable} ${numeric.variable} ${mono.variable}`,
} as const;
