-- CreateTable
CREATE TABLE "Bookmaker" (
    "id" SERIAL NOT NULL,
    "apiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "bookmakerId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'API_FOOTBALL',
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsMarket" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "apiBetId" INTEGER NOT NULL,
    "marketKey" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "marketFamily" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSelection" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "selectionKey" TEXT NOT NULL,
    "selectionName" TEXT NOT NULL,
    "decimalOdds" DOUBLE PRECISION NOT NULL,
    "impliedProbability" DOUBLE PRECISION NOT NULL,
    "normalizedProbability" DOUBLE PRECISION,
    "line" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bookmaker_apiId_key" ON "Bookmaker"("apiId");

-- CreateIndex
CREATE INDEX "Bookmaker_name_idx" ON "Bookmaker"("name");

-- CreateIndex
CREATE INDEX "Bookmaker_isActive_idx" ON "Bookmaker"("isActive");

-- CreateIndex
CREATE INDEX "Bookmaker_priority_idx" ON "Bookmaker"("priority");

-- CreateIndex
CREATE INDEX "OddsSnapshot_matchId_idx" ON "OddsSnapshot"("matchId");

-- CreateIndex
CREATE INDEX "OddsSnapshot_bookmakerId_idx" ON "OddsSnapshot"("bookmakerId");

-- CreateIndex
CREATE INDEX "OddsSnapshot_capturedAt_idx" ON "OddsSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "OddsSnapshot_sourceUpdatedAt_idx" ON "OddsSnapshot"("sourceUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OddsSnapshot_matchId_bookmakerId_sourceUpdatedAt_key" ON "OddsSnapshot"("matchId", "bookmakerId", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "OddsMarket_snapshotId_idx" ON "OddsMarket"("snapshotId");

-- CreateIndex
CREATE INDEX "OddsMarket_marketKey_idx" ON "OddsMarket"("marketKey");

-- CreateIndex
CREATE INDEX "OddsMarket_marketFamily_idx" ON "OddsMarket"("marketFamily");

-- CreateIndex
CREATE INDEX "OddsMarket_apiBetId_idx" ON "OddsMarket"("apiBetId");

-- CreateIndex
CREATE UNIQUE INDEX "OddsMarket_snapshotId_apiBetId_key" ON "OddsMarket"("snapshotId", "apiBetId");

-- CreateIndex
CREATE INDEX "OddsSelection_marketId_idx" ON "OddsSelection"("marketId");

-- CreateIndex
CREATE INDEX "OddsSelection_selectionKey_idx" ON "OddsSelection"("selectionKey");

-- CreateIndex
CREATE INDEX "OddsSelection_decimalOdds_idx" ON "OddsSelection"("decimalOdds");

-- CreateIndex
CREATE INDEX "OddsSelection_impliedProbability_idx" ON "OddsSelection"("impliedProbability");

-- CreateIndex
CREATE UNIQUE INDEX "OddsSelection_marketId_selectionKey_key" ON "OddsSelection"("marketId", "selectionKey");

-- AddForeignKey
ALTER TABLE "OddsSnapshot" ADD CONSTRAINT "OddsSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsSnapshot" ADD CONSTRAINT "OddsSnapshot_bookmakerId_fkey" FOREIGN KEY ("bookmakerId") REFERENCES "Bookmaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsMarket" ADD CONSTRAINT "OddsMarket_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "OddsSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsSelection" ADD CONSTRAINT "OddsSelection_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "OddsMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
