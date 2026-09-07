-- Turn SmartPickHistory into a publish-before-kickoff archive.
-- Existing settled records keep their current scores and result values.

ALTER TABLE "SmartPickHistory"
  ADD COLUMN "marketOdds" DOUBLE PRECISION,
  ADD COLUMN "dataQualityScore" DOUBLE PRECISION,
  ADD COLUMN "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "publicationFingerprint" TEXT;

ALTER TABLE "SmartPickHistory"
  ALTER COLUMN "actualHomeScore" DROP NOT NULL,
  ALTER COLUMN "actualAwayScore" DROP NOT NULL,
  ALTER COLUMN "result" SET DEFAULT 'PENDING';

UPDATE "SmartPickHistory"
SET
  "result" = CASE UPPER("result")
    WHEN 'WIN' THEN 'WON'
    WHEN 'CORRECT' THEN 'WON'
    WHEN 'SUCCESS' THEN 'WON'
    WHEN 'LOSS' THEN 'LOST'
    WHEN 'WRONG' THEN 'LOST'
    WHEN 'INCORRECT' THEN 'LOST'
    WHEN 'PUSH' THEN 'VOID'
    WHEN 'REFUND' THEN 'VOID'
    ELSE UPPER("result")
  END,
  "publishedAt" = "createdAt",
  "settledAt" = CASE
    WHEN UPPER("result") IN (
      'WON', 'WIN', 'CORRECT', 'SUCCESS',
      'LOST', 'LOSS', 'WRONG', 'INCORRECT',
      'VOID', 'PUSH', 'REFUND'
    ) THEN "updatedAt"
    ELSE NULL
  END;

CREATE INDEX "SmartPickHistory_publishedAt_idx"
  ON "SmartPickHistory"("publishedAt");

CREATE INDEX "SmartPickHistory_settledAt_idx"
  ON "SmartPickHistory"("settledAt");

CREATE INDEX "SmartPickHistory_modelVersion_idx"
  ON "SmartPickHistory"("modelVersion");

-- Preserve archive rows even if a match deletion is attempted.
ALTER TABLE "SmartPickHistory"
  DROP CONSTRAINT "SmartPickHistory_matchId_fkey";

ALTER TABLE "SmartPickHistory"
  ADD CONSTRAINT "SmartPickHistory_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Published model output is immutable. Only settlement fields may change.
CREATE OR REPLACE FUNCTION protect_smart_pick_history_prediction()
RETURNS TRIGGER AS $$
BEGIN
  IF
    NEW."matchId" IS DISTINCT FROM OLD."matchId" OR
    NEW."leagueApiId" IS DISTINCT FROM OLD."leagueApiId" OR
    NEW."leagueName" IS DISTINCT FROM OLD."leagueName" OR
    NEW."kickoffAt" IS DISTINCT FROM OLD."kickoffAt" OR
    NEW."homeTeam" IS DISTINCT FROM OLD."homeTeam" OR
    NEW."awayTeam" IS DISTINCT FROM OLD."awayTeam" OR
    NEW."marketKey" IS DISTINCT FROM OLD."marketKey" OR
    NEW."category" IS DISTINCT FROM OLD."category" OR
    NEW."market" IS DISTINCT FROM OLD."market" OR
    NEW."selection" IS DISTINCT FROM OLD."selection" OR
    NEW."probability" IS DISTINCT FROM OLD."probability" OR
    NEW."fairOdds" IS DISTINCT FROM OLD."fairOdds" OR
    NEW."marketOdds" IS DISTINCT FROM OLD."marketOdds" OR
    NEW."reliabilityScore" IS DISTINCT FROM OLD."reliabilityScore" OR
    NEW."pickScore" IS DISTINCT FROM OLD."pickScore" OR
    NEW."dataQualityScore" IS DISTINCT FROM OLD."dataQualityScore" OR
    NEW."tier" IS DISTINCT FROM OLD."tier" OR
    NEW."historicalHitRate" IS DISTINCT FROM OLD."historicalHitRate" OR
    NEW."historicalSamples" IS DISTINCT FROM OLD."historicalSamples" OR
    NEW."thresholdHitRate" IS DISTINCT FROM OLD."thresholdHitRate" OR
    NEW."thresholdSamples" IS DISTINCT FROM OLD."thresholdSamples" OR
    NEW."rank" IS DISTINCT FROM OLD."rank" OR
    NEW."modelName" IS DISTINCT FROM OLD."modelName" OR
    NEW."modelVersion" IS DISTINCT FROM OLD."modelVersion" OR
    NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" OR
    NEW."publicationFingerprint" IS DISTINCT FROM OLD."publicationFingerprint"
  THEN
    RAISE EXCEPTION 'Published prediction fields are immutable';
  END IF;

  IF UPPER(OLD."result") IN ('WON', 'LOST', 'VOID') AND (
    NEW."result" IS DISTINCT FROM OLD."result" OR
    NEW."actualHomeScore" IS DISTINCT FROM OLD."actualHomeScore" OR
    NEW."actualAwayScore" IS DISTINCT FROM OLD."actualAwayScore" OR
    NEW."settledAt" IS DISTINCT FROM OLD."settledAt"
  ) THEN
    RAISE EXCEPTION 'A settled prediction cannot be changed';
  END IF;

  IF UPPER(OLD."result") = 'PENDING' AND UPPER(NEW."result") = 'PENDING' AND (
    NEW."actualHomeScore" IS DISTINCT FROM OLD."actualHomeScore" OR
    NEW."actualAwayScore" IS DISTINCT FROM OLD."actualAwayScore" OR
    NEW."settledAt" IS DISTINCT FROM OLD."settledAt"
  ) THEN
    RAISE EXCEPTION 'Settlement fields require a final result';
  END IF;

  IF UPPER(NEW."result") IN ('WON', 'LOST') AND (
    NEW."actualHomeScore" IS NULL OR
    NEW."actualAwayScore" IS NULL OR
    NEW."settledAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'Won or lost predictions require a final score and settlement time';
  END IF;

  IF UPPER(NEW."result") NOT IN ('PENDING', 'WON', 'LOST', 'VOID') THEN
    RAISE EXCEPTION 'Invalid prediction settlement result: %', NEW."result";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SmartPickHistory_prediction_immutable"
BEFORE UPDATE ON "SmartPickHistory"
FOR EACH ROW
EXECUTE FUNCTION protect_smart_pick_history_prediction();
