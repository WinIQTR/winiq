-- CreateTable
CREATE TABLE "SmartCouponHistory" (
    "id" SERIAL NOT NULL,
    "publicationKey" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "band" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "riskNote" TEXT NOT NULL,
    "totalOdds" DOUBLE PRECISION NOT NULL,
    "combinedModelProbability" DOUBLE PRECISION NOT NULL,
    "averageModelProbability" DOUBLE PRECISION NOT NULL,
    "averageMarketEdge" DOUBLE PRECISION NOT NULL,
    "averageExpectedValue" DOUBLE PRECISION NOT NULL,
    "minimumBookmakerCount" INTEGER NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "profitUnits" DOUBLE PRECISION,
    "wonLegs" INTEGER NOT NULL DEFAULT 0,
    "lostLegs" INTEGER NOT NULL DEFAULT 0,
    "voidLegs" INTEGER NOT NULL DEFAULT 0,
    "pendingLegs" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartCouponHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartCouponLegHistory" (
    "id" SERIAL NOT NULL,
    "couponId" INTEGER NOT NULL,
    "valueBetHistoryId" INTEGER NOT NULL,
    "matchId" INTEGER NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "leagueName" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "modelProbability" DOUBLE PRECISION NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "actualHomeScore" INTEGER,
    "actualAwayScore" INTEGER,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartCouponLegHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmartCouponHistory_publicationKey_key" ON "SmartCouponHistory"("publicationKey");
CREATE INDEX "SmartCouponHistory_publishedAt_idx" ON "SmartCouponHistory"("publishedAt");
CREATE INDEX "SmartCouponHistory_settledAt_idx" ON "SmartCouponHistory"("settledAt");
CREATE INDEX "SmartCouponHistory_result_idx" ON "SmartCouponHistory"("result");
CREATE INDEX "SmartCouponHistory_band_idx" ON "SmartCouponHistory"("band");
CREATE INDEX "SmartCouponHistory_window_idx" ON "SmartCouponHistory"("window");
CREATE UNIQUE INDEX "SmartCouponLegHistory_couponId_valueBetHistoryId_key" ON "SmartCouponLegHistory"("couponId", "valueBetHistoryId");
CREATE INDEX "SmartCouponLegHistory_couponId_idx" ON "SmartCouponLegHistory"("couponId");
CREATE INDEX "SmartCouponLegHistory_valueBetHistoryId_idx" ON "SmartCouponLegHistory"("valueBetHistoryId");
CREATE INDEX "SmartCouponLegHistory_matchId_idx" ON "SmartCouponLegHistory"("matchId");
CREATE INDEX "SmartCouponLegHistory_kickoffAt_idx" ON "SmartCouponLegHistory"("kickoffAt");
CREATE INDEX "SmartCouponLegHistory_result_idx" ON "SmartCouponLegHistory"("result");

-- AddForeignKey
ALTER TABLE "SmartCouponLegHistory" ADD CONSTRAINT "SmartCouponLegHistory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "SmartCouponHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCouponLegHistory" ADD CONSTRAINT "SmartCouponLegHistory_valueBetHistoryId_fkey" FOREIGN KEY ("valueBetHistoryId") REFERENCES "ValueBetHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCouponLegHistory" ADD CONSTRAINT "SmartCouponLegHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
