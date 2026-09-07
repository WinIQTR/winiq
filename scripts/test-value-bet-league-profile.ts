import assert from "node:assert/strict";

import { buildValueBetLeagueProfileReport } from "@/lib/value-bet-league-profile";
import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

function row(id: number, won: boolean, overrides: Partial<ValueBetDashboardRow> = {}): ValueBetDashboardRow {
  const kickoffAt = new Date(Date.UTC(2025, 0, 1 + id));
  return {
    id, matchId: id, leagueApiId: 39, leagueName: "Premier League", kickoffAt,
    homeTeam: "Home", awayTeam: "Away", marketKey: "home_win", market: "Match Result", selection: "Home",
    modelProbability: 60, fairOdds: 1.67, bestOdds: 2, medianOdds: 1.9,
    marketProbability: 50, marketEdge: 10, expectedValue: 20, valueScore: 80,
    recommendedStakePercentage: 2, bookmakerName: "Test", bookmakerCount: 8,
    valueLevel: "EXCELLENT", sourceUpdatedAt: kickoffAt, capturedAt: kickoffAt,
    result: won ? "WON" : "LOST", profitUnits: won ? 1 : -1,
    actualHomeScore: won ? 2 : 0, actualAwayScore: 1,
    publishedAt: kickoffAt, settledAt: kickoffAt,
    ...overrides,
  };
}

const collecting = buildValueBetLeagueProfileReport([
  ...Array.from({ length: 9 }, (_, index) => row(index, index < 6)),
  row(100, true, { matchId: 1, valueScore: 60 }),
]);
assert.equal(collecting.independentSelections, 9);
assert.equal(collecting.leagues[0]?.status, "COLLECTING");
assert.equal(collecting.leagues[0]?.calibrationReady, false);
assert.equal(collecting.productionUseAllowed, false);

const reliable = buildValueBetLeagueProfileReport(
  Array.from({ length: 100 }, (_, index) => row(index + 200, index < 60)),
);
assert.equal(reliable.leagues[0]?.status, "RELIABLE");
assert.equal(reliable.leagues[0]?.winRate, 60);
assert.equal(reliable.leagues[0]?.calibrationGap, 0);
assert.equal(reliable.leagues[0]?.roi, 20);
assert.equal(reliable.leagues[0]?.calibrationReady, true);
assert.equal(reliable.leagues[0]?.reliabilityReady, true);
assert.equal(reliable.reliableLeagues, 1);

const broad = buildValueBetLeagueProfileReport(
  Array.from({ length: 500 }, (_, index) => row(index + 500, index % 2 === 0)),
);
assert.equal(broad.leagues[0]?.status, "BROAD_SAMPLE");

console.log("Value Bet League Profile V2.5 tests passed.");
