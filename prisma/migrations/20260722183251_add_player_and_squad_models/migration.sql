-- CreateEnum
CREATE TYPE "PlayerPosition" AS ENUM ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('DOUBTFUL', 'INJURED', 'RECOVERING', 'AVAILABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LineupStatus" AS ENUM ('PREDICTED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "apiId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "countryId" INTEGER,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "birthDate" TIMESTAMP(3),
    "age" INTEGER,
    "position" "PlayerPosition" NOT NULL DEFAULT 'UNKNOWN',
    "detailedPosition" TEXT,
    "preferredFoot" TEXT,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "shirtNumber" INTEGER,
    "photoUrl" TEXT,
    "marketValue" DECIMAL(14,2),
    "marketValueCurrency" TEXT,
    "contractEndDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeasonStatistic" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "appearances" INTEGER NOT NULL DEFAULT 0,
    "starts" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "expectedGoals" DOUBLE PRECISION,
    "expectedAssists" DOUBLE PRECISION,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
    "keyPasses" INTEGER NOT NULL DEFAULT 0,
    "bigChancesCreated" INTEGER NOT NULL DEFAULT 0,
    "bigChancesMissed" INTEGER NOT NULL DEFAULT 0,
    "successfulDribbles" INTEGER NOT NULL DEFAULT 0,
    "tackles" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "clearances" INTEGER NOT NULL DEFAULT 0,
    "duelsWon" INTEGER NOT NULL DEFAULT 0,
    "aerialDuelsWon" INTEGER NOT NULL DEFAULT 0,
    "passAccuracy" DOUBLE PRECISION,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Injury" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "matchId" INTEGER,
    "injuryType" TEXT,
    "status" "InjuryStatus" NOT NULL DEFAULT 'UNKNOWN',
    "startDate" TIMESTAMP(3),
    "expectedReturnDate" TIMESTAMP(3),
    "actualReturnDate" TIMESTAMP(3),
    "matchesMissed" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Injury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "formation" TEXT,
    "status" "LineupStatus" NOT NULL DEFAULT 'PREDICTED',
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupPlayer" (
    "id" SERIAL NOT NULL,
    "lineupId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "starter" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT,
    "formationPosition" TEXT,
    "shirtNumber" INTEGER,
    "captain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerImpactScore" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "matchId" INTEGER,
    "seasonId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "formScore" DOUBLE PRECISION NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL,
    "fitnessScore" DOUBLE PRECISION NOT NULL,
    "tacticalFitScore" DOUBLE PRECISION NOT NULL,
    "importanceScore" DOUBLE PRECISION NOT NULL,
    "marketValueScore" DOUBLE PRECISION NOT NULL,
    "overallImpactScore" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerImpactScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadStrengthScore" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "startingElevenScore" DOUBLE PRECISION NOT NULL,
    "benchScore" DOUBLE PRECISION NOT NULL,
    "goalkeeperScore" DOUBLE PRECISION NOT NULL,
    "defenceScore" DOUBLE PRECISION NOT NULL,
    "midfieldScore" DOUBLE PRECISION NOT NULL,
    "attackScore" DOUBLE PRECISION NOT NULL,
    "missingPlayerPenalty" DOUBLE PRECISION NOT NULL,
    "squadDepthScore" DOUBLE PRECISION NOT NULL,
    "overallSquadScore" DOUBLE PRECISION NOT NULL,
    "lineupCertainty" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquadStrengthScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_apiId_key" ON "Player"("apiId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Player_countryId_idx" ON "Player"("countryId");

-- CreateIndex
CREATE INDEX "Player_position_idx" ON "Player"("position");

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE INDEX "PlayerSeasonStatistic_teamId_seasonId_idx" ON "PlayerSeasonStatistic"("teamId", "seasonId");

-- CreateIndex
CREATE INDEX "PlayerSeasonStatistic_seasonId_idx" ON "PlayerSeasonStatistic"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonStatistic_playerId_teamId_seasonId_key" ON "PlayerSeasonStatistic"("playerId", "teamId", "seasonId");

-- CreateIndex
CREATE INDEX "Injury_playerId_idx" ON "Injury"("playerId");

-- CreateIndex
CREATE INDEX "Injury_teamId_idx" ON "Injury"("teamId");

-- CreateIndex
CREATE INDEX "Injury_matchId_idx" ON "Injury"("matchId");

-- CreateIndex
CREATE INDEX "Injury_status_idx" ON "Injury"("status");

-- CreateIndex
CREATE INDEX "Lineup_teamId_idx" ON "Lineup"("teamId");

-- CreateIndex
CREATE INDEX "Lineup_isConfirmed_idx" ON "Lineup"("isConfirmed");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_matchId_teamId_status_key" ON "Lineup"("matchId", "teamId", "status");

-- CreateIndex
CREATE INDEX "LineupPlayer_playerId_idx" ON "LineupPlayer"("playerId");

-- CreateIndex
CREATE INDEX "LineupPlayer_teamId_idx" ON "LineupPlayer"("teamId");

-- CreateIndex
CREATE INDEX "LineupPlayer_starter_idx" ON "LineupPlayer"("starter");

-- CreateIndex
CREATE UNIQUE INDEX "LineupPlayer_lineupId_playerId_key" ON "LineupPlayer"("lineupId", "playerId");

-- CreateIndex
CREATE INDEX "PlayerImpactScore_teamId_idx" ON "PlayerImpactScore"("teamId");

-- CreateIndex
CREATE INDEX "PlayerImpactScore_matchId_idx" ON "PlayerImpactScore"("matchId");

-- CreateIndex
CREATE INDEX "PlayerImpactScore_seasonId_idx" ON "PlayerImpactScore"("seasonId");

-- CreateIndex
CREATE INDEX "PlayerImpactScore_overallImpactScore_idx" ON "PlayerImpactScore"("overallImpactScore");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerImpactScore_playerId_matchId_modelVersion_key" ON "PlayerImpactScore"("playerId", "matchId", "modelVersion");

-- CreateIndex
CREATE INDEX "SquadStrengthScore_teamId_idx" ON "SquadStrengthScore"("teamId");

-- CreateIndex
CREATE INDEX "SquadStrengthScore_overallSquadScore_idx" ON "SquadStrengthScore"("overallSquadScore");

-- CreateIndex
CREATE UNIQUE INDEX "SquadStrengthScore_matchId_teamId_modelVersion_key" ON "SquadStrengthScore"("matchId", "teamId", "modelVersion");

-- CreateIndex
CREATE INDEX "Season_isCurrent_idx" ON "Season"("isCurrent");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonStatistic" ADD CONSTRAINT "PlayerSeasonStatistic_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonStatistic" ADD CONSTRAINT "PlayerSeasonStatistic_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonStatistic" ADD CONSTRAINT "PlayerSeasonStatistic_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPlayer" ADD CONSTRAINT "LineupPlayer_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPlayer" ADD CONSTRAINT "LineupPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPlayer" ADD CONSTRAINT "LineupPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerImpactScore" ADD CONSTRAINT "PlayerImpactScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerImpactScore" ADD CONSTRAINT "PlayerImpactScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerImpactScore" ADD CONSTRAINT "PlayerImpactScore_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerImpactScore" ADD CONSTRAINT "PlayerImpactScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadStrengthScore" ADD CONSTRAINT "SquadStrengthScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadStrengthScore" ADD CONSTRAINT "SquadStrengthScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
