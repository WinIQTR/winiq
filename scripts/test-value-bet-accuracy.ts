import assert from "node:assert/strict";

import { buildValueBetAccuracyReport } from "@/lib/value-bet-accuracy";
import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

function row(
  id: number,
  result: "PENDING" | "WON" | "LOST" | "VOID",
  overrides: Partial<ValueBetDashboardRow> = {},
): ValueBetDashboardRow {
  const now = new Date("2026-08-13T17:00:00.000Z");
  return {
    id, matchId: id, leagueApiId: 39, leagueName: "Premier League",
    kickoffAt: now, homeTeam: "Home", awayTeam: "Away",
    marketKey: "btts_yes", market: "Both Teams to Score", selection: "Yes",
    modelProbability: 60, fairOdds: 1.67, bestOdds: 2,
    medianOdds: 1.9, marketProbability: 50, marketEdge: 10,
    expectedValue: 20, valueScore: 80, recommendedStakePercentage: 2,
    bookmakerName: "Test", bookmakerCount: 8, valueLevel: "EXCELLENT",
    sourceUpdatedAt: now, capturedAt: now, result,
    profitUnits: result === "WON" ? 1 : result === "LOST" ? -1 : result === "VOID" ? 0 : null,
    actualHomeScore: result === "PENDING" ? null : 2,
    actualAwayScore: result === "PENDING" ? null : 1,
    publishedAt: now, settledAt: result === "PENDING" ? null : now,
    ...overrides,
  };
}

const report = buildValueBetAccuracyReport([
  row(1, "WON"),
  row(2, "WON", { bestOdds: 1.8, profitUnits: 0.8, modelProbability: 65 }),
  row(3, "LOST", { modelProbability: 70, marketKey: "total_goals_2_5_under", market: "Total Goals 2.5" }),
  row(4, "VOID"),
  row(5, "PENDING"),
]);

assert.equal(report.settled, 3);
assert.equal(report.won, 2);
assert.equal(report.lost, 1);
assert.equal(report.voided, 1);
assert.equal(report.winRate, 66.7);
assert.equal(report.averageModelProbability, 65);
assert.equal(report.calibrationGap, 1.7);
assert.equal(report.profitUnits, 0.8);
assert.equal(report.roi, 26.7);
assert.equal(report.sampleStatus, "BUILDING");
assert.equal(report.probabilityBuckets.length, 2);
assert.equal(report.markets[0]?.settled, 2);
assert.equal(report.leagues[0]?.settled, 3);

const mature = buildValueBetAccuracyReport(
  Array.from({ length: 100 }, (_, index) => row(index + 10, index < 60 ? "WON" : "LOST")),
);
assert.equal(mature.sampleStatus, "MATURE");
assert.equal(mature.settled, 100);
assert.equal(mature.winRate, 60);
assert.equal(mature.calibrationGap, 0);

console.log("Value Bet Accuracy V2.3 tests passed.");
