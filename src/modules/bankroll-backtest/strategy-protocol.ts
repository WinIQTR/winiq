/**
 * Minimal strategy protocol: fit → onOdds → onSettled (R1ch1k).
 */

import type { BacktestBetInput } from "@/modules/bankroll-backtest/types";
import {
  DEFAULT_STRATEGY_CONFIG,
  expectedValue,
  selectBet,
  sizeStake,
  type StrategyConfig,
} from "@/modules/bankroll-backtest/strategies";

export type OddsDecision =
  | { action: "skip"; reason: string }
  | { action: "bet"; stake: number; expectedProfit: number };

export type StrategyProtocol = {
  fit(train: readonly BacktestBetInput[]): void;
  onOdds(bet: BacktestBetInput, bankroll: number): OddsDecision;
  onSettled(bet: BacktestBetInput, profit: number, bankrollAfter: number): void;
};

export type FixedEvStrategyState = {
  config: StrategyConfig;
  fittedMinEv: number | null;
};

/**
 * Flat/Kelly strategy with optional train-set min-EV fit (median positive EV).
 */
export function createFixedEvStrategy(
  partial?: Partial<StrategyConfig>,
): StrategyProtocol & { state: FixedEvStrategyState } {
  const state: FixedEvStrategyState = {
    config: { ...DEFAULT_STRATEGY_CONFIG, ...partial },
    fittedMinEv: null,
  };

  return {
    state,
    fit(train) {
      const positive = train
        .map((bet) => expectedValue(bet.modelProbability, bet.odds))
        .filter((ev) => Number.isFinite(ev) && ev > 0)
        .sort((a, b) => a - b);
      if (positive.length === 0) {
        state.fittedMinEv = state.config.minEv;
        return;
      }
      const mid = positive[Math.floor(positive.length / 2)]!;
      state.fittedMinEv = Math.max(state.config.minEv, mid * 0.5);
      state.config = { ...state.config, minEv: state.fittedMinEv };
    },
    onOdds(bet, bankroll) {
      const selection = selectBet(bet, state.config);
      if (!selection.accept) {
        return { action: "skip", reason: selection.reason ?? "rejected" };
      }
      const stake = sizeStake(bet, bankroll, state.config, selection.ev);
      if (stake <= 0) {
        return { action: "skip", reason: "zero_stake" };
      }
      return {
        action: "bet",
        stake,
        expectedProfit: selection.ev * stake,
      };
    },
    onSettled() {
      // Stateless fixed-EV — hook reserved for adaptive strategies.
    },
  };
}
