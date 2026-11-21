/**
 * Synthetic fair-odds generator for unit / smoke tests (R1ch1k).
 */

import type { BacktestBetInput } from "@/modules/bankroll-backtest/types";

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type SyntheticConfig = {
  n?: number;
  seed?: number;
  /** True probability of win (fair). */
  trueP?: number;
  /** Bookmaker overround on decimal odds. */
  overround?: number;
  /** Model probability bias vs trueP (positive = optimistic). */
  modelBias?: number;
  startDate?: Date;
};

/**
 * Generates settled-ready bets with known edge properties.
 * Odds = (1/trueP) * (1+overround); modelProbability = trueP + bias.
 */
export function generateSyntheticBets(
  config: SyntheticConfig = {},
): BacktestBetInput[] {
  const n = config.n ?? 100;
  const seed = config.seed ?? 42;
  const trueP = config.trueP ?? 0.45;
  const overround = config.overround ?? 0.05;
  const modelBias = config.modelBias ?? 0.02;
  const start = config.startDate ?? new Date("2024-01-01T12:00:00+03:00");
  const rng = mulberry32(seed);
  const fairOdds = 1 / trueP;
  const offeredOdds = fairOdds * (1 + overround);
  const modelP = Math.min(0.99, Math.max(0.01, trueP + modelBias));

  const bets: BacktestBetInput[] = [];
  for (let i = 0; i < n; i += 1) {
    const won = rng() < trueP;
    const day = new Date(start.getTime() + i * 86_400_000);
    bets.push({
      id: `syn-${i}`,
      date: day,
      slotKey: day.toISOString().slice(0, 10),
      odds: offeredOdds,
      modelProbability: modelP,
      closingOdds: fairOdds,
      result: won ? "WON" : "LOST",
      edge: modelP * offeredOdds - 1,
      marketKey: "1x2",
      leagueKey: "synthetic",
    });
  }
  return bets;
}
