-- O-08 closed: the MC's sheet carries the EXPA person id, so an imported
-- assignment always resolves. There is no pending or review state left to
-- model, and no manual or GIS-fallback source: the sheet is the only source.
-- A row that cannot be resolved is an import error, not a stored half-record.

DELETE FROM "EpAssignment" WHERE "epPersonId" IS NULL;

ALTER TABLE "EpAssignment" DROP COLUMN "epFullName";
ALTER TABLE "EpAssignment" DROP COLUMN "state";
ALTER TABLE "EpAssignment" DROP COLUMN "source";
ALTER TABLE "EpAssignment" ALTER COLUMN "epPersonId" SET NOT NULL;

DROP INDEX IF EXISTS "EpAssignment_state_idx";
DROP TYPE IF EXISTS "AssignmentState";
DROP TYPE IF EXISTS "AssignmentSource";

-- The sheet names a manager by first name. Those labels are a human convention,
-- so an admin maps each to a member once and the import refuses anything it has
-- not been told about rather than guessing which Ahmad was meant.
CREATE TABLE "ManagerAlias" (
  "label"    TEXT   NOT NULL,
  "memberId" BIGINT NOT NULL,
  CONSTRAINT "ManagerAlias_pkey" PRIMARY KEY ("label")
);

CREATE INDEX "ManagerAlias_memberId_idx" ON "ManagerAlias"("memberId");

ALTER TABLE "ManagerAlias"
  ADD CONSTRAINT "ManagerAlias_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
