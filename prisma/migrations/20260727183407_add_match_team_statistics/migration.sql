-- CreateTable
CREATE TABLE "MatchTeamStatistic" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "expectedGoals" DOUBLE PRECISION,
    "expectedGoalsAgainst" DOUBLE PRECISION,
    "shots" INTEGER,
    "shotsOnTarget" INTEGER,
    "possession" DOUBLE PRECISION,
    "corners" INTEGER,
    "fouls" INTEGER,
    "offsides" INTEGER,
    "yellowCards" INTEGER,
    "redCards" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'API_FOOTBALL',
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchTeamStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchTeamStatistic_matchId_idx" ON "MatchTeamStatistic"("matchId");

-- CreateIndex
CREATE INDEX "MatchTeamStatistic_teamId_idx" ON "MatchTeamStatistic"("teamId");

-- CreateIndex
CREATE INDEX "MatchTeamStatistic_expectedGoals_idx" ON "MatchTeamStatistic"("expectedGoals");

-- CreateIndex
CREATE UNIQUE INDEX "MatchTeamStatistic_matchId_teamId_key" ON "MatchTeamStatistic"("matchId", "teamId");

-- AddForeignKey
ALTER TABLE "MatchTeamStatistic" ADD CONSTRAINT "MatchTeamStatistic_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTeamStatistic" ADD CONSTRAINT "MatchTeamStatistic_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
