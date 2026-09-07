import assert from "node:assert/strict";

import { buildChampionChallengerAudit } from "@/lib/value-bet-champion-challenger";
import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

function row(id: number, won: boolean, overrides: Partial<ValueBetDashboardRow> = {}): ValueBetDashboardRow {
  const kickoffAt = new Date(Date.UTC(2025, 0, 1 + id));
  return {
    id, matchId: id, leagueApiId: 39, leagueName: "Premier League", kickoffAt,
    homeTeam: "Home", awayTeam: "Away", marketKey: "home_win", market: "Match Result", selection: "Home",
    modelProbability: 80, fairOdds: 1.25, bestOdds: 1.8, medianOdds: 1.7,
    marketProbability: 58, marketEdge: 22, expectedValue: 44, valueScore: 80,
    recommendedStakePercentage: 2, bookmakerName: "Test", bookmakerCount: 8,
    valueLevel: "EXCELLENT", sourceUpdatedAt: kickoffAt, capturedAt: kickoffAt,
    result: won ? "WON" : "LOST", profitUnits: won ? 0.8 : -1,
    actualHomeScore: won ? 2 : 0, actualAwayScore: 1,
    publishedAt: kickoffAt, settledAt: kickoffAt,
    ...overrides,
  };
}

const collecting = buildChampionChallengerAudit(Array.from({ length: 9 }, (_, index) => row(index, index < 6)));
assert.equal(collecting.status, "COLLECTING");
assert.equal(collecting.independentSelections, 9);
assert.equal(collecting.progressPercentage, 3);
assert.equal(collecting.productionChangeAllowed, false);

const outcomes = Array.from({ length: 300 }, (_, index) => index % 5 < 3);
const passed = buildChampionChallengerAudit(outcomes.map((won, index) => row(index + 100, won)));
assert.equal(passed.profileSelections, 180);
assert.equal(passed.selectionSelections, 60);
assert.equal(passed.finalUnseenSelections, 60);
assert.equal(passed.status, "CHALLENGER_PASSED");
assert.equal(passed.gates?.distinctWeight, true);
assert.equal(passed.gates?.brierImproved, true);
assert.equal(passed.gates?.logLossImproved, true);
assert.equal(passed.gates?.eceImproved, true);
assert.equal(passed.gates?.accuracyProtected, true);
assert.equal(passed.productionChangeAllowed, false);

console.log("Champion-Challenger Ensemble Audit V2.6 tests passed.");
