// Architecture.md 11: a nonce CSP, no inline scripts. Kept out of proxy.ts so
// tests/csp.test.ts can assert the directives the 3D stack depends on -- each of
// which is load-bearing for a specific runtime behaviour, and none of which is
// obvious from reading a directive list:
//
//   'wasm-unsafe-eval'   Rapier inlines a 1.5MB WebAssembly module as base64 and
//                        instantiates it; the Draco decoder does the same inside
//                        its worker. Without this, physics and every compressed
//                        model fail at runtime, not at build.
//   worker-src blob:     three's DRACOLoader assembles its worker source as a
//                        string and loads it through URL.createObjectURL.
//   img-src blob: data:  GLTFLoader materialises embedded textures as blob URLs,
//                        and three's placeholder textures are data URIs.
//
// style-src carries 'unsafe-inline' deliberately. React serialises every
// `style={{...}}` prop into a style attribute during SSR, and Recharts sizes its
// container that way, so nonce-only styles would break the charts while adding
// nothing against the threat that matters here -- script injection, which
// script-src holds strictly.

export const NONCE_HEADER = "x-nonce";

export function contentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // React reconstructs server error stacks with eval in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // ws: is the dev server's hot-reload socket.
    `connect-src 'self' blob:${isDevelopment ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "media-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
