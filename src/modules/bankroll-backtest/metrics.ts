import type {
  BacktestMetrics,
  SettledBacktestBet,
} from "@/modules/bankroll-backtest/types";
import { computeClvMetrics } from "@/modules/bankroll-backtest/clv";

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function stdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((total, value) => total + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function downsideStdev(values: readonly number[]): number {
  const negatives = values.filter((value) => value < 0);
  if (negatives.length < 2) return stdev(negatives.length ? negatives : [0]);
  return stdev(negatives);
}

export function calculateBacktestMetrics(
  settled: readonly SettledBacktestBet[],
  initialBankroll: number,
): BacktestMetrics {
  const opportunities = settled.length;
  const placed = settled.filter((row) => !row.skipped && row.stake > 0);
  const decided = placed.filter(
    (row) => row.result === "WON" || row.result === "LOST",
  );
  const won = decided.filter((row) => row.result === "WON").length;
  const totalProfit = placed.reduce((total, row) => total + row.profit, 0);
  const totalStake = placed.reduce((total, row) => total + row.stake, 0);
  const expectedProfit = placed.reduce(
    (total, row) => total + row.expectedProfit,
    0,
  );
  const finalBankroll =
    settled.length > 0
      ? settled[settled.length - 1]!.bankrollAfter
      : initialBankroll;
  const peak = Math.max(
    initialBankroll,
    ...settled.map((row) => row.bankrollAfter),
  );
  const valley = Math.min(
    initialBankroll,
    ...settled.map((row) => row.bankrollAfter),
  );

  let maxDrawdownPct = 0;
  let maxDrawdownDurationBets = 0;
  let peakBankroll = initialBankroll;
  let duration = 0;
  for (const row of settled) {
    peakBankroll = Math.max(peakBankroll, row.bankrollAfter);
    const dd =
      peakBankroll > 0
        ? ((peakBankroll - row.bankrollAfter) / peakBankroll) * 100
        : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    if (row.bankrollAfter < peakBankroll - 1e-9) {
      duration += 1;
      maxDrawdownDurationBets = Math.max(maxDrawdownDurationBets, duration);
    } else {
      duration = 0;
    }
  }

  const roiPct =
    initialBankroll > 0
      ? ((finalBankroll - initialBankroll) / initialBankroll) * 100
      : 0;
  const yieldPct =
    totalStake > 0 ? (totalProfit / totalStake) * 100 : null;
  const expectedYieldPct =
    totalStake > 0 ? (expectedProfit / totalStake) * 100 : null;

  const firstDate = settled[0]?.date;
  const lastDate = settled[settled.length - 1]?.date;
  const years =
    firstDate && lastDate
      ? Math.max(
          1 / 365.25,
          (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 3600 * 1000),
        )
      : null;
  const cagrPct =
    years && initialBankroll > 0 && finalBankroll > 0
      ? ((finalBankroll / initialBankroll) ** (1 / years) - 1) * 100
      : finalBankroll <= 0
        ? -100
        : null;

  const returns = placed.map((row) =>
    row.stake > 0 ? row.profit / row.stake : 0,
  );
  const avgReturn = mean(returns);
  const vol = stdev(returns);
  const downVol = downsideStdev(returns);
  const obsPerYear = years && placed.length > 0 ? placed.length / years : 365;
  const sharpe =
    vol > 0 ? (avgReturn / vol) * Math.sqrt(obsPerYear) : null;
  const sortino =
    downVol > 0 ? (avgReturn / downVol) * Math.sqrt(obsPerYear) : null;
  const calmar =
    maxDrawdownPct > 0 && cagrPct != null ? cagrPct / maxDrawdownPct : null;

  const clv = computeClvMetrics(placed);

  return {
    bets: placed.length,
    opportunities,
    betFrequencyPct:
      opportunities > 0 ? (placed.length / opportunities) * 100 : 0,
    winRatePct: decided.length > 0 ? (won / decided.length) * 100 : null,
    totalProfit,
    expectedProfit,
    realizedVsExpected: totalProfit - expectedProfit,
    yieldPct,
    expectedYieldPct,
    roiPct,
    cagrPct,
    maxDrawdownPct,
    maxDrawdownDurationBets,
    sharpe,
    sortino,
    calmar,
    averageOdds:
      placed.length > 0 ? mean(placed.map((row) => row.odds)) : null,
    averageStake: placed.length > 0 ? totalStake / placed.length : 0,
    clvPct: clv.clvPct,
    clvNoVigPct: clv.clvNoVigPct,
    beatClosingPct: clv.beatClosingPct,
    bankrollFinal: finalBankroll,
    bankrollPeak: peak,
    bankrollValley: valley,
  };
}
