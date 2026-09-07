-- V2: immutable pre-kickoff Value Bet archive and settlement history.
CREATE TABLE "ValueBetHistory" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "bookmakerId" INTEGER,
    "leagueApiId" INTEGER NOT NULL,
    "leagueName" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "modelProbability" DOUBLE PRECISION NOT NULL,
    "fairOdds" DOUBLE PRECISION,
    "bestOdds" DOUBLE PRECISION NOT NULL,
    "medianOdds" DOUBLE PRECISION NOT NULL,
    "marketProbability" DOUBLE PRECISION NOT NULL,
    "marketEdge" DOUBLE PRECISION NOT NULL,
    "expectedValue" DOUBLE PRECISION NOT NULL,
    "valueScore" DOUBLE PRECISION NOT NULL,
    "recommendedStakePercentage" DOUBLE PRECISION NOT NULL,
    "bookmakerName" TEXT NOT NULL,
    "bookmakerCount" INTEGER NOT NULL,
    "valueLevel" TEXT NOT NULL,
    "publishStatus" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "actualHomeScore" INTEGER,
    "actualAwayScore" INTEGER,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "profitUnits" DOUBLE PRECISION,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "publicationFingerprint" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValueBetHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ValueBetHistory_value_match_market_model_unique_key"
ON "ValueBetHistory"("matchId", "marketKey", "modelVersion");

CREATE INDEX "ValueBetHistory_kickoffAt_idx" ON "ValueBetHistory"("kickoffAt");
CREATE INDEX "ValueBetHistory_leagueApiId_idx" ON "ValueBetHistory"("leagueApiId");
CREATE INDEX "ValueBetHistory_marketKey_idx" ON "ValueBetHistory"("marketKey");
CREATE INDEX "ValueBetHistory_result_idx" ON "ValueBetHistory"("result");
CREATE INDEX "ValueBetHistory_publishedAt_idx" ON "ValueBetHistory"("publishedAt");
CREATE INDEX "ValueBetHistory_settledAt_idx" ON "ValueBetHistory"("settledAt");
CREATE INDEX "ValueBetHistory_expectedValue_idx" ON "ValueBetHistory"("expectedValue");
CREATE INDEX "ValueBetHistory_valueScore_idx" ON "ValueBetHistory"("valueScore");

ALTER TABLE "ValueBetHistory"
ADD CONSTRAINT "ValueBetHistory_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ValueBetHistory"
ADD CONSTRAINT "ValueBetHistory_bookmakerId_fkey"
FOREIGN KEY ("bookmakerId") REFERENCES "Bookmaker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
