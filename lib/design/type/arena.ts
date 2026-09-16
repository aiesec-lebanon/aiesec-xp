import { Orbitron, Rajdhani, Space_Mono } from "next/font/google";

import type { TypeSystem } from "./index";

const display = Orbitron({ subsets: ["latin"], variable: "--face-display" });

const ui = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--face-ui",
});

const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--face-mono" });

// Orbitron doubles as the numeral face: D-24 asks for heavy numerals and its
// figures already carry the scoreboard weight, so this direction downloads three
// families rather than four.
export const arena: TypeSystem = {
  name: "arena",
  className: `${display.variable} ${ui.variable} ${mono.variable}`,
};
