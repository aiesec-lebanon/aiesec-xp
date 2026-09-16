import { arena } from "./type/arena";
import type { TypeSystem } from "./type/index";

// The active direction. Switching to ./type/clay-arcade or ./type/overworld is a
// one-line change here: the unchosen modules are never imported, so their
// typefaces are never downloaded or preloaded. Arena is the default because D-24
// asks for a dark competitive surface and heavy numerals.
export const typeSystem: TypeSystem = arena;
