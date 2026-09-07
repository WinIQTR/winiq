import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ProductionDashboardPrediction,
} from "@/lib/prediction-dashboard";

import {
  mergeDashboardPredictionHistory,
} from "@/lib/prediction-dashboard-snapshot";

function createPrediction(options: {
  matchId: number;
  kickoffAt: string;
  probability: number;
  settlementStatus?: "PENDING" | "WON" | "LOST" | "VOID";
  finalHomeScore?: number | null;
  finalAwayScore?: number | null;
}): ProductionDashboardPrediction {
  const homeProbability = options.probability;
  const drawProbability = 20;
  const awayProbability = 100 - homeProbability - drawProbability;

  return {
    matchId: options.matchId,
    kickoffAt: new Date(options.kickoffAt),
    dataMode: "LIVE",
    leagueApiId: 999,
    leagueName: "Archive Test League",
    homeTeam: `Home ${options.matchId}`,
    awayTeam: `Away ${options.matchId}`,
    homeTeamLogo: null,
    awayTeamLogo: null,
    homeProbability,
    drawProbability,
    awayProbability,
    predictedOutcome: "HOME",
    predictedProbability: homeProbability,
    confidenceScore: 80,
    confidenceLevel: "HIGH",
    expectedHomeGoals: 1.8,
    expectedAwayGoals: 0.7,
    settlementStatus: options.settlementStatus,
    finalHomeScore: options.finalHomeScore,
    finalAwayScore: options.finalAwayScore,
    popularPicks: [],
    topPicks: [
      {
        rank: 1,
        key: "match_result_home",
        category: "Match Result",
        market: "Match Result",
        selection: "Home",
        probability: homeProbability,
        fairOdds: 100 / homeProbability,
        reliabilityScore: 80,
        pickScore: 80,
        historicalHitRate: null,
        historicalSamples: 0,
        thresholdHitRate: null,
        thresholdSamples: 0,
        tier: "HIGH",
        reasons: [],
      },
    ],
    marketCount: 1,
    homeRating: 70,
    awayRating: 60,
    homeAttack: 70,
    awayAttack: 60,
    homeDefense: 70,
    awayDefense: 60,
    homeForm: 70,
    awayForm: 60,
    homeFitness: 70,
    awayFitness: 60,
    ratingDifference: 10,
    ratingEdge: "HOME",
    warnings: [],
    productionCandidateType: "PRIMARY_HOME",
    productionScore: 80,
    dataQualityScore: 75,
    probabilityGap: 25,
    fairOdds: 100 / homeProbability,
    leagueMatches: 100,
    homeVenueMatches: 50,
    awayVenueMatches: 50,
    drawAuditWouldApply: false,
    mlFallback: false,
    productionModelName: "20% ML / 80% Poisson",
    topPicksModelName: "Top Picks V2",
    topPicksModelVersion: "2.0",
    selectionPolicyVersion: "selection-policy-v2",
  };
}

async function main(): Promise<void> {
  const firstPrediction = createPrediction({
    matchId: 101,
    kickoffAt: "2026-08-12T18:00:00.000Z",
    probability: 64,
    settlementStatus: "PENDING",
  });

  const secondPrediction = createPrediction({
    matchId: 102,
    kickoffAt: "2026-08-13T18:00:00.000Z",
    probability: 67,
    settlementStatus: "PENDING",
  });

  const archivedAfterSecondDay =
    mergeDashboardPredictionHistory(
      [firstPrediction],
      [
        createPrediction({
          matchId: 101,
          kickoffAt: "2026-08-12T18:00:00.000Z",
          probability: 99,
          settlementStatus: "PENDING",
        }),
        secondPrediction,
      ],
    );

  assert.equal(archivedAfterSecondDay.length, 2);
  assert.equal(
    archivedAfterSecondDay.find(
      (prediction) => prediction.matchId === 101,
    )?.predictedProbability,
    64,
    "The first published probability must remain immutable.",
  );

  const finalArchive = mergeDashboardPredictionHistory(
    archivedAfterSecondDay,
    [
      createPrediction({
        matchId: 101,
        kickoffAt: "2026-08-12T18:00:00.000Z",
        probability: 99,
        settlementStatus: "WON",
        finalHomeScore: 2,
        finalAwayScore: 0,
      }),
    ],
  );

  const firstArchivedMatch =
    finalArchive.find(
      (prediction) => prediction.matchId === 101,
    );

  assert.equal(finalArchive.length, 2);
  assert.equal(firstArchivedMatch?.predictedProbability, 64);
  assert.equal(firstArchivedMatch?.settlementStatus, "WON");
  assert.equal(firstArchivedMatch?.finalHomeScore, 2);
  assert.equal(firstArchivedMatch?.finalAwayScore, 0);

  const snapshotSource = await readFile(
    join(
      process.cwd(),
      "src",
      "lib",
      "prediction-dashboard-snapshot.ts",
    ),
    "utf8",
  );

  assert.match(snapshotSource, /SNAPSHOT_SCHEMA_VERSION\s*=\s*2/);
  assert.match(snapshotSource, /PREDICTION_DASHBOARD_SNAPSHOT_PATH/);

  const refreshSource = await readFile(
      join(
        process.cwd(),
        "scripts",
        "refresh-production-data.ts",
      ),
      "utf8",
    );

  assert.match(
    refreshSource,
    /DEFAULT_RESULT_LOOKBACK_DAYS\s*=\s*3/,
    "Daily refresh must include recent completed fixtures.",
  );

  assert.match(
    refreshSource,
    /PREDICTION_RESULT_LOOKBACK_DAYS/,
    "The result lookback must remain configurable.",
  );

  console.log(
    "Prediction History and Results Archive V4.6 tests passed.",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exitCode = 1;
});
