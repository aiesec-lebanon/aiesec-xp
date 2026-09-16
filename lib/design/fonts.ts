import { Baloo_2, Figtree, Fredoka, Space_Mono } from "next/font/google";

// O-11, closed: STUDIO. Four faces, each with one job, bound to CSS custom
// properties that globals.css maps onto the --font-* theme tokens.
//
// This is the only module that calls next/font, because next/font downloads and
// preloads every family declared in a module that reaches the bundle -- the
// earlier arrangement kept three unchosen directions in unimported files for
// exactly that reason, and there is now one direction to keep.

const display = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--face-display" });

const ui = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--face-ui",
});

// Fredoka's figures are too soft to read as a score at a glance, and a score is
// the thing this product exists to show, so the numerals pay for a face of their
// own.
const numeric = Baloo_2({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--face-numeric" });

const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--face-mono" });

export const typeSystem = {
  name: "studio",
  className: `${display.variable} ${ui.variable} ${numeric.variable} ${mono.variable}`,
} as const;
