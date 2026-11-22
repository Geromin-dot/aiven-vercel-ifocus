ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "genderIdentity" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "deviceType" TEXT;
CREATE TABLE IF NOT EXISTS "AiDailyUsage" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "feature" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("userId", "feature", "day")
);
