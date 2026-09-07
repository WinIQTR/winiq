import assert from "node:assert/strict";
import { buildModelHealthReport } from "@/lib/value-bet-model-health";
import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

const now = new Date("2026-08-13T20:00:00.000Z");
function row(id: number, won: boolean, overrides: Partial<ValueBetDashboardRow> = {}): ValueBetDashboardRow {
  const kickoffAt = new Date(Date.UTC(2025, 0, 1 + id));
  return {
    id, matchId: id, leagueApiId: 39, leagueName: "Premier League", kickoffAt,
    homeTeam: "Home", awayTeam: "Away", marketKey: "home_win", market: "Match Result", selection: "Home",
    modelProbability: 60, fairOdds: 1.67, bestOdds: 2, medianOdds: 1.9,
    marketProbability: 50, marketEdge: 10, expectedValue: 20, valueScore: 80,
    recommendedStakePercentage: 2, bookmakerName: "Test", bookmakerCount: 8,
    valueLevel: "EXCELLENT", sourceUpdatedAt: now, capturedAt: now,
    result: won ? "WON" : "LOST", profitUnits: won ? 1 : -1,
    actualHomeScore: won ? 2 : 0, actualAwayScore: 1, publishedAt: kickoffAt, settledAt: kickoffAt,
    ...overrides,
  };
}

const collecting = buildModelHealthReport({ generatedAt: new Date("2026-08-13T15:00:00.000Z"), upcoming: [row(1, true, { result: "PENDING" })], settled: Array.from({ length: 9 }, (_, i) => row(i + 10, i < 6)), now });
assert.equal(collecting.overallLevel, "HEALTHY");
assert.equal(collecting.snapshot.ageHours, 5);
assert.equal(collecting.drift.status, "COLLECTING");
assert.equal(collecting.drift.minimumRequired, 130);
assert.equal(collecting.automaticProductionChangeAllowed, false);

const stale = buildModelHealthReport({ generatedAt: new Date("2026-08-12T10:00:00.000Z"), upcoming: [], settled: [], now });
assert.equal(stale.overallLevel, "CRITICAL");

const driftRows = [
  ...Array.from({ length: 100 }, (_, i) => row(i + 100, i % 5 < 3, { modelProbability: 60 })),
  ...Array.from({ length: 30 }, (_, i) => row(i + 300, i < 6, { modelProbability: 80 })),
];
const drift = buildModelHealthReport({ generatedAt: now, upcoming: [], settled: driftRows, now });
assert.equal(drift.drift.status, "CRITICAL");
assert.equal(drift.overallLevel, "CRITICAL");

console.log("Model Health and Drift Monitor V2.7 tests passed.");
