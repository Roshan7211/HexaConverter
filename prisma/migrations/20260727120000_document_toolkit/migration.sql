-- Document toolkit: operations that are not a plain format-to-format
-- conversion, plus support for jobs that take several input files.

-- CreateEnum
CREATE TYPE "DocumentOperation" AS ENUM (
    'MERGE',
    'SPLIT',
    'EXTRACT_PAGES',
    'ROTATE',
    'COMPRESS'
);

-- AlterTable
ALTER TABLE "ConversionJob"
    ADD COLUMN "operation" "DocumentOperation",
    ADD COLUMN "extraInputKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "extraInputNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
