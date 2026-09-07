import assert from "node:assert/strict";

import {
  buildProductionReportBundle,
  renderProductionReportMarkdown,
} from "@/lib/production-report";
import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

function row(options: {
  id: number;
  result: "WON" | "LOST";
  settledAt: string;
  bestOdds?: number;
}): ValueBetDashboardRow {
  const settledAt = new Date(options.settledAt);
  const won = options.result === "WON";

  return {
    id: options.id,
    matchId: options.id,
    leagueApiId: 2,
    leagueName: "UEFA Champions League",
    kickoffAt: new Date(settledAt.getTime() - 7_200_000),
    homeTeam: `Home ${options.id}`,
    awayTeam: `Away ${options.id}`,
    marketKey: "TOTAL_GOALS_2_5_UNDER",
    market: "Total Goals 2.5",
    selection: "UNDER",
    modelProbability: 60,
    fairOdds: 1.67,
    bestOdds: options.bestOdds ?? 2,
    medianOdds: 1.9,
    marketProbability: 52.6,
    marketEdge: 7.4,
    expectedValue: 20,
    valueScore: 75,
    recommendedStakePercentage: 1,
    bookmakerName: "Test Bookmaker",
    bookmakerCount: 4,
    valueLevel: "ELITE",
    sourceUpdatedAt: new Date(settledAt.getTime() - 10_800_000),
    capturedAt: new Date(settledAt.getTime() - 7_200_000),
    result: options.result,
    profitUnits: won ? (options.bestOdds ?? 2) - 1 : -1,
    actualHomeScore: 1,
    actualAwayScore: 0,
    publishedAt: new Date(settledAt.getTime() - 86_400_000),
    settledAt,
  };
}

const now = new Date("2026-08-14T09:00:00.000Z");
const reports = buildProductionReportBundle(
  {
    generatedAt: new Date("2026-08-14T08:59:00.000Z"),
    upcoming: [],
    settled: [
      row({ id: 1, result: "WON", settledAt: "2026-08-14T06:00:00.000Z" }),
      row({ id: 2, result: "LOST", settledAt: "2026-08-14T08:00:00.000Z" }),
      row({ id: 3, result: "WON", settledAt: "2026-08-13T18:00:00.000Z" }),
      row({ id: 4, result: "LOST", settledAt: "2026-08-07T18:00:00.000Z" }),
    ],
  },
  now,
);

assert.equal(reports.daily.period.key, "2026-08-14");
assert.equal(reports.daily.settled.settled, 2);
assert.equal(reports.daily.settled.won, 1);
assert.equal(reports.daily.settled.lost, 1);
assert.equal(reports.daily.settled.roi, 0);
assert.equal(reports.weekly.period.key, "2026-W33");
assert.equal(reports.weekly.period.startDate, "2026-08-10");
assert.equal(reports.weekly.period.endDate, "2026-08-16");
assert.equal(reports.weekly.settled.settled, 3);
assert.equal(reports.daily.production.automaticModelChangeAllowed, false);
assert.match(renderProductionReportMarkdown(reports.daily), /20% ML \/ 80% Poisson/);

console.log("Production Daily and Weekly Reports V3.2 tests passed.");
