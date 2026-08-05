-- Optional reminder written by the user, replayed inside the notification when
-- the alert fires. Nullable, so existing rows need no backfill.
ALTER TABLE "Alert" ADD COLUMN "note" TEXT;
