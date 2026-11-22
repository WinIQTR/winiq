-- Single fixed membership: new members default to PROFESSIONAL (canonical plan).
ALTER TABLE "AppUser" ALTER COLUMN "plan" SET DEFAULT 'PROFESSIONAL';
