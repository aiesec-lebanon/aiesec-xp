export const NONCE_HEADER = "x-nonce";

export function contentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // 'wasm-unsafe-eval': the Draco decoder instantiates inlined WASM.
    // 'unsafe-eval' (dev only): React rebuilds server error stacks with eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    // React serialises style props into style attributes during SSR.
    "style-src 'self' 'unsafe-inline'",
    // GLTFLoader turns embedded textures into blob URLs; three's placeholders are data URIs.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // ws: is the dev server's hot-reload socket.
    `connect-src 'self' blob:${isDevelopment ? " ws: wss:" : ""}`,
    // DRACOLoader builds its worker from a blob URL.
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
