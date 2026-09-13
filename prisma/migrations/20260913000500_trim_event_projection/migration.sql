-- D-44. Keep the event projection to what scoring reads.
--
-- personHomeLcId, opportunityHomeLcId and gisManagerIds were written by sync
-- and read by nothing. The LC that matters for the leaderboard is the member's
-- (D-32), never the EP's; direction is decided by the query side (D-25); and
-- EXPA's own manager field is not the attribution source here, the assignment
-- register is.
ALTER TABLE "ExchangeEvent" DROP COLUMN "personHomeLcId";
ALTER TABLE "ExchangeEvent" DROP COLUMN "opportunityHomeLcId";
ALTER TABLE "ExchangeEvent" DROP COLUMN "gisManagerIds";

DROP INDEX IF EXISTS "ExchangeEvent_eventType_occurredAt_idx";
