-- Additive and repeatable: this project does not currently use Prisma migration history.
-- Apply with npm run push:setup-db. Existing user data is untouched.
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "deviceId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "lastTestAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("userId", "deviceId")
);
CREATE TABLE IF NOT EXISTS "PresencePushJob" (
  "subscriptionId" TEXT PRIMARY KEY REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "generation" TEXT NOT NULL,
  "version" DOUBLE PRECISION NOT NULL,
  "timerSessionId" TEXT,
  "authSessionId" TEXT,
  "checkId" TEXT,
  "remainingSeconds" INTEGER NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'CANCELLED',
  "scheduledAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
