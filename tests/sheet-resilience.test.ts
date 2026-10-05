import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Imported for its module graph only; nothing here touches the database.
vi.mock("@/lib/db", () => ({ db: {} }));

const { readSheetCsv, NOT_SHARED_MESSAGE } = await import("@/lib/import/run-import");

function respond(status: number, body: string) {
  return async () => ({ status, ok: status >= 200 && status < 300, text: async () => body });
}

describe("an unshared sheet", () => {
  it.each([401, 403])("is reported with instructions on %i", async (status) => {
    await expect(readSheetCsv("id", "MasterSheet", respond(status, ""))).rejects.toThrow(
      NOT_SHARED_MESSAGE
    );
  });

  it("tells the admin exactly what to change", () => {
    expect(NOT_SHARED_MESSAGE).toMatch(/General access to "Anyone with the link"/);
  });

  it("is caught even when Google answers 200 with a sign-in page", async () => {
    const html = '<!DOCTYPE html><html><head><title>Sign in</title></head></html>';
    await expect(readSheetCsv("id", "MasterSheet", respond(200, html))).rejects.toThrow(
      NOT_SHARED_MESSAGE
    );
  });

  it("reports other failures with their status rather than a generic error", async () => {
    await expect(readSheetCsv("id", "MasterSheet", respond(500, ""))).rejects.toThrow(/500/);
  });

  it("still reads a sheet that is shared", async () => {
    const csv = '"Responsible Member","EP ID"\n"Alex","1000001"';
    await expect(readSheetCsv("id", "MasterSheet", respond(200, csv))).resolves.toBe(csv);
  });

  it("does not mistake a leading blank line for HTML", async () => {
    const csv = '\n"Responsible Member","EP ID"\n"Alex","1"';
    await expect(readSheetCsv("id", "MasterSheet", respond(200, csv))).resolves.toContain("EP ID");
  });
});

describe("the import loop's contract", () => {
  it("throws an Error, so the caller can record its message as an issue", async () => {
    const error = await readSheetCsv("id", "MasterSheet", respond(401, "")).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.message).length).toBeGreaterThan(20);
  });

  it("rejects rather than resolving to empty, which would look like an empty sheet", async () => {
    await expect(readSheetCsv("id", "MasterSheet", respond(403, ""))).rejects.toBeInstanceOf(Error);
  });
});
