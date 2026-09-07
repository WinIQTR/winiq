import assert from "node:assert/strict";

import { buildValueBetExplanation } from "@/lib/value-bet-explanation";
import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

function row(overrides: Partial<ValueBetDashboardRow> = {}): ValueBetDashboardRow {
  const now = new Date("2026-08-13T17:00:00.000Z");
  return {
    id: 1, matchId: 1, leagueApiId: 1, leagueName: "Test League",
    kickoffAt: now, homeTeam: "Home", awayTeam: "Away",
    marketKey: "btts_yes", market: "Both Teams to Score", selection: "Yes",
    modelProbability: 63.5, fairOdds: 1.57, bestOdds: 1.93,
    medianOdds: 1.8, marketProbability: 49.3, marketEdge: 14.2,
    expectedValue: 22.6, valueScore: 90, recommendedStakePercentage: 2,
    bookmakerName: "Test", bookmakerCount: 8, valueLevel: "EXCELLENT",
    sourceUpdatedAt: now, capturedAt: now, result: "PENDING",
    profitUnits: null, actualHomeScore: null, actualAwayScore: null,
    publishedAt: now, settledAt: null,
    ...overrides,
  };
}

const elite = buildValueBetExplanation(row());
assert.equal(elite.verdict, "ELITE_VALUE");
assert.equal(elite.probabilityGap, 14.2);
assert.equal(elite.oddsPremium, 22.9);
assert.equal(elite.expectedProfitPerUnit, 0.226);
assert.deepEqual(elite.confidenceSignals, [
  "DOUBLE_DIGIT_PROBABILITY_GAP",
  "HIGH_EXPECTED_VALUE",
  "BROAD_MARKET_COVERAGE",
  "STRONG_ODDS_PREMIUM",
]);

const qualified = buildValueBetExplanation(row({
  modelProbability: 53, marketProbability: 49, marketEdge: 4,
  expectedValue: 6, fairOdds: null, bestOdds: 1.85, bookmakerCount: 4,
}));
assert.equal(qualified.verdict, "QUALIFIED_VALUE");
assert.equal(qualified.oddsPremium, null);
assert.deepEqual(qualified.confidenceSignals, []);

console.log("Value Bet Explanation V2.2 tests passed.");
