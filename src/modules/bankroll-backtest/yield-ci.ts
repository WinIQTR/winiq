/**
 * Per-match bootstrap CI on yield (R1ch1k/betting-backtester MIT).
 * Resamples match groups, not individual bets, to preserve correlation.
 */

import type { SettledBacktestBet } from "@/modules/bankroll-backtest/types";

export type YieldCI = {
  mean: number;
  lower: number;
  upper: number;
  confidence: number;
  nResamples: number;
  nMatchGroups: number;
  nValidResamples: number;
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function type7Quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  const frac = pos - lo;
  return sorted[lo]! + frac * (sorted[hi]! - sorted[lo]!);
}

function groupByMatch(
  settled: readonly SettledBacktestBet[],
): SettledBacktestBet[][] {
  const map = new Map<string, SettledBacktestBet[]>();
  for (const row of settled) {
    if (row.skipped || row.stake <= 0) continue;
    const key = row.slotKey ?? row.id;
    const group = map.get(key) ?? [];
    group.push(row);
    map.set(key, group);
  }
  return [...map.values()];
}

function yieldOfGroups(groups: readonly SettledBacktestBet[][]): number | null {
  let pnl = 0;
  let turnover = 0;
  for (const group of groups) {
    for (const row of group) {
      pnl += row.profit;
      turnover += row.stake;
    }
  }
  if (turnover <= 0) return null;
  return pnl / turnover;
}

export function computeYieldBootstrapCI(
  settled: readonly SettledBacktestBet[],
  options?: {
    nResamples?: number;
    seed?: number;
    confidence?: number;
  },
): YieldCI | null {
  const groups = groupByMatch(settled);
  if (groups.length === 0) return null;

  const nResamples = options?.nResamples ?? 2000;
  const seed = options?.seed ?? 0;
  const confidence = options?.confidence ?? 0.95;
  const rng = mulberry32(seed);
  const observed = yieldOfGroups(groups);
  if (observed === null) return null;

  const samples: number[] = [];
  for (let i = 0; i < nResamples; i += 1) {
    const resampled: SettledBacktestBet[][] = [];
    for (let g = 0; g < groups.length; g += 1) {
      const pick = groups[Math.floor(rng() * groups.length)]!;
      resampled.push(pick);
    }
    const y = yieldOfGroups(resampled);
    if (y !== null) samples.push(y);
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => a - b);
  const alpha = (1 - confidence) / 2;
  return {
    mean: samples.reduce((total, value) => total + value, 0) / samples.length,
    lower: type7Quantile(samples, alpha),
    upper: type7Quantile(samples, 1 - alpha),
    confidence,
    nResamples,
    nMatchGroups: groups.length,
    nValidResamples: samples.length,
  };
}
