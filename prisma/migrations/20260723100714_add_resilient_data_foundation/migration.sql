-- CreateEnum
CREATE TYPE "DataProviderCode" AS ENUM ('API_FOOTBALL', 'SPORTMONKS', 'THE_ODDS_API', 'OPENWEATHER', 'TRANSFERMARKT', 'SOFASCORE', 'FLASHSCORE', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'NO_DATA', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ExternalEntityType" AS ENUM ('COUNTRY', 'LEAGUE', 'SEASON', 'TEAM', 'PLAYER', 'MATCH', 'VENUE', 'COACH', 'REFEREE', 'BOOKMAKER');

-- CreateEnum
CREATE TYPE "CoverageEntityType" AS ENUM ('LEAGUE', 'SEASON', 'TEAM', 'MATCH');

-- CreateEnum
CREATE TYPE "DataAvailabilityStatus" AS ENUM ('AVAILABLE', 'PARTIAL', 'MISSING', 'NOT_SUPPORTED', 'STALE', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "TeamSeasonStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'RELEGATED', 'WITHDRAWN', 'UNKNOWN');

-- CreateTable
CREATE TABLE "TeamSeason" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "status" "TeamSeasonStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER,
    "groupName" TEXT,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" SERIAL NOT NULL,
    "code" "DataProviderCode" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "supportsLiveData" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "entityType" "ExternalEntityType" NOT NULL,
    "operation" TEXT NOT NULL,
    "requestedLeagueId" INTEGER,
    "requestedSeason" INTEGER,
    "requestedEntityId" INTEGER,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsReceived" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEntityMap" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "entityType" "ExternalEntityType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "internalEntityId" INTEGER NOT NULL,
    "externalName" TEXT,
    "externalCode" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceEntityMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCoverage" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "entityType" "CoverageEntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "fixturesStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "resultsStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "standingsStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "teamStatisticsStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "playerStatisticsStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "lineupStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "injuryStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "oddsStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "expectedGoalsStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "weatherStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "refereeStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "coverageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "dataUpdatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualitySnapshot" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "seasonId" INTEGER NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "coreDataScore" DOUBLE PRECISION NOT NULL,
    "teamDataScore" DOUBLE PRECISION NOT NULL,
    "playerDataScore" DOUBLE PRECISION NOT NULL,
    "lineupDataScore" DOUBLE PRECISION NOT NULL,
    "injuryDataScore" DOUBLE PRECISION NOT NULL,
    "oddsDataScore" DOUBLE PRECISION NOT NULL,
    "weatherDataScore" DOUBLE PRECISION NOT NULL,
    "refereeDataScore" DOUBLE PRECISION NOT NULL,
    "availableFeatureCount" INTEGER NOT NULL DEFAULT 0,
    "missingFeatureCount" INTEGER NOT NULL DEFAULT 0,
    "staleFeatureCount" INTEGER NOT NULL DEFAULT 0,
    "missingFeatureKeys" JSONB,
    "warningMessages" JSONB,
    "modelVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataQualitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamSeason_leagueId_seasonId_idx" ON "TeamSeason"("leagueId", "seasonId");

-- CreateIndex
CREATE INDEX "TeamSeason_seasonId_idx" ON "TeamSeason"("seasonId");

-- CreateIndex
CREATE INDEX "TeamSeason_status_idx" ON "TeamSeason"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeason_teamId_seasonId_key" ON "TeamSeason"("teamId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_code_key" ON "DataSource"("code");

-- CreateIndex
CREATE INDEX "DataSource_isActive_idx" ON "DataSource"("isActive");

-- CreateIndex
CREATE INDEX "DataSource_priority_idx" ON "DataSource"("priority");

-- CreateIndex
CREATE INDEX "ImportRun_dataSourceId_startedAt_idx" ON "ImportRun"("dataSourceId", "startedAt");

-- CreateIndex
CREATE INDEX "ImportRun_entityType_idx" ON "ImportRun"("entityType");

-- CreateIndex
CREATE INDEX "ImportRun_status_idx" ON "ImportRun"("status");

-- CreateIndex
CREATE INDEX "ImportRun_requestedLeagueId_requestedSeason_idx" ON "ImportRun"("requestedLeagueId", "requestedSeason");

-- CreateIndex
CREATE INDEX "SourceEntityMap_entityType_internalEntityId_idx" ON "SourceEntityMap"("entityType", "internalEntityId");

-- CreateIndex
CREATE INDEX "SourceEntityMap_externalName_idx" ON "SourceEntityMap"("externalName");

-- CreateIndex
CREATE INDEX "SourceEntityMap_isVerified_idx" ON "SourceEntityMap"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEntityMap_dataSourceId_entityType_externalId_key" ON "SourceEntityMap"("dataSourceId", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "DataCoverage_entityType_entityId_idx" ON "DataCoverage"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataCoverage_coverageScore_idx" ON "DataCoverage"("coverageScore");

-- CreateIndex
CREATE INDEX "DataCoverage_lastCheckedAt_idx" ON "DataCoverage"("lastCheckedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataCoverage_dataSourceId_entityType_entityId_key" ON "DataCoverage"("dataSourceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataQualitySnapshot_matchId_idx" ON "DataQualitySnapshot"("matchId");

-- CreateIndex
CREATE INDEX "DataQualitySnapshot_teamId_idx" ON "DataQualitySnapshot"("teamId");

-- CreateIndex
CREATE INDEX "DataQualitySnapshot_seasonId_idx" ON "DataQualitySnapshot"("seasonId");

-- CreateIndex
CREATE INDEX "DataQualitySnapshot_overallScore_idx" ON "DataQualitySnapshot"("overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "DataQualitySnapshot_matchId_teamId_modelVersion_key" ON "DataQualitySnapshot"("matchId", "teamId", "modelVersion");

-- AddForeignKey
ALTER TABLE "TeamSeason" ADD CONSTRAINT "TeamSeason_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeason" ADD CONSTRAINT "TeamSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeason" ADD CONSTRAINT "TeamSeason_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEntityMap" ADD CONSTRAINT "SourceEntityMap_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCoverage" ADD CONSTRAINT "DataCoverage_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualitySnapshot" ADD CONSTRAINT "DataQualitySnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualitySnapshot" ADD CONSTRAINT "DataQualitySnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualitySnapshot" ADD CONSTRAINT "DataQualitySnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
