// The wire format of /api/models: "AXPM" | key (32) | iv (12) | AES-256-GCM
// ciphertext with its tag appended, which is the layout WebCrypto expects.
//
// The key travels with the body, so this is not secrecy from someone reading
// our (public) client code. It is the measure CGTrader's Royalty Free licence
// asks of an app: the model never sits at a URL as a file a viewer can save and
// open. See ATTRIBUTIONS.md and D-91.

export const TRANSPORT_MAGIC = new Uint8Array([0x41, 0x58, 0x50, 0x4d]);
export const TRANSPORT_KEY_BYTES = 32;
export const TRANSPORT_IV_BYTES = 12;

const HEADER_BYTES = TRANSPORT_MAGIC.length + TRANSPORT_KEY_BYTES + TRANSPORT_IV_BYTES;

export async function openTransport(body: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(body);
  if (bytes.length <= HEADER_BYTES || !TRANSPORT_MAGIC.every((b, i) => bytes[i] === b)) {
    throw new Error("Not a sealed model");
  }
  const keyStart = TRANSPORT_MAGIC.length;
  const ivStart = keyStart + TRANSPORT_KEY_BYTES;
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.slice(keyStart, ivStart),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(ivStart, HEADER_BYTES) },
    key,
    bytes.slice(HEADER_BYTES),
  );
}
