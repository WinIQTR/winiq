-- Member notification preferences (UX audit item 26)
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "notifyEmailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "notifyTelegramEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "telegramHandle" TEXT;
