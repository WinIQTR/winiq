import {
  buildEquityChartSeries,
  toSparklinePoints,
} from "@/modules/bankroll-backtest/equity-chart";
import { tuneMinEvOnHoldout } from "@/modules/bankroll-backtest/evaluate";
import { checkBankrollInvariants } from "@/modules/bankroll-backtest/invariants";
import { calculateBacktestMetrics } from "@/modules/bankroll-backtest/metrics";
import { runRegimeReversalTest } from "@/modules/bankroll-backtest/regime-reversal";
import type { StrategyLedger } from "@/modules/bankroll-backtest/rejection-log";
import { runBankrollSimulation } from "@/modules/bankroll-backtest/simulate";
import { runOddsStressTest } from "@/modules/bankroll-backtest/stress";
import type { StrategyConfig } from "@/modules/bankroll-backtest/strategies";
import type {
  BacktestBetInput,
  BacktestMetrics,
  StressTestRow,
} from "@/modules/bankroll-backtest/types";
import { runWalkForward } from "@/modules/bankroll-backtest/walk-forward";
import { computeYieldBootstrapCI, type YieldCI } from "@/modules/bankroll-backtest/yield-ci";
import type { CommissionModel } from "@/modules/bankroll-backtest/commission";

export type BankrollBacktestReport = {
  metrics: BacktestMetrics;
  stress: StressTestRow[];
  equity: ReturnType<typeof buildEquityChartSeries>;
  bankrollSparkline: string;
  drawdownSparkline: string;
  turnoverSparkline: string;
  tuning: ReturnType<typeof tuneMinEvOnHoldout> | null;
  yieldCI: YieldCI | null;
  walkForward: ReturnType<typeof runWalkForward> | null;
  regimeReversal: ReturnType<typeof runRegimeReversalTest> | null;
  ledgerSummary: ReturnType<StrategyLedger["summary"]>;
  invariantViolations: number;
  initialBankroll: number;
  finalBankroll: number;
};

export function buildBankrollBacktestReport(
  bets: readonly BacktestBetInput[],
  options?: {
    initialBankroll?: number;
    strategy?: Partial<StrategyConfig>;
    includeTuning?: boolean;
    includeWalkForward?: boolean;
    includeRegimeReversal?: boolean;
    commission?: CommissionModel;
    yieldCiSeed?: number;
  },
): BankrollBacktestReport {
  const initialBankroll = options?.initialBankroll ?? 1000;
  const simulation = runBankrollSimulation(bets, {
    initialBankroll,
    strategy: options?.strategy,
    commission: options?.commission,
  });
  const metrics = calculateBacktestMetrics(
    simulation.settled,
    simulation.initialBankroll,
  );
  const stress = runOddsStressTest(bets, {
    initialBankroll,
    strategy: options?.strategy,
  });
  const equity = buildEquityChartSeries(simulation.path);
  const tuning =
    options?.includeTuning === false || bets.length < 20
      ? null
      : tuneMinEvOnHoldout(bets, undefined, { initialBankroll });
  const yieldCI = computeYieldBootstrapCI(simulation.settled, {
    seed: options?.yieldCiSeed ?? 7,
    nResamples: Math.min(2000, Math.max(200, bets.length * 5)),
  });
  const walkForward =
    options?.includeWalkForward === false || bets.length < 40
      ? null
      : runWalkForward(bets, {
          initialBankroll,
          strategy: options?.strategy,
          boundarySize: 1,
        });
  const regimeReversal =
    options?.includeRegimeReversal === false || bets.length < 10
      ? null
      : runRegimeReversalTest(bets, {
          initialBankroll,
          strategy: options?.strategy,
        });
  const invariantViolations = checkBankrollInvariants(
    simulation.settled,
    simulation.path,
    simulation.initialBankroll,
  ).length;

  return {
    metrics,
    stress,
    equity,
    bankrollSparkline: toSparklinePoints(equity.bankroll),
    drawdownSparkline: toSparklinePoints(equity.drawdownPct.map((v) => -v)),
    turnoverSparkline: toSparklinePoints(equity.cumulativeTurnover),
    tuning,
    yieldCI,
    walkForward,
    regimeReversal,
    ledgerSummary: simulation.ledger.summary(),
    invariantViolations,
    initialBankroll: simulation.initialBankroll,
    finalBankroll: simulation.finalBankroll,
  };
}
