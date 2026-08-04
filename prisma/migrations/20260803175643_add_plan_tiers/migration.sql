-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('ANONYMOUS', 'FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "premiumUntil" TIMESTAMP(3);
