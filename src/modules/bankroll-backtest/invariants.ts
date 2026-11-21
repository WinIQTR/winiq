/**
 * Bankroll accounting invariants (R1ch1k).
 */

import type {
  BankrollPathPoint,
  SettledBacktestBet,
} from "@/modules/bankroll-backtest/types";

export type InvariantViolation = {
  code: string;
  message: string;
  index?: number;
};

export function checkBankrollInvariants(
  settled: readonly SettledBacktestBet[],
  path: readonly BankrollPathPoint[],
  initialBankroll: number,
  options?: { tolerance?: number },
): InvariantViolation[] {
  const tol = options?.tolerance ?? 1e-6;
  const violations: InvariantViolation[] = [];

  if (!(initialBankroll > 0) || !Number.isFinite(initialBankroll)) {
    violations.push({
      code: "initial_bankroll",
      message: "initialBankroll must be a finite positive number",
    });
  }

  let expected = initialBankroll;
  for (let i = 0; i < settled.length; i += 1) {
    const row = settled[i]!;
    if (Math.abs(row.bankrollBefore - expected) > tol) {
      violations.push({
        code: "bankroll_before",
        message: `settled[${i}].bankrollBefore drift`,
        index: i,
      });
    }
    const next = row.skipped ? row.bankrollBefore : row.bankrollBefore + row.profit;
    if (Math.abs(row.bankrollAfter - next) > tol) {
      violations.push({
        code: "bankroll_after",
        message: `settled[${i}].bankrollAfter != before+profit`,
        index: i,
      });
    }
    if (!row.skipped && row.stake > 0 && row.bankrollBefore + 1e-9 < row.stake) {
      violations.push({
        code: "stake_exceeds_bankroll",
        message: `settled[${i}] stake exceeds bankrollBefore`,
        index: i,
      });
    }
    expected = row.bankrollAfter;
  }

  if (path.length > 0) {
    let peak = initialBankroll;
    for (let i = 0; i < path.length; i += 1) {
      const point = path[i]!;
      peak = Math.max(peak, point.bankroll);
      const expectedDd =
        peak > 0 ? Math.max(0, ((peak - point.bankroll) / peak) * 100) : 0;
      if (Math.abs(point.drawdownPct - expectedDd) > 0.05) {
        violations.push({
          code: "drawdown",
          message: `path[${i}].drawdownPct inconsistent`,
          index: i,
        });
      }
      if (
        point.cumulativeTurnover !== undefined &&
        i > 0 &&
        point.cumulativeTurnover + tol < (path[i - 1]!.cumulativeTurnover ?? 0)
      ) {
        violations.push({
          code: "turnover_non_decreasing",
          message: `path[${i}].cumulativeTurnover decreased`,
          index: i,
        });
      }
    }
  }

  return violations;
}
