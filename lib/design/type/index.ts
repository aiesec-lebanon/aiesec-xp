// A type system is a set of four faces bound to CSS custom properties. Each one
// lives in its own module and calls next/font at module scope, because next/font
// downloads and preloads every family declared in a module that reaches the
// bundle: keeping the unchosen directions in unimported files is what stops the
// build shipping eight typefaces to serve three.
//
// Faces are declared as --face-*; globals.css maps them onto the --font-* theme
// tokens, and lets --face-numeric fall back to --face-display where a direction
// does not need a separate numeral face.

export type TypeSystem = {
  /** Matches the directory name, and the value of <html data-type-system>. */
  readonly name: string;
  /** next/font variable classes for the four faces, space separated. */
  readonly className: string;
};
