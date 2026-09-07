import assert from "node:assert/strict";

import { settleMarketSelection } from "@/lib/market-settlement";
import { normalizeApiMarket } from "@/modules/bookmaker-odds-engine/normalize-api-market";
import {
  evaluateOddsFreshness,
  resolveAllowedSourceOddsAgeMinutes,
} from "@/modules/value-bet-engine/odds-freshness";

function main(): void {
  const market = normalizeApiMarket({
    id: 1,
    name: "Match Winner",
    values: [
      { value: "Home", odd: "2.00" },
      { value: "Draw", odd: "3.20" },
      { value: "Away", odd: "4.00" },
    ],
  });

  assert.ok(market);
  assert.equal(market.marketFamily, "MATCH_RESULT");
  assert.deepEqual(
    market.selections.map((selection) => selection.selectionName),
    ["HOME", "DRAW", "AWAY"],
  );

  const normalizedTotal = market.selections.reduce(
    (total, selection) => total + (selection.normalizedProbability ?? 0),
    0,
  );
  assert.ok(Math.abs(normalizedTotal - 100) < 0.01);

  assert.equal(resolveAllowedSourceOddsAgeMinutes(90), 60);
  assert.equal(resolveAllowedSourceOddsAgeMinutes(300), 120);
  assert.equal(resolveAllowedSourceOddsAgeMinutes(1000), 360);

  const now = new Date("2026-08-13T12:00:00.000Z");
  const freshness = evaluateOddsFreshness({
    now,
    kickoffAt: new Date("2026-08-13T13:30:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-13T11:20:00.000Z"),
    capturedAt: new Date("2026-08-13T11:55:00.000Z"),
    maximumCaptureAgeMinutes: 60,
  });
  assert.equal(freshness.sourceIsFresh, true);
  assert.equal(freshness.captureIsFresh, true);

  assert.equal(
    settleMarketSelection({
      marketKey: "total_goals_over_2.5",
      homeScore: 2,
      awayScore: 1,
    }).result,
    "WON",
  );
  assert.equal(
    settleMarketSelection({
      marketKey: "dnb_home",
      homeScore: 1,
      awayScore: 1,
    }).result,
    "VOID",
  );

  console.log("Value Bet V2 pure tests passed.");
}

main();
