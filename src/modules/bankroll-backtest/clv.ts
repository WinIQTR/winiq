import type { SettledBacktestBet } from "@/modules/bankroll-backtest/types";
import {
  computeLabeledClv,
  summarizeLabeledClv,
} from "@/modules/track-record/clv-labeled";

export type ClvMetrics = {
  /** Raw CLV %: mean(taken/close - 1)*100 (margin included). */
  clvPct: number | null;
  /** De-vig / fair-p CLV % (labeled separately from raw). */
  clvNoVigPct: number | null;
  beatClosingPct: number | null;
  samples: number;
};

/**
 * Closing Line Value with explicit raw vs de-vig labels (TipsAudit-style).
 * Raw: takenOdds / closingOdds - 1. De-vig: fair-p EV delta vs close.
 */
export function computeClvMetrics(
  placed: readonly SettledBacktestBet[],
): ClvMetrics {
  const labeled = placed
    .filter((row) => !row.skipped && row.stake > 0)
    .map((row) =>
      computeLabeledClv({
        oddsTaken: row.odds,
        closingOdds: row.closingOdds,
        fairProbability: row.modelProbability,
      }),
    );
  const summary = summarizeLabeledClv(labeled);
  return {
    clvPct: summary.meanRawClvPct,
    clvNoVigPct: summary.meanDeVigClvPct,
    beatClosingPct: summary.beatClosingPct,
    samples: summary.samples,
  };
}
