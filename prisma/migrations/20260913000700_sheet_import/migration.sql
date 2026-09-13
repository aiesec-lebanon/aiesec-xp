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

INSERT INTO "AssignmentSheet" ("id", "label", "spreadsheetId", "tabName") VALUES
  ('sheet_a', 'Sign-up form responses A', '10KhRKl1Px5iwrLgR1ltloDPF_8ctFjJds0cKxO3pu-U', 'ViewOnly'),
  ('sheet_b', 'Sign-up form responses B', '1CvIxifGkwxirA8nbE_VnfmDiVVy5jCF9aKvqZPoHOHk', 'ViewOnly')
ON CONFLICT ("spreadsheetId") DO NOTHING;
