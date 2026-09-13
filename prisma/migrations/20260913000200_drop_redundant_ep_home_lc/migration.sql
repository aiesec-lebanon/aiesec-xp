-- epHomeLcId duplicated personHomeLcId: the EP is the person on the
-- application, so the two always held the same value.

-- AlterTable
ALTER TABLE "ExchangeEvent" DROP COLUMN "epHomeLcId";
