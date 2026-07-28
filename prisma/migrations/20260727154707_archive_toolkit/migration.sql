-- CreateEnum
CREATE TYPE "ArchiveOperation" AS ENUM ('EXTRACT', 'ARCHIVE', 'PROTECT');

-- AlterTable
ALTER TABLE "ConversionJob" ADD COLUMN     "archiveOperation" "ArchiveOperation";
