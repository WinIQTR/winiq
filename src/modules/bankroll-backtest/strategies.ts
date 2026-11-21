/**
 * Strategy toolkit (BacktestBuddy MIT): selector + sizer + risk limits.
 */

import type { BacktestBetInput } from "@/modules/bankroll-backtest/types";

export type StakeDecision = {
  stake: number;
  reason: string | null;
};

export type RiskLimitConfig = {
  maxStakeFraction: number;
  maxDailyFraction: number;
  pauseAfterLosses: number;
  stopAtDrawdown: number;
};

export const DEFAULT_RISK_LIMITS: RiskLimitConfig = {
  maxStakeFraction: 0.05,
  maxDailyFraction: 0.15,
  pauseAfterLosses: 5,
  stopAtDrawdown: 0.35,
};

export type SizerKind = "fixed_fraction" | "kelly" | "edge_proportional" | "unit";

export type StrategyConfig = {
  minEv: number;
  minProbability: number;
  minOdds: number;
  maxOdds: number;
  sizer: SizerKind;
  /** Fraction of bankroll for fixed_fraction / Kelly downscaling / edge mult. */
  sizeParam: number;
  maxBetFraction: number;
  risk: RiskLimitConfig;
  /** Cap total stake of one simultaneous slot as fraction of opening bankroll. */
  simultaneousMaxTotalFraction: number;
};

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  minEv: 0.03,
  minProbability: 0.45,
  minOdds: 1.4,
  maxOdds: 6,
  sizer: "kelly",
  sizeParam: 0.25,
  maxBetFraction: 0.05,
  risk: DEFAULT_RISK_LIMITS,
  simultaneousMaxTotalFraction: 0.3,
};

export type BetHistoryState = {
  losingStreak: number;
  peakBankroll: number;
  paused: boolean;
  stopReason: string | null;
  dailyStakeByKey: Map<string, number>;
};

export function createBetHistory(initialBankroll: number): BetHistoryState {
  return {
    losingStreak: 0,
    peakBankroll: initialBankroll,
    paused: false,
    stopReason: null,
    dailyStakeByKey: new Map(),
  };
}

export function expectedValue(probability01: number, odds: number): number {
  return probability01 * odds - 1;
}

export function kellyFraction(probability01: number, odds: number): number {
  if (odds <= 1 || probability01 <= 0) return 0;
  const b = odds - 1;
  const q = 1 - probability01;
  return Math.max(0, (probability01 * b - q) / b);
}

/** Highest-EV selector with odds band + probability floor. */
export function selectBet(
  bet: BacktestBetInput,
  config: StrategyConfig,
): { accept: boolean; reason: string | null; ev: number } {
  const p = Math.min(1, Math.max(0, bet.modelProbability));
  const ev = expectedValue(p, bet.odds);
  if (bet.odds < config.minOdds || bet.odds > config.maxOdds) {
    return { accept: false, reason: "ODDS_OUT_OF_BAND", ev };
  }
  if (p < config.minProbability) {
    return { accept: false, reason: "PROBABILITY_TOO_LOW", ev };
  }
  if (ev < config.minEv) {
    return { accept: false, reason: "EV_TOO_LOW", ev };
  }
  return { accept: true, reason: null, ev };
}

export function sizeStake(
  bet: BacktestBetInput,
  bankroll: number,
  config: StrategyConfig,
  ev: number,
): number {
  const p = Math.min(1, Math.max(0, bet.modelProbability));
  let fraction = 0;
  if (config.sizer === "fixed_fraction") {
    fraction = config.sizeParam;
  } else if (config.sizer === "kelly") {
    fraction = kellyFraction(p, bet.odds) * config.sizeParam;
  } else if (config.sizer === "edge_proportional") {
    fraction = Math.max(0, ev) * config.sizeParam;
  } else {
    // unit: 1% of bankroll baseline
    fraction = 0.01;
  }
  fraction = Math.min(fraction, config.maxBetFraction, config.risk.maxStakeFraction);
  return Math.max(0, bankroll * fraction);
}

export function applyRiskLimits(
  stake: number,
  bankroll: number,
  dayKey: string,
  history: BetHistoryState,
  config: StrategyConfig,
): StakeDecision {
  if (history.paused) {
    return { stake: 0, reason: history.stopReason ?? "PAUSED" };
  }
  history.peakBankroll = Math.max(history.peakBankroll, bankroll);
  const drawdown =
    history.peakBankroll > 0
      ? (history.peakBankroll - bankroll) / history.peakBankroll
      : 0;
  if (drawdown >= config.risk.stopAtDrawdown) {
    history.paused = true;
    history.stopReason = "STOP_AT_DRAWDOWN";
    return { stake: 0, reason: "STOP_AT_DRAWDOWN" };
  }
  if (
    config.risk.pauseAfterLosses > 0 &&
    history.losingStreak >= config.risk.pauseAfterLosses
  ) {
    return { stake: 0, reason: "PAUSE_AFTER_LOSSES" };
  }
  const daily = history.dailyStakeByKey.get(dayKey) ?? 0;
  const remainingDaily = Math.max(
    0,
    bankroll * config.risk.maxDailyFraction - daily,
  );
  const capped = Math.min(stake, bankroll * config.risk.maxStakeFraction, remainingDaily);
  if (capped <= 0) {
    return { stake: 0, reason: "DAILY_OR_STAKE_CAP" };
  }
  return { stake: capped, reason: null };
}

/** Rescale stakes in one simultaneous slot so sum ≤ maxTotal × bankroll. */
export function adjustSimultaneousStakes(
  stakes: readonly number[],
  bankroll: number,
  maxTotalFraction: number,
): number[] {
  const total = stakes.reduce((sum, value) => sum + value, 0);
  const cap = bankroll * maxTotalFraction;
  if (total <= 0 || total <= cap) return [...stakes];
  const scale = cap / total;
  return stakes.map((value) => value * scale);
}

export function recordSettlement(
  history: BetHistoryState,
  dayKey: string,
  stake: number,
  result: "WON" | "LOST" | "VOID",
): void {
  history.dailyStakeByKey.set(
    dayKey,
    (history.dailyStakeByKey.get(dayKey) ?? 0) + stake,
  );
  if (result === "LOST") history.losingStreak += 1;
  else if (result === "WON") history.losingStreak = 0;
}
