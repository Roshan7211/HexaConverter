-- The service becomes free and accountless.
--
-- Everything describing a person goes: accounts, sessions, link secrets, API
-- keys, billing, and the per-user dashboard tables. What survives is the
-- conversion pipeline, which is transient by construction and swept by the
-- retention pass.
--
-- Rows that belonged to an account are deleted rather than reassigned. There is
-- no anonymous owner to hand them to, and their files are long past retention.

-- 1. Drop conversion rows owned by an account, then make ownership guest-only.
DELETE FROM "ConversionJob" WHERE "guestId" IS NULL;
DELETE FROM "UploadSession" WHERE "guestId" IS NULL;

ALTER TABLE "ConversionJob" DROP CONSTRAINT IF EXISTS "ConversionJob_userId_fkey";
ALTER TABLE "UploadSession" DROP CONSTRAINT IF EXISTS "UploadSession_userId_fkey";

DROP INDEX IF EXISTS "ConversionJob_userId_createdAt_idx";
DROP INDEX IF EXISTS "UploadSession_userId_idx";

ALTER TABLE "ConversionJob" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "UploadSession" DROP COLUMN IF EXISTS "userId";

ALTER TABLE "ConversionJob" ALTER COLUMN "guestId" SET NOT NULL;
ALTER TABLE "UploadSession" ALTER COLUMN "guestId" SET NOT NULL;

-- 2. Drop the account, billing and dashboard tables.
--    `File` goes with them: it was written by nothing and read by nothing.
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "HistoryEntry" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "FavoriteRoute" CASCADE;
DROP TABLE IF EXISTS "ApiKey" CASCADE;
DROP TABLE IF EXISTS "AuthToken" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "File" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- 3. Drop the enums those tables owned.
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "BillingInterval";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "HistoryAction";
DROP TYPE IF EXISTS "NotificationType";
DROP TYPE IF EXISTS "AuthTokenType";
DROP TYPE IF EXISTS "FileStatus";
DROP TYPE IF EXISTS "FileRole";
DROP TYPE IF EXISTS "PlanTier";
DROP TYPE IF EXISTS "UserRole";
