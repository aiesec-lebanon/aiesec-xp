-- Assignment is imported from the MC's sheets, with an admin able to correct a
-- row afterwards. The source marks which is which, so a re-import replaces what
-- the sheet owns and leaves a deliberate correction alone.
CREATE TYPE "AssignmentSource" AS ENUM ('SHEET', 'ADMIN');

ALTER TABLE "EpAssignment"
  ADD COLUMN "source" "AssignmentSource" NOT NULL DEFAULT 'SHEET';

-- One assignment per EP per effective date, so a re-import updates in place
-- rather than stacking duplicates.
ALTER TABLE "EpAssignment"
  ADD CONSTRAINT "EpAssignment_epPersonId_effectiveFrom_key"
  UNIQUE ("epPersonId", "effectiveFrom");

CREATE TABLE "AssignmentSheet" (
  "id"            TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "spreadsheetId" TEXT NOT NULL,
  "tabName"       TEXT NOT NULL,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "lastImportAt"  TIMESTAMP(3),
  CONSTRAINT "AssignmentSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentSheet_spreadsheetId_key"
  ON "AssignmentSheet"("spreadsheetId");

-- The sheet itself is chosen by an admin in XP's settings, never committed here.
