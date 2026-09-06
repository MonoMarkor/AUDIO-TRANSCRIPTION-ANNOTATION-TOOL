-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "distanceEstimateOverride" TEXT,
ADD COLUMN     "speechRateWpm" DOUBLE PRECISION,
ADD COLUMN     "speechRateWpmOverride" DOUBLE PRECISION;
