import assert from "node:assert/strict";

import {
  buildValueBetPortfolio,
} from "@/lib/value-bet-portfolio";
import type {
  ValueBetDashboardRow,
} from "@/lib/value-bet-dashboard-snapshot";

function row(options: {
  id: number;
  matchId: number;
  marketKey: string;
  valueScore: number;
  expectedValue: number;
  marketEdge: number;
  stake: number;
  kickoffAt?: string;
}): ValueBetDashboardRow {
  const kickoffAt = new Date(
    options.kickoffAt ?? "2026-08-13T17:00:00.000Z",
  );

  return {
    id: options.id,
    matchId: options.matchId,
    leagueApiId: 1,
    leagueName: "Test League",
    kickoffAt,
    homeTeam: `Home ${options.matchId}`,
    awayTeam: `Away ${options.matchId}`,
    marketKey: options.marketKey,
    market: "Test Market",
    selection: "Test Selection",
    modelProbability: 60,
    fairOdds: 1.67,
    bestOdds: 2,
    medianOdds: 1.9,
    marketProbability: 50,
    marketEdge: options.marketEdge,
    expectedValue: options.expectedValue,
    valueScore: options.valueScore,
    recommendedStakePercentage: options.stake,
    bookmakerName: "Test Bookmaker",
    bookmakerCount: 5,
    valueLevel: "GOOD",
    sourceUpdatedAt: kickoffAt,
    capturedAt: kickoffAt,
    result: "PENDING",
    profitUnits: null,
    actualHomeScore: null,
    actualAwayScore: null,
    publishedAt: kickoffAt,
    settledAt: null,
  };
}

function main(): void {
  const portfolio = buildValueBetPortfolio([
    row({ id: 1, matchId: 10, marketKey: "a", valueScore: 90, expectedValue: 12, marketEdge: 7, stake: 2 }),
    row({ id: 2, matchId: 10, marketKey: "b", valueScore: 80, expectedValue: 15, marketEdge: 8, stake: 2 }),
    row({ id: 3, matchId: 20, marketKey: "c", valueScore: 85, expectedValue: 10, marketEdge: 6, stake: 2 }),
    row({ id: 4, matchId: 30, marketKey: "d", valueScore: 75, expectedValue: 9, marketEdge: 5, stake: 2 }),
    row({ id: 5, matchId: 40, marketKey: "e", valueScore: 65, expectedValue: 4, marketEdge: 3, stake: 2 }),
    row({ id: 6, matchId: 50, marketKey: "f", valueScore: 70, expectedValue: 8, marketEdge: 4, stake: 2 }),
  ]);

  assert.equal(portfolio.selections.length, 5);
  assert.equal(portfolio.alternatives.length, 1);
  assert.equal(portfolio.alternatives[0]?.row.marketKey, "b");
  assert.equal(portfolio.primarySelections.length, 4);
  assert.equal(portfolio.watchSelections.length, 1);
  assert.equal(portfolio.watchSelections[0]?.row.marketKey, "e");
  assert.equal(portfolio.watchSelections[0]?.portfolioStakePercentage, 0);
  assert.equal(portfolio.maximumDailyAllocatedRiskPercentage, 6);
  assert.equal(
    portfolio.primarySelections.reduce(
      (total, selection) => total + selection.portfolioStakePercentage,
      0,
    ),
    6,
  );

  const twoDays = buildValueBetPortfolio([
    row({ id: 7, matchId: 60, marketKey: "g", valueScore: 80, expectedValue: 8, marketEdge: 4, stake: 2 }),
    row({ id: 8, matchId: 70, marketKey: "h", valueScore: 80, expectedValue: 8, marketEdge: 4, stake: 2, kickoffAt: "2026-08-14T17:00:00.000Z" }),
  ]);
  assert.equal(twoDays.dailySummaries.length, 2);
  assert.equal(twoDays.dailySummaries[0]?.allocatedRiskPercentage, 2);
  assert.equal(twoDays.dailySummaries[1]?.allocatedRiskPercentage, 2);

  console.log("Value Bet Portfolio V2 tests passed.");
}

main();
