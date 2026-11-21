import { calculateBacktestMetrics } from "@/modules/bankroll-backtest/metrics";
import { runBankrollSimulation } from "@/modules/bankroll-backtest/simulate";
import type { StrategyConfig } from "@/modules/bankroll-backtest/strategies";
import type {
  BacktestBetInput,
  StressTestRow,
} from "@/modules/bankroll-backtest/types";

/**
 * Re-run simulation with worse odds (1/2/3% haircuts) to test edge robustness.
 */
export function runOddsStressTest(
  bets: readonly BacktestBetInput[],
  options?: {
    initialBankroll?: number;
    strategy?: Partial<StrategyConfig>;
    haircuts?: readonly number[];
  },
): StressTestRow[] {
  const haircuts = options?.haircuts ?? [0, 0.01, 0.02, 0.03];
  return haircuts.map((haircut) => {
    const simulation = runBankrollSimulation(bets, {
      initialBankroll: options?.initialBankroll,
      strategy: options?.strategy,
      oddsHaircut: haircut,
    });
    return {
      haircut,
      metrics: calculateBacktestMetrics(
        simulation.settled,
        simulation.initialBankroll,
      ),
    };
  });
}
