import { generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { readSheetColumns, NOT_CONNECTED_MESSAGE, SheetAccessError } = await import(
  "@/lib/import/sheets-api"
);

// An unreadable sign-up sheet has to be a reported issue an admin can act on,
// never something that takes the admin page or the sync down. And only the
// four columns XP uses may ever be requested from Google.

const ACCOUNT = "xp-reader@example-project.iam.gserviceaccount.com";
const WANTED = ["EP ID", "EP Manager", "LC Assigned To", "Function Assigned to"] as const;
const HEADER = ["Timestamp", "EP Name", "EP ID", "Email", "EP Manager", "Phone", "LC Assigned To", "Function Assigned to"];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function google(values: (url: string) => Response) {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return json(200, { access_token: "test-access", expires_in: 3600 });
    }
    return values(url);
  }) as typeof fetch;
  return { fetcher, calls };
}

beforeEach(() => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = ACCOUNT;
  process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
});

afterEach(() => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
});

describe("reading the sign-up sheet", () => {
  it("says XP isn't connected yet when no service account is set", async () => {
    delete process.env.GOOGLE_PRIVATE_KEY;
    await expect(readSheetColumns("sheet", "MasterSheet", WANTED)).rejects.toThrow(NOT_CONNECTED_MESSAGE);
  });

  it("asks for the sheet to be shared with the service account, and never for a public link", async () => {
    const { fetcher } = google(() => json(403, {}));
    const error = await readSheetColumns("sheet", "MasterSheet", WANTED, fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SheetAccessError);
    expect((error as Error).message).toContain(ACCOUNT);
    expect((error as Error).message).toMatch(/Restricted/);
    expect((error as Error).message).not.toMatch(/Anyone with the link/);
  });

  it("names a tab that does not exist", async () => {
    const { fetcher } = google(() => json(400, {}));
    await expect(readSheetColumns("sheet", "Gone", WANTED, fetcher)).rejects.toThrow(/no tab called "Gone"/);
  });

  it("reports a server error with its code", async () => {
    const { fetcher } = google(() => json(500, {}));
    await expect(readSheetColumns("sheet", "MasterSheet", WANTED, fetcher)).rejects.toThrow(/500/);
  });

  it("requests only the four columns it uses, located by header", async () => {
    const { fetcher, calls } = google((url) =>
      url.includes(":batchGet")
        ? json(200, {
            valueRanges: [
              { values: [["EP ID", "900101", "900102"]] },
              { values: [["EP Manager", "Test Manager"]] },
              { values: [["LC Assigned To", "LC Test"]] },
              { values: [["Function Assigned to", "oGV"]] },
            ],
          })
        : json(200, { values: [HEADER] })
    );

    const csv = await readSheetColumns("sheet", "MasterSheet", WANTED, fetcher);

    expect(csv.split("\n")[0]).toBe("EP ID,EP Manager,LC Assigned To,Function Assigned to");
    expect(csv).toContain("900102,,,");
    expect(csv).not.toMatch(/EP Name|Email|Phone|Timestamp/);

    const batch = decodeURIComponent(calls.find((url) => url.includes(":batchGet")) ?? "");
    expect(batch).toContain("'MasterSheet'!C:C");
    expect(batch).toContain("'MasterSheet'!E:E");
    expect(batch).toContain("'MasterSheet'!G:G");
    expect(batch).toContain("'MasterSheet'!H:H");
    expect(batch).not.toMatch(/!(A|B|D|F):/);
  });

  it("turns a network failure into a message an admin can act on", async () => {
    const fetcher = (async () => {
      throw new Error("socket hang up");
    }) as typeof fetch;
    await expect(readSheetColumns("sheet", "MasterSheet", WANTED, fetcher)).rejects.toThrow(/didn't respond/);
  });
});
