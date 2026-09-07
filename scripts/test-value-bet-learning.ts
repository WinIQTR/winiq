import assert from "node:assert/strict";

import { buildValueBetLearningReport, MINIMUM_LEARNING_SAMPLE } from "@/lib/value-bet-learning";
import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

function row(id: number, won: boolean, overrides: Partial<ValueBetDashboardRow> = {}): ValueBetDashboardRow {
  const kickoffAt = new Date(Date.UTC(2025, 0, 1 + id));
  return {
    id, matchId: id, leagueApiId: 39, leagueName: "Premier League", kickoffAt,
    homeTeam: "Home", awayTeam: "Away", marketKey: "home_win", market: "Match Result", selection: "Home",
    modelProbability: 62, fairOdds: 1.61, bestOdds: 2, medianOdds: 1.9,
    marketProbability: 52, marketEdge: 10, expectedValue: 24, valueScore: 80,
    recommendedStakePercentage: 2, bookmakerName: "Test", bookmakerCount: 8,
    valueLevel: "EXCELLENT", sourceUpdatedAt: kickoffAt, capturedAt: kickoffAt,
    result: won ? "WON" : "LOST", profitUnits: won ? 1 : -1,
    actualHomeScore: won ? 2 : 0, actualAwayScore: 1,
    publishedAt: kickoffAt, settledAt: kickoffAt,
    ...overrides,
  };
}

const collecting = buildValueBetLearningReport(Array.from({ length: 25 }, (_, index) => row(index, index % 2 === 0)));
assert.equal(collecting.status, "COLLECTING");
assert.equal(collecting.independentSelections, 25);
assert.equal(collecting.minimumSample, MINIMUM_LEARNING_SAMPLE);
assert.equal(collecting.productionChangeAllowed, false);

const duplicates = buildValueBetLearningReport([
  row(1, true, { valueScore: 70 }),
  row(2, false),
  row(3, true, { matchId: 1, valueScore: 90, marketKey: "btts_yes" }),
]);
assert.equal(duplicates.independentSelections, 2);

const stable = buildValueBetLearningReport(
  Array.from({ length: 300 }, (_, index) => row(index + 10, index % 5 < 3)),
);
assert.equal(stable.independentSelections, 300);
assert.equal(stable.trainSelections, 210);
assert.equal(stable.validationSelections, 90);
assert.equal(stable.productionChangeAllowed, false);
assert.notEqual(stable.status, "COLLECTING");

console.log("Value Bet Historical Learning V2.4 tests passed.");
