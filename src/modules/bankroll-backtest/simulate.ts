import {
  adjustSimultaneousStakes,
  applyRiskLimits,
  createBetHistory,
  DEFAULT_STRATEGY_CONFIG,
  expectedValue,
  recordSettlement,
  selectBet,
  sizeStake,
  type StrategyConfig,
} from "@/modules/bankroll-backtest/strategies";
import type {
  BacktestBetInput,
  BankrollPathPoint,
  SettledBacktestBet,
} from "@/modules/bankroll-backtest/types";

const ISTANBUL = "Europe/Istanbul";

export function istanbulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ISTANBUL,
  }).format(value);
}

export type SimulationResult = {
  initialBankroll: number;
  settled: SettledBacktestBet[];
  path: BankrollPathPoint[];
  finalBankroll: number;
};

function settleProfit(
  stake: number,
  odds: number,
  result: "WON" | "LOST" | "VOID",
): number {
  if (stake <= 0 || result === "VOID") return 0;
  if (result === "WON") return stake * (odds - 1);
  return -stake;
}

/**
 * Sequential bankroll simulation with optional same-slot simultaneous sizing.
 */
export function runBankrollSimulation(
  bets: readonly BacktestBetInput[],
  options?: {
    initialBankroll?: number;
    strategy?: Partial<StrategyConfig>;
    oddsHaircut?: number;
  },
): SimulationResult {
  const initialBankroll = options?.initialBankroll ?? 1000;
  const config: StrategyConfig = {
    ...DEFAULT_STRATEGY_CONFIG,
    ...options?.strategy,
    risk: {
      ...DEFAULT_STRATEGY_CONFIG.risk,
      ...(options?.strategy?.risk ?? {}),
    },
  };
  const haircut = Math.min(0.99, Math.max(0, options?.oddsHaircut ?? 0));
  const history = createBetHistory(initialBankroll);

  const prepared = [...bets]
    .map((bet) => ({
      ...bet,
      odds: Math.max(1.01, bet.odds * (1 - haircut)),
      slotKey: bet.slotKey ?? istanbulDateKey(bet.date),
    }))
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
    );

  const slots = new Map<string, typeof prepared>();
  for (const bet of prepared) {
    const key = `${istanbulDateKey(bet.date)}|${bet.slotKey}`;
    const group = slots.get(key) ?? [];
    group.push(bet);
    slots.set(key, group);
  }

  let bankroll = initialBankroll;
  const settled: SettledBacktestBet[] = [];
  const path: BankrollPathPoint[] = [
    {
      index: 0,
      date: prepared[0]?.date ?? new Date(0),
      bankroll,
      drawdownPct: 0,
      stake: 0,
      profit: 0,
    },
  ];
  let peak = bankroll;

  for (const [, group] of slots) {
    const dayKey = istanbulDateKey(group[0]!.date);
    const opening = bankroll;
    const decisions: Array<{
      bet: (typeof prepared)[number];
      stake: number;
      skipped: boolean;
      reason: string | null;
      ev: number;
    }> = [];

    for (const bet of group) {
      const selection = selectBet(bet, config);
      if (!selection.accept) {
        decisions.push({
          bet,
          stake: 0,
          skipped: true,
          reason: selection.reason,
          ev: selection.ev,
        });
        continue;
      }
      const rawStake = sizeStake(bet, opening, config, selection.ev);
      const limited = applyRiskLimits(rawStake, opening, dayKey, history, config);
      decisions.push({
        bet,
        stake: limited.stake,
        skipped: limited.stake <= 0,
        reason: limited.reason,
        ev: selection.ev,
      });
    }

    const adjusted = adjustSimultaneousStakes(
      decisions.map((row) => row.stake),
      opening,
      config.simultaneousMaxTotalFraction,
    );

    for (let i = 0; i < decisions.length; i += 1) {
      const decision = decisions[i]!;
      const stake = adjusted[i] ?? 0;
      const bankrollBefore = bankroll;
      const profit = decision.skipped
        ? 0
        : settleProfit(stake, decision.bet.odds, decision.bet.result);
      if (!decision.skipped && stake > 0) {
        bankroll += profit;
        recordSettlement(history, dayKey, stake, decision.bet.result);
      }
      peak = Math.max(peak, bankroll);
      const drawdownPct = peak > 0 ? ((peak - bankroll) / peak) * 100 : 0;
      const expectedProfit =
        stake > 0
          ? stake *
            expectedValue(
              Math.min(1, Math.max(0, decision.bet.modelProbability)),
              decision.bet.odds,
            )
          : 0;

      settled.push({
        ...decision.bet,
        stake,
        profit,
        bankrollBefore,
        bankrollAfter: bankroll,
        skipped: decision.skipped || stake <= 0,
        skipReason: decision.reason,
        expectedProfit,
      });
      path.push({
        index: path.length,
        date: decision.bet.date,
        bankroll,
        drawdownPct,
        stake,
        profit,
      });
    }
  }

  return {
    initialBankroll,
    settled,
    path,
    finalBankroll: bankroll,
  };
}
