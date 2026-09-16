import { Baloo_2, Fredoka, Poppins, Space_Mono } from "next/font/google";

import type { TypeSystem } from "./index";

const display = Fredoka({ subsets: ["latin"], variable: "--face-display" });

const ui = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--face-ui",
});

// Fredoka's figures are too soft to read as a score at a glance, so this is the
// one direction that pays for a fourth family.
const numeric = Baloo_2({ subsets: ["latin"], variable: "--face-numeric" });

const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--face-mono" });

export const clayArcade: TypeSystem = {
  name: "clay-arcade",
  className: `${display.variable} ${ui.variable} ${numeric.variable} ${mono.variable}`,
};
