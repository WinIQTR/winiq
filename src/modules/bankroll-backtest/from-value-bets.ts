import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";
import type { CouponPerformanceRow } from "@/lib/smart-coupon-performance";
import type { BacktestBetInput } from "@/modules/bankroll-backtest/types";

/**
 * Map settled Value Bet rows into backtest inputs.
 * Closing proxy: fairOdds when available (no-vig reference), else medianOdds.
 */
export function valueBetsToBacktestInputs(
  rows: readonly ValueBetDashboardRow[],
): BacktestBetInput[] {
  return rows
    .filter((row) => row.result === "WON" || row.result === "LOST" || row.result === "VOID")
    .map((row) => {
      const modelProbability = Math.min(
        1,
        Math.max(0, row.modelProbability / 100),
      );
      const closing =
        row.fairOdds != null && row.fairOdds > 1
          ? row.fairOdds
          : row.medianOdds > 1
            ? row.medianOdds
            : null;
      return {
        id: String(row.id ?? `${row.matchId}:${row.marketKey}:${row.selection}`),
        date: row.kickoffAt,
        slotKey: String(row.matchId),
        odds: row.bestOdds,
        modelProbability,
        closingOdds: closing,
        result: row.result as "WON" | "LOST" | "VOID",
        edge: row.expectedValue / 100,
        marketKey: row.marketKey,
        leagueKey: String(row.leagueApiId),
      };
    });
}

export function couponsToBacktestInputs(
  rows: readonly CouponPerformanceRow[],
): BacktestBetInput[] {
  return rows
    .filter((row) => row.result === "WON" || row.result === "LOST" || row.result === "VOID")
    .map((row) => ({
      id: String(row.id),
      date: row.publishedAt,
      slotKey: `${row.window}:${row.band}:${row.id}`,
      odds: row.totalOdds,
      modelProbability: Math.min(
        1,
        Math.max(0, row.combinedModelProbability / 100),
      ),
      closingOdds: null,
      result: row.result as "WON" | "LOST" | "VOID",
      edge: undefined,
      marketKey: row.band,
      leagueKey: row.window,
    }));
}
