import localFont from "next/font/local";

// O-11, closed: STUDIO. Four faces, each with one job, bound to CSS custom
// properties that globals.css maps onto the --font-* theme tokens.
//
// This is the only module that calls next/font, because next/font preloads every
// family declared in a module that reaches the bundle -- the earlier arrangement
// kept three unchosen directions in unimported files for exactly that reason, and
// there is now one direction to keep.
//
// The files are built by scripts/assets/build-faces.py rather than fetched by
// next/font/google, whose build breaks on some of Google's responses (D-67).

const display = localFont({ src: "./faces/fredoka.woff2", weight: "300 700", variable: "--face-display" });

const ui = localFont({ src: "./faces/figtree.woff2", weight: "300 900", variable: "--face-ui" });

// Fredoka's figures are too soft to read as a score at a glance, and a score is
// the thing this product exists to show, so the numerals pay for a face of their
// own.
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
