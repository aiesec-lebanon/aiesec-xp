-- Which application statuses reverse an APL (D-41). Held as configuration
-- rather than a constant: GIS may add status values, and the MC may decide a
-- given status should or should not cost the point.
ALTER TABLE "ScoreConfig" ADD COLUMN "aplReversingStatuses" JSONB;

UPDATE "ScoreConfig"
  SET "aplReversingStatuses" = '["withdrawn", "rejected"]'::jsonb
  WHERE "aplReversingStatuses" IS NULL;

ALTER TABLE "ScoreConfig" ALTER COLUMN "aplReversingStatuses" SET NOT NULL;
