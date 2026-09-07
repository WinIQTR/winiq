import assert from "node:assert/strict";

import {
  settleMarketSelection,
  type SettlementResult,
} from "../src/lib/market-settlement";

function expectSettlement(
  marketKey: string,
  homeScore: number,
  awayScore: number,
  expected: SettlementResult,
): void {
  const settlement = settleMarketSelection({
    marketKey,
    homeScore,
    awayScore,
  });

  assert.equal(
    settlement.result,
    expected,
    `${marketKey} at ${homeScore}-${awayScore}`,
  );
}

expectSettlement("match_result_home", 2, 1, "WON");
expectSettlement("match_result_draw", 2, 1, "LOST");
expectSettlement("double_chance_x2", 1, 1, "WON");
expectSettlement("dnb_home", 1, 1, "VOID");
expectSettlement("total_goals_over_2.5", 2, 1, "WON");
expectSettlement("total_goals_under_2.5", 2, 1, "LOST");
expectSettlement("home_team_goals_over_1.5", 2, 0, "WON");
expectSettlement("away_team_goals_under_1.5", 2, 0, "WON");
expectSettlement("btts_yes", 2, 1, "WON");
expectSettlement("home_clean_sheet_yes", 2, 0, "WON");
expectSettlement("away_win_to_nil_yes", 0, 2, "WON");
expectSettlement("total_goals_odd", 2, 1, "WON");
expectSettlement("btts_yes_over_2.5_yes", 2, 1, "WON");

const unsupported = settleMarketSelection({
  marketKey: "future_market_key",
  homeScore: 1,
  awayScore: 0,
});

assert.deepEqual(unsupported, {
  result: "VOID",
  supported: false,
});

console.log("Prediction archive settlement tests passed.");
