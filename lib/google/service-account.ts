import "server-only";

import { createSign } from "node:crypto";

// Google service-account sign-in with no SDK: a JWT signed with the account's
// key is exchanged for a short-lived access token. Free, and the sheet stays
// Restricted, shared only with this account as Viewer.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_READONLY = "https://www.googleapis.com/auth/spreadsheets.readonly";

export type ServiceAccount = { email: string; privateKey: string };

export function serviceAccount(): ServiceAccount | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!email || !key) return null;
  // Env UIs often store the PEM on one line with literal "\n" separators.
  return { email, privateKey: key.replace(/\\n/g, "\n") };
}

let cached: { token: string; expiresAt: number; email: string } | null = null;

function b64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export async function sheetsAccessToken(
  account: ServiceAccount,
  fetcher: typeof fetch = fetch
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === account.email && cached.expiresAt - 60 > now) return cached.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: account.email, scope: SHEETS_READONLY, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.privateKey);
  const assertion = `${header}.${claims}.${b64url(signature)}`;

  const response = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google sign-in for the service account failed (${response.status})`);

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google returned no access token");
  cached = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600), email: account.email };
  return body.access_token;
}
