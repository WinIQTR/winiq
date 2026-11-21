import { calculateBacktestMetrics } from "@/modules/bankroll-backtest/metrics";
import { runBankrollSimulation } from "@/modules/bankroll-backtest/simulate";
import type { StrategyConfig } from "@/modules/bankroll-backtest/strategies";
import type {
  BacktestBetInput,
  BacktestMetrics,
} from "@/modules/bankroll-backtest/types";

export type HoldoutSplit<T> = {
  train: T[];
  holdout: T[];
};

/** Chronological holdout split (last `holdoutFraction` by time). */
export function chronologicalHoldoutSplit<T extends { date: Date }>(
  rows: readonly T[],
  holdoutFraction = 0.3,
): HoldoutSplit<T> {
  const ordered = [...rows].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  if (ordered.length === 0) return { train: [], holdout: [] };
  const cut = Math.max(
    1,
    Math.min(
      ordered.length - 1,
      Math.floor(ordered.length * (1 - holdoutFraction)),
    ),
  );
  return {
    train: ordered.slice(0, cut),
    holdout: ordered.slice(cut),
  };
}

export type EvaluateOptions = {
  initialBankroll?: number;
  strategy?: Partial<StrategyConfig>;
  minBets?: number;
  metric?: keyof BacktestMetrics;
};

/**
 * Fast evaluate for threshold search — returns one metric (default Yield).
 */
export function evaluateStrategy(
  bets: readonly BacktestBetInput[],
  options?: EvaluateOptions,
): {
  value: number | null;
  metrics: BacktestMetrics;
  bets: number;
} {
  const simulation = runBankrollSimulation(bets, {
    initialBankroll: options?.initialBankroll,
    strategy: options?.strategy,
  });
  const metrics = calculateBacktestMetrics(
    simulation.settled,
    simulation.initialBankroll,
  );
  const minBets = options?.minBets ?? 1;
  if (metrics.bets < minBets) {
    return { value: null, metrics, bets: metrics.bets };
  }
  const key = options?.metric ?? "yieldPct";
  const raw = metrics[key];
  const value = typeof raw === "number" ? raw : null;
  return { value, metrics, bets: metrics.bets };
}

/** Grid-search minEv on train, score on holdout. */
export function tuneMinEvOnHoldout(
  bets: readonly BacktestBetInput[],
  candidates: readonly number[] = [0.02, 0.03, 0.04, 0.05, 0.08],
  options?: { initialBankroll?: number; holdoutFraction?: number },
): {
  bestMinEv: number;
  trainYield: number | null;
  holdoutYield: number | null;
  holdoutMetrics: BacktestMetrics;
} {
  const { train, holdout } = chronologicalHoldoutSplit(
    bets,
    options?.holdoutFraction ?? 0.3,
  );
  let bestMinEv = candidates[0] ?? 0.03;
  let bestTrain = Number.NEGATIVE_INFINITY;
  for (const minEv of candidates) {
    const result = evaluateStrategy(train, {
      initialBankroll: options?.initialBankroll,
      strategy: { minEv },
      metric: "yieldPct",
      minBets: 5,
    });
    if (result.value != null && result.value > bestTrain) {
      bestTrain = result.value;
      bestMinEv = minEv;
    }
  }
  const holdoutEval = evaluateStrategy(holdout, {
    initialBankroll: options?.initialBankroll,
    strategy: { minEv: bestMinEv },
    metric: "yieldPct",
  });
  return {
    bestMinEv,
    trainYield: Number.isFinite(bestTrain) ? bestTrain : null,
    holdoutYield: holdoutEval.value,
    holdoutMetrics: holdoutEval.metrics,
  };
}
