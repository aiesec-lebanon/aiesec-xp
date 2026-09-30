-- D-80. Sheet credit comes from the MC's one sign-up sheet instead of each
-- entity's own: MasterSheet names each EP's manager, Sheet7 lists the managers'
-- EXPA ids, and an admin can match a name on the console.

-- ── The MC sheet replaces the per-entity sheets ─────────────────────────────
-- Sheet credit already written stays: the next import rewrites it for every EP
-- the MC sheet resolves, and leaves the rest as they are.
DELETE FROM "AssignmentSheet";

ALTER TABLE "AssignmentSheet" ALTER COLUMN "managersTabName" SET DEFAULT 'Sheet7';

INSERT INTO "AssignmentSheet" ("id", "label", "spreadsheetId", "tabName", "managersTabName") VALUES
  ('mc_signups', 'MC sign-up sheet', '1lbU29GIwMxkQuAu9od2lNB4L3KObrm8DYDw3RueMSrY', 'MasterSheet', 'Sheet7');

-- ── Names matched on the console ────────────────────────────────────────────
CREATE TABLE "SheetManagerMapping" (
  "id"        TEXT NOT NULL,
  "nameKey"   TEXT NOT NULL,
  "lcKey"     TEXT NOT NULL DEFAULT '',
  "teamKey"   TEXT NOT NULL DEFAULT '',
  "name"      TEXT NOT NULL,
  "lc"        TEXT NOT NULL DEFAULT '',
  "team"      TEXT NOT NULL DEFAULT '',
  "memberId"  BIGINT NOT NULL,
  "createdBy" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SheetManagerMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SheetManagerMapping_nameKey_lcKey_teamKey_key"
  ON "SheetManagerMapping"("nameKey", "lcKey", "teamKey");

CREATE INDEX "SheetManagerMapping_memberId_idx" ON "SheetManagerMapping"("memberId");

ALTER TABLE "SheetManagerMapping"
  ADD CONSTRAINT "SheetManagerMapping_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
