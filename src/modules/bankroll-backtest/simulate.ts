import {
  NoCommission,
  settleWithCommission,
  type CommissionModel,
} from "@/modules/bankroll-backtest/commission";
import { StrategyLedger } from "@/modules/bankroll-backtest/rejection-log";
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
  ledger: StrategyLedger;
};

function mapSkipReason(
  reason: string | null,
):
  | "below_min_ev"
  | "risk_limit"
  | "insufficient_bankroll"
  | "invalid_odds"
  | "invalid_probability"
  | "simultaneous_cap"
  | "custom" {
  if (!reason) return "custom";
  if (reason.includes("EV")) return "below_min_ev";
  if (reason.includes("ODDS")) return "invalid_odds";
  if (reason.includes("PROBABILITY")) return "invalid_probability";
  if (
    reason.includes("STOP") ||
    reason.includes("PAUSE") ||
    reason.includes("DAILY") ||
    reason.includes("STAKE")
  ) {
    return "risk_limit";
  }
  if (reason.includes("SIMULTANEOUS")) return "simultaneous_cap";
  return "custom";
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
    commission?: CommissionModel;
    ledger?: StrategyLedger;
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
  const commission = options?.commission ?? NoCommission;
  const ledger = options?.ledger ?? new StrategyLedger();
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
  let cumulativeTurnover = 0;
  const settled: SettledBacktestBet[] = [];
  const path: BankrollPathPoint[] = [
    {
      index: 0,
      date: prepared[0]?.date ?? new Date(0),
      bankroll,
      drawdownPct: 0,
      stake: 0,
      profit: 0,
      cumulativeTurnover: 0,
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
        ledger.reject(bet.id, mapSkipReason(selection.reason), selection.reason);
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
      if (limited.stake <= 0) {
        ledger.reject(bet.id, mapSkipReason(limited.reason), limited.reason);
      }
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
      const skipped = decision.skipped || stake <= 0;
      if (
        !decision.skipped &&
        stake > 0 &&
        adjusted[i]! + 1e-9 < decision.stake &&
        decision.stake > 0
      ) {
        ledger.reject(
          decision.bet.id,
          "simultaneous_cap",
          "simultaneous stake reduced",
        );
      }
      const profit = skipped
        ? 0
        : settleWithCommission(
            stake,
            decision.bet.odds,
            decision.bet.result,
            commission,
          );
      if (!skipped && stake > 0) {
        bankroll += profit;
        cumulativeTurnover += stake;
        recordSettlement(history, dayKey, stake, decision.bet.result);
        ledger.commit({
          betId: decision.bet.id,
          stake,
          odds: decision.bet.odds,
          expectedProfit:
            stake *
            expectedValue(
              Math.min(1, Math.max(0, decision.bet.modelProbability)),
              decision.bet.odds,
            ),
        });
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
        skipped,
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
        cumulativeTurnover,
      });
    }
  }

  return {
    initialBankroll,
    settled,
    path,
    finalBankroll: bankroll,
    ledger,
  };
}
