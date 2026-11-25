import "server-only";

import { serviceAccount, sheetsAccessToken } from "@/lib/google/service-account";
import { logger } from "@/lib/logger";

import { normaliseLabel } from "./sheet-parser";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const TIMEOUT_MS = 30_000;

export const NOT_CONNECTED_MESSAGE =
  "AIESEC XP isn't connected to Google Sheets yet. Ask the platform team to finish the set-up.";

export function notSharedMessage(email: string): string {
  return `AIESEC XP can't open the sign-up sheet. In Google Sheets, share it with ${email} as Viewer, and keep General access on Restricted.`;
}

export class SheetAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetAccessError";
  }
}

function quoteTab(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

function columnLetter(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
    .join("\n");
}

/**
 * Reads only the named columns of one tab, located by their header, and
 * returns them as CSV for the existing parsers. Every other column (names,
 * dates of birth, contact details, notes) never leaves Google. A header that
 * is missing is simply not returned, so the parser reports the tab's shape.
 */
export async function readSheetColumns(
  spreadsheetId: string,
  tabName: string,
  headers: readonly string[],
  fetcher: typeof fetch = fetch
): Promise<string> {
  const account = serviceAccount();
  if (!account) throw new SheetAccessError(NOT_CONNECTED_MESSAGE);

  async function get(path: string): Promise<unknown> {
    let response: Response;
    try {
      const token = await sheetsAccessToken(account!, fetcher);
      response = await fetcher(`${API}/${encodeURIComponent(spreadsheetId)}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      logger.warn("Sign-up sheet unreachable", { error });
      throw new SheetAccessError("Google Sheets didn't respond. Try again in a few minutes.");
    }
    if (response.status === 403 || response.status === 404) {
      throw new SheetAccessError(notSharedMessage(account!.email));
    }
    if (response.status === 400) {
      throw new SheetAccessError(`The sign-up sheet has no tab called "${tabName}".`);
    }
    if (!response.ok) {
      logger.warn("Sign-up sheet read failed", { status: response.status });
      throw new SheetAccessError(
        `Google Sheets couldn't open the sign-up sheet (error ${response.status}). Try again in a few minutes.`
      );
    }
    return response.json();
  }

  const tab = quoteTab(tabName);
  const head = (await get(`/values/${encodeURIComponent(`${tab}!1:1`)}`)) as { values?: string[][] };
  const headerRow = head.values?.[0] ?? [];
  if (headerRow.length === 0) return "";

  const wanted = new Set(headers.map(normaliseLabel));
  const columns = headerRow.flatMap((cell, index) => (wanted.has(normaliseLabel(cell)) ? [index] : []));
  if (columns.length === 0) return toCsv([headerRow.filter((cell) => wanted.has(normaliseLabel(cell)))]);

  const ranges = columns
    .map((index) => `ranges=${encodeURIComponent(`${tab}!${columnLetter(index)}:${columnLetter(index)}`)}`)
    .join("&");
  const batch = (await get(`/values:batchGet?majorDimension=COLUMNS&${ranges}`)) as {
    valueRanges?: Array<{ values?: string[][] }>;
  };
  const values = (batch.valueRanges ?? []).map((range) => range.values?.[0] ?? []);
  const height = Math.max(0, ...values.map((column) => column.length));

  const rows: string[][] = [];
  for (let row = 0; row < height; row += 1) rows.push(values.map((column) => String(column[row] ?? "")));
  return toCsv(rows);
}
