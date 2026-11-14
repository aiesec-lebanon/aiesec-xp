import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { TRANSPORT_IV_BYTES, TRANSPORT_KEY_BYTES, TRANSPORT_MAGIC } from "./transport";

// At rest, in assets/sealed/: iv (12) | tag (16) | AES-256-GCM ciphertext,
// under MODEL_KEY. Unlike the transport key, MODEL_KEY never leaves the server,
// so the files committed to the public repository are unusable without it.

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export function parseModelKey(raw: string | undefined): Buffer {
  const key = Buffer.from(raw?.trim().replace(/^["']|["']$/g, "") ?? "", "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`MODEL_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
  }
  return key;
}

export function sealAtRest(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function openAtRest(sealed: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.subarray(0, IV_BYTES));
  decipher.setAuthTag(sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

export function sealForTransport(plain: Buffer): Buffer {
  const key = randomBytes(TRANSPORT_KEY_BYTES);
  const iv = randomBytes(TRANSPORT_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([TRANSPORT_MAGIC, key, iv, body, cipher.getAuthTag()]);
}
