/**
 * Walk-forward evaluation with chained bankroll (R1ch1k).
 * Boundary-window bets are excluded from scoring.
 */

import { calculateBacktestMetrics } from "@/modules/bankroll-backtest/metrics";
import { runBankrollSimulation } from "@/modules/bankroll-backtest/simulate";
import type { StrategyConfig } from "@/modules/bankroll-backtest/strategies";
import type {
  BacktestBetInput,
  BacktestMetrics,
  SettledBacktestBet,
} from "@/modules/bankroll-backtest/types";

export type WalkForwardFold = {
  foldIndex: number;
  trainStart: Date;
  trainEnd: Date;
  testStart: Date;
  testEnd: Date;
  trainCount: number;
  testCount: number;
  boundaryExcluded: number;
  metrics: BacktestMetrics;
  settled: SettledBacktestBet[];
  bankrollStart: number;
  bankrollEnd: number;
};

export type WalkForwardResult = {
  folds: WalkForwardFold[];
  chainedMetrics: BacktestMetrics | null;
  boundaryExcludedTotal: number;
  finalBankroll: number;
  initialBankroll: number;
};

function byDate(a: BacktestBetInput, b: BacktestBetInput): number {
  return a.date.getTime() - b.date.getTime();
}

/**
 * Expanding-window walk-forward.
 * trainRatio of each fold's available history → train; next testWindow days → test.
 * Bets within `boundaryDays` of the train/test cut are excluded from metrics.
 */
export function runWalkForward(
  bets: readonly BacktestBetInput[],
  options?: {
    initialBankroll?: number;
    strategy?: Partial<StrategyConfig>;
    /** Minimum train size before first test. */
    minTrain?: number;
    /** Test window size in bets (not calendar). */
    testSize?: number;
    /** Step size between folds (bets). */
    step?: number;
    /** Exclude this many bets on each side of the cut. */
    boundarySize?: number;
    /** Carry bankroll across folds (default true). */
    chainBankroll?: boolean;
  },
): WalkForwardResult {
  const sorted = [...bets].sort(byDate);
  const initialBankroll = options?.initialBankroll ?? 1000;
  const minTrain = options?.minTrain ?? Math.max(20, Math.floor(sorted.length * 0.4));
  const testSize = options?.testSize ?? Math.max(10, Math.floor(sorted.length * 0.15));
  const step = options?.step ?? testSize;
  const boundarySize = Math.max(0, options?.boundarySize ?? 0);
  const chainBankroll = options?.chainBankroll !== false;

  const folds: WalkForwardFold[] = [];
  const chainedSettled: SettledBacktestBet[] = [];
  let bankroll = initialBankroll;
  let boundaryExcludedTotal = 0;

  for (
    let trainEnd = minTrain;
    trainEnd + testSize <= sorted.length;
    trainEnd += step
  ) {
    const testStartIdx = trainEnd;
    const testEndIdx = Math.min(sorted.length, trainEnd + testSize);
    const rawTest = sorted.slice(testStartIdx, testEndIdx);
    const excludeHead = Math.min(boundarySize, Math.floor(rawTest.length / 2));
    const excludeTail = Math.min(
      boundarySize,
      Math.max(0, rawTest.length - excludeHead - 1),
    );
    const testBets = rawTest.slice(excludeHead, rawTest.length - excludeTail);
    const boundaryExcluded = rawTest.length - testBets.length;
    boundaryExcludedTotal += boundaryExcluded;

    if (testBets.length === 0) continue;

    const train = sorted.slice(0, trainEnd);
    const sim = runBankrollSimulation(testBets, {
      initialBankroll: bankroll,
      strategy: options?.strategy,
    });
    const metrics = calculateBacktestMetrics(sim.settled, sim.initialBankroll);
    folds.push({
      foldIndex: folds.length,
      trainStart: train[0]!.date,
      trainEnd: train[train.length - 1]!.date,
      testStart: testBets[0]!.date,
      testEnd: testBets[testBets.length - 1]!.date,
      trainCount: train.length,
      testCount: testBets.length,
      boundaryExcluded,
      metrics,
      settled: sim.settled,
      bankrollStart: sim.initialBankroll,
      bankrollEnd: sim.finalBankroll,
    });
    chainedSettled.push(...sim.settled);
    if (chainBankroll) {
      bankroll = sim.finalBankroll;
    }
  }

  const chainedMetrics =
    chainedSettled.length > 0
      ? calculateBacktestMetrics(chainedSettled, initialBankroll)
      : null;

  return {
    folds,
    chainedMetrics,
    boundaryExcludedTotal,
    finalBankroll: bankroll,
    initialBankroll,
  };
}
