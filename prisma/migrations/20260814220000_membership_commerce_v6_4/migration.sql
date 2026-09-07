CREATE TYPE "UpgradeRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED');

CREATE TABLE "MembershipPlanPrice" (
  "id" TEXT NOT NULL,
  "plan" "MembershipPlan" NOT NULL,
  "priceTryCents" INTEGER NOT NULL,
  "priceEurCents" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipPlanPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipUpgradeRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currentPlan" "MembershipPlan" NOT NULL,
  "requestedPlan" "MembershipPlan" NOT NULL,
  "status" "UpgradeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "memberNote" TEXT,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "MembershipUpgradeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipPlanPrice_plan_key" ON "MembershipPlanPrice"("plan");
CREATE INDEX "MembershipUpgradeRequest_userId_status_idx" ON "MembershipUpgradeRequest"("userId", "status");
CREATE INDEX "MembershipUpgradeRequest_status_createdAt_idx" ON "MembershipUpgradeRequest"("status", "createdAt");

ALTER TABLE "MembershipUpgradeRequest"
ADD CONSTRAINT "MembershipUpgradeRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
