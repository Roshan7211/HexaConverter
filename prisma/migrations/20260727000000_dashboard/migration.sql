-- Dashboard: pinned conversion routes and in-app notifications.

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
    'CONVERSION_COMPLETED',
    'CONVERSION_FAILED',
    'FILE_EXPIRING',
    'QUOTA_WARNING',
    'SYSTEM'
);

-- CreateTable
CREATE TABLE "FavoriteRoute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "targetFormat" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteRoute_userId_lastUsedAt_idx" ON "FavoriteRoute"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteRoute_userId_sourceFormat_targetFormat_key" ON "FavoriteRoute"("userId", "sourceFormat", "targetFormat");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "FavoriteRoute" ADD CONSTRAINT "FavoriteRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
