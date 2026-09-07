-- CreateEnum
CREATE TYPE "FeatureScope" AS ENUM ('MATCH', 'TEAM', 'PLAYER', 'LINEUP', 'ODDS', 'WEATHER', 'REFEREE', 'MOTIVATION');

-- CreateEnum
CREATE TYPE "FeatureCategory" AS ENUM ('TEAM_STRENGTH', 'RECENT_FORM', 'HOME_AWAY', 'ATTACK', 'DEFENCE', 'PLAYER_QUALITY', 'SQUAD_AVAILABILITY', 'TACTICAL_MATCHUP', 'REST_AND_FATIGUE', 'MOTIVATION', 'WEATHER', 'REFEREE', 'MARKET_ODDS', 'DATA_QUALITY');

-- CreateEnum
CREATE TYPE "FeatureValueType" AS ENUM ('NUMBER', 'PERCENTAGE', 'BOOLEAN', 'CATEGORY');

-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPERIMENTAL', 'DISABLED');

-- CreateTable
CREATE TABLE "FeatureDefinition" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "FeatureScope" NOT NULL,
    "category" "FeatureCategory" NOT NULL,
    "valueType" "FeatureValueType" NOT NULL,
    "status" "FeatureStatus" NOT NULL DEFAULT 'DRAFT',
    "unit" TEXT,
    "minimumValue" DOUBLE PRECISION,
    "maximumValue" DOUBLE PRECISION,
    "higherIsBetter" BOOLEAN,
    "availableBeforeMatch" BOOLEAN NOT NULL DEFAULT true,
    "requiredDataSource" TEXT,
    "calculationVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchFeatureValue" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "featureId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "booleanValue" BOOLEAN,
    "normalizedValue" DOUBLE PRECISION,
    "dataQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "source" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "calculationRunId" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchFeatureValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "trainedFrom" TIMESTAMP(3),
    "trainedTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelFeatureWeight" (
    "id" SERIAL NOT NULL,
    "modelVersionId" INTEGER NOT NULL,
    "featureId" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "minimumWeight" DOUBLE PRECISION,
    "maximumWeight" DOUBLE PRECISION,
    "learned" BOOLEAN NOT NULL DEFAULT false,
    "sampleSize" INTEGER,
    "performance" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelFeatureWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureDefinition_key_key" ON "FeatureDefinition"("key");

-- CreateIndex
CREATE INDEX "FeatureDefinition_scope_idx" ON "FeatureDefinition"("scope");

-- CreateIndex
CREATE INDEX "FeatureDefinition_category_idx" ON "FeatureDefinition"("category");

-- CreateIndex
CREATE INDEX "FeatureDefinition_status_idx" ON "FeatureDefinition"("status");

-- CreateIndex
CREATE INDEX "MatchFeatureValue_matchId_idx" ON "MatchFeatureValue"("matchId");

-- CreateIndex
CREATE INDEX "MatchFeatureValue_featureId_idx" ON "MatchFeatureValue"("featureId");

-- CreateIndex
CREATE INDEX "MatchFeatureValue_teamId_idx" ON "MatchFeatureValue"("teamId");

-- CreateIndex
CREATE INDEX "MatchFeatureValue_calculatedAt_idx" ON "MatchFeatureValue"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchFeatureValue_matchId_featureId_teamId_calculationRunId_key" ON "MatchFeatureValue"("matchId", "featureId", "teamId", "calculationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_version_key" ON "ModelVersion"("version");

-- CreateIndex
CREATE INDEX "ModelVersion_isActive_idx" ON "ModelVersion"("isActive");

-- CreateIndex
CREATE INDEX "ModelFeatureWeight_featureId_idx" ON "ModelFeatureWeight"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelFeatureWeight_modelVersionId_featureId_key" ON "ModelFeatureWeight"("modelVersionId", "featureId");

-- AddForeignKey
ALTER TABLE "MatchFeatureValue" ADD CONSTRAINT "MatchFeatureValue_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchFeatureValue" ADD CONSTRAINT "MatchFeatureValue_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchFeatureValue" ADD CONSTRAINT "MatchFeatureValue_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelFeatureWeight" ADD CONSTRAINT "ModelFeatureWeight_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelFeatureWeight" ADD CONSTRAINT "ModelFeatureWeight_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
