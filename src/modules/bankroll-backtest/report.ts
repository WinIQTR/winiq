import {
  buildEquityChartSeries,
  toSparklinePoints,
} from "@/modules/bankroll-backtest/equity-chart";
import { tuneMinEvOnHoldout } from "@/modules/bankroll-backtest/evaluate";
import { calculateBacktestMetrics } from "@/modules/bankroll-backtest/metrics";
import { runBankrollSimulation } from "@/modules/bankroll-backtest/simulate";
import { runOddsStressTest } from "@/modules/bankroll-backtest/stress";
import type { StrategyConfig } from "@/modules/bankroll-backtest/strategies";
import type {
  BacktestBetInput,
  BacktestMetrics,
  StressTestRow,
} from "@/modules/bankroll-backtest/types";

export type BankrollBacktestReport = {
  metrics: BacktestMetrics;
  stress: StressTestRow[];
  equity: ReturnType<typeof buildEquityChartSeries>;
  bankrollSparkline: string;
  drawdownSparkline: string;
  tuning: ReturnType<typeof tuneMinEvOnHoldout> | null;
  initialBankroll: number;
  finalBankroll: number;
};

export function buildBankrollBacktestReport(
  bets: readonly BacktestBetInput[],
  options?: {
    initialBankroll?: number;
    strategy?: Partial<StrategyConfig>;
    includeTuning?: boolean;
  },
): BankrollBacktestReport {
  const initialBankroll = options?.initialBankroll ?? 1000;
  const simulation = runBankrollSimulation(bets, {
    initialBankroll,
    strategy: options?.strategy,
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

  return {
    metrics,
    stress,
    equity,
    bankrollSparkline: toSparklinePoints(equity.bankroll),
    drawdownSparkline: toSparklinePoints(equity.drawdownPct.map((v) => -v)),
    tuning,
    initialBankroll: simulation.initialBankroll,
    finalBankroll: simulation.finalBankroll,
  };
}
