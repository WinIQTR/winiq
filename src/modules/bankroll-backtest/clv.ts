import type { SettledBacktestBet } from "@/modules/bankroll-backtest/types";

export type ClvMetrics = {
  clvPct: number | null;
  clvNoVigPct: number | null;
  beatClosingPct: number | null;
  samples: number;
};

/**
 * Closing Line Value: mean(takenOdds / closingOdds - 1).
 * clvNoVig uses modelProbability as fair p: expected return vs closing.
 */
export function computeClvMetrics(
  placed: readonly SettledBacktestBet[],
): ClvMetrics {
  const withClose = placed.filter(
    (row) =>
      row.closingOdds != null &&
      Number.isFinite(row.closingOdds) &&
      (row.closingOdds as number) > 1,
  );
  if (withClose.length === 0) {
    return {
      clvPct: null,
      clvNoVigPct: null,
      beatClosingPct: null,
      samples: 0,
    };
  }

  let clvSum = 0;
  let noVigSum = 0;
  let beat = 0;
  for (const row of withClose) {
    const closing = row.closingOdds as number;
    clvSum += row.odds / closing - 1;
    // Expected return if closing is the true price: p * closing - 1, vs taken EV
    const p = Math.min(1, Math.max(0, row.modelProbability));
    noVigSum += p * row.odds - 1 - (p * closing - 1);
    if (row.odds > closing) beat += 1;
  }

  return {
    clvPct: (clvSum / withClose.length) * 100,
    clvNoVigPct: (noVigSum / withClose.length) * 100,
    beatClosingPct: (beat / withClose.length) * 100,
    samples: withClose.length,
  };
}
