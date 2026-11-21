/**
 * Lookahead / regime-reversal smoke test (R1ch1k).
 * Flips win/loss labels — a +EV strategy should typically worsen.
 */

import { calculateBacktestMetrics } from "@/modules/bankroll-backtest/metrics";
import { runBankrollSimulation } from "@/modules/bankroll-backtest/simulate";
import type { StrategyConfig } from "@/modules/bankroll-backtest/strategies";
import type {
  BacktestBetInput,
  BacktestMetrics,
} from "@/modules/bankroll-backtest/types";

export type RegimeReversalResult = {
  original: BacktestMetrics;
  reversed: BacktestMetrics;
  yieldDelta: number | null;
  /** True when reversed yield is worse (lower) than original. */
  worsened: boolean;
};

function flipResults(
  bets: readonly BacktestBetInput[],
): BacktestBetInput[] {
  return bets.map((bet) => {
    if (bet.result === "VOID") return { ...bet };
    return {
      ...bet,
      result: bet.result === "WON" ? "LOST" : "WON",
    };
  });
}

export function runRegimeReversalTest(
  bets: readonly BacktestBetInput[],
  options?: {
    initialBankroll?: number;
    strategy?: Partial<StrategyConfig>;
  },
): RegimeReversalResult {
  const initialBankroll = options?.initialBankroll ?? 1000;
  const originalSim = runBankrollSimulation(bets, {
    initialBankroll,
    strategy: options?.strategy,
  });
  const reversedSim = runBankrollSimulation(flipResults(bets), {
    initialBankroll,
    strategy: options?.strategy,
  });
  const original = calculateBacktestMetrics(
    originalSim.settled,
    originalSim.initialBankroll,
  );
  const reversed = calculateBacktestMetrics(
    reversedSim.settled,
    reversedSim.initialBankroll,
  );
  const yieldDelta =
    original.yieldPct !== null && reversed.yieldPct !== null
      ? reversed.yieldPct - original.yieldPct
      : null;
  return {
    original,
    reversed,
    yieldDelta,
    worsened:
      yieldDelta !== null
        ? yieldDelta < 0
        : reversed.roiPct < original.roiPct,
  };
}
