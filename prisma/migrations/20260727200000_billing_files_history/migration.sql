-- CreateEnum
CREATE TYPE "FileRole" AS ENUM ('INPUT', 'OUTPUT', 'INTERMEDIATE');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'STORED', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "HistoryAction" AS ENUM ('ACCOUNT_CREATED', 'CONVERSION_CREATED', 'CONVERSION_COMPLETED', 'CONVERSION_FAILED', 'FILE_DOWNLOADED', 'FILE_EXPIRED', 'FAVORITE_ADDED', 'PLAN_CHANGED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'PASSWORD_CHANGED', 'EMAIL_VERIFIED', 'SESSIONS_REVOKED');

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT,
    "mime" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "role" "FileRole" NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "scannedAt" TIMESTAMP(3),
    "scanResult" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "priceCents" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "provider" TEXT,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "providerPriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "providerInvoiceId" TEXT,
    "receiptUrl" TEXT,
    "failureReason" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "HistoryAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_storageKey_key" ON "File"("storageKey");

-- CreateIndex
CREATE INDEX "File_userId_createdAt_idx" ON "File"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "File_guestId_createdAt_idx" ON "File"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "File_expiresAt_status_idx" ON "File"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "File_jobId_role_position_idx" ON "File"("jobId", "role", "position");

-- CreateIndex
CREATE INDEX "File_checksum_idx" ON "File"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_providerCustomerId_idx" ON "Subscription"("providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_createdAt_idx" ON "Payment"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_providerInvoiceId_idx" ON "Payment"("providerInvoiceId");

-- CreateIndex
CREATE INDEX "HistoryEntry_userId_createdAt_idx" ON "HistoryEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HistoryEntry_userId_action_createdAt_idx" ON "HistoryEntry"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "HistoryEntry_createdAt_idx" ON "HistoryEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConversionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill
--
-- The DDL above is only half a migration. `File` is meant to be the canonical
-- record of every stored object, so it has to start out already describing the
-- objects that exist — an empty table would make the retention sweep believe
-- there is nothing to collect.
--
-- Backfilled rows get a UUID rather than a cuid: `cuid()` is generated by the
-- application and has no SQL equivalent. Both are opaque text, and nothing
-- parses these ids.
-- ---------------------------------------------------------------------------

-- Primary input of every conversion.
INSERT INTO "File" (
    "id", "userId", "guestId", "storageKey", "originalName", "mime", "format",
    "sizeBytes", "role", "status", "jobId", "position", "expiresAt",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    j."userId",
    j."guestId",
    j."inputKey",
    j."inputName",
    j."inputMime",
    j."sourceFormat",
    j."inputSize",
    'INPUT'::"FileRole",
    CASE WHEN j."status" = 'EXPIRED' THEN 'DELETED' ELSE 'STORED' END::"FileStatus",
    j."id",
    0,
    j."expiresAt",
    j."createdAt",
    j."updatedAt"
FROM "ConversionJob" j
ON CONFLICT ("storageKey") DO NOTHING;

-- Additional inputs for multi-file operations such as merge. `unnest` over both
-- arrays at once with ordinality is what pairs each key with its name and its
-- position; the primary input above already holds position 0.
INSERT INTO "File" (
    "id", "userId", "guestId", "storageKey", "originalName", "mime", "format",
    "sizeBytes", "role", "status", "jobId", "position", "expiresAt",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    j."userId",
    j."guestId",
    e."key",
    COALESCE(e."name", e."key"),
    j."inputMime",
    j."sourceFormat",
    0,
    'INPUT'::"FileRole",
    CASE WHEN j."status" = 'EXPIRED' THEN 'DELETED' ELSE 'STORED' END::"FileStatus",
    j."id",
    e."ord",
    j."expiresAt",
    j."createdAt",
    j."updatedAt"
FROM "ConversionJob" j
CROSS JOIN LATERAL unnest(j."extraInputKeys", j."extraInputNames")
    WITH ORDINALITY AS e("key", "name", "ord")
WHERE e."key" IS NOT NULL
ON CONFLICT ("storageKey") DO NOTHING;

-- Output of every job that produced one.
INSERT INTO "File" (
    "id", "userId", "guestId", "storageKey", "originalName", "mime", "format",
    "sizeBytes", "role", "status", "jobId", "position", "expiresAt",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    j."userId",
    j."guestId",
    j."outputKey",
    COALESCE(j."outputName", j."inputName"),
    COALESCE(j."outputMime", 'application/octet-stream'),
    j."targetFormat",
    COALESCE(j."outputSize", 0),
    'OUTPUT'::"FileRole",
    CASE WHEN j."status" = 'EXPIRED' THEN 'DELETED' ELSE 'STORED' END::"FileStatus",
    j."id",
    0,
    j."expiresAt",
    COALESCE(j."finishedAt", j."createdAt"),
    j."updatedAt"
FROM "ConversionJob" j
WHERE j."outputKey" IS NOT NULL
ON CONFLICT ("storageKey") DO NOTHING;

-- Users already on a paid tier predate billing, so they hold an entitlement
-- with no record explaining it. Give each one a subscription with a null
-- provider, which is exactly what it is: a plan granted outside the processor.
-- Without this, `User.plan` and `Subscription.tier` disagree from day one.
INSERT INTO "Subscription" (
    "id", "userId", "tier", "status", "interval", "currency",
    "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    u."id",
    u."plan",
    'ACTIVE'::"SubscriptionStatus",
    'MONTHLY'::"BillingInterval",
    'USD',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE u."plan" <> 'FREE'
ON CONFLICT ("userId") DO NOTHING;
