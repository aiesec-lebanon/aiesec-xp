import { Bricolage_Grotesque, Space_Grotesk, Space_Mono } from "next/font/google";

import type { TypeSystem } from "./index";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--face-display" });

const ui = Space_Grotesk({ subsets: ["latin"], variable: "--face-ui" });

const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--face-mono" });

export const overworld: TypeSystem = {
  name: "overworld",
  className: `${display.variable} ${ui.variable} ${mono.variable}`,
};
