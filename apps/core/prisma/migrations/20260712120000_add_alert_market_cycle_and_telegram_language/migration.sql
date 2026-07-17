ALTER TABLE "User" ADD COLUMN "telegramLanguage" TEXT NOT NULL DEFAULT 'fa';

ALTER TABLE "Alert"
ADD COLUMN "market" TEXT NOT NULL DEFAULT 'spot',
ADD COLUMN "cycleFireCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Alert" SET "cycleFireCount" = "fireCount";
