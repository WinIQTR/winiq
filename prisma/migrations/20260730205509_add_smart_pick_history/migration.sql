-- CreateTable
CREATE TABLE "SmartPickHistory" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "leagueApiId" INTEGER NOT NULL,
    "leagueName" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "fairOdds" DOUBLE PRECISION,
    "reliabilityScore" DOUBLE PRECISION NOT NULL,
    "pickScore" DOUBLE PRECISION NOT NULL,
    "tier" TEXT NOT NULL,
    "historicalHitRate" DOUBLE PRECISION,
    "historicalSamples" INTEGER NOT NULL,
    "thresholdHitRate" DOUBLE PRECISION,
    "thresholdSamples" INTEGER NOT NULL,
    "actualHomeScore" INTEGER NOT NULL,
    "actualAwayScore" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartPickHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmartPickHistory_kickoffAt_idx" ON "SmartPickHistory"("kickoffAt");

-- CreateIndex
CREATE INDEX "SmartPickHistory_leagueApiId_idx" ON "SmartPickHistory"("leagueApiId");

-- CreateIndex
CREATE INDEX "SmartPickHistory_marketKey_idx" ON "SmartPickHistory"("marketKey");

-- CreateIndex
CREATE INDEX "SmartPickHistory_tier_idx" ON "SmartPickHistory"("tier");

-- CreateIndex
CREATE INDEX "SmartPickHistory_reliabilityScore_idx" ON "SmartPickHistory"("reliabilityScore");

-- CreateIndex
CREATE INDEX "SmartPickHistory_result_idx" ON "SmartPickHistory"("result");

-- CreateIndex
CREATE UNIQUE INDEX "SmartPickHistory_matchId_marketKey_modelVersion_key" ON "SmartPickHistory"("matchId", "marketKey", "modelVersion");

-- AddForeignKey
ALTER TABLE "SmartPickHistory" ADD CONSTRAINT "SmartPickHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
