-- D-42. Remove EP personal data from the database.
--
-- EP names were being stored for every application event, and events were being
-- stored for periods that are not scored at all: of 269 rows, 206 fell outside
-- the active display window and existed for no purpose. EP details may still be
-- shown in the audit trail (D-18), but they are read from GIS at display time
-- and never held here.
--
-- This migration both changes the structure and erases the data already
-- collected. It is deliberately destructive.

-- Events outside the scoring window are not evidence of anything; they are
-- simply data that should never have been collected (D-43).
DELETE FROM "ExchangeEvent"
WHERE "occurredAt" < (
  SELECT "startsAt" FROM "DisplayWindow" WHERE "isActive" = true LIMIT 1
);

ALTER TABLE "ExchangeEvent" DROP COLUMN "epFullName";
ALTER TABLE "ExchangeEvent" DROP COLUMN "opportunityTitle";

-- Kept only while an imported row is unresolved, so it may now be null and is
-- cleared as soon as an assignment links to a GIS person.
ALTER TABLE "EpAssignment" ALTER COLUMN "epFullName" DROP NOT NULL;
UPDATE "EpAssignment" SET "epFullName" = NULL WHERE "epPersonId" IS NOT NULL;
