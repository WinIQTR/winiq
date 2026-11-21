/**
 * Paired block-bootstrap comparing model vs market (de-vig) log-loss / Brier / RPS.
 * Honest CI — if interval includes zero, model does not beat the market.
 */

export type BootstrapObservation = {
  /** Chronological block key (e.g. match day). */
  blockKey: string;
  /** Model probs for mutually exclusive outcomes (sum ≈ 1). */
  modelProbs: readonly number[];
  /** Market fair probs for the same outcomes. */
  marketProbs: readonly number[];
  /** One-hot outcome index. */
  outcomeIndex: number;
};

export type MetricName = "logLoss" | "brier" | "rps";

export type BootstrapMetricResult = {
  metric: MetricName;
  model: number;
  market: number;
  delta: number;
  ciLow: number;
  ciHigh: number;
  pValue: number;
  beatsMarket: boolean;
  indistinguishable: boolean;
};

export type PairedBootstrapReport = {
  observations: number;
  blocks: number;
  iterations: number;
  metrics: BootstrapMetricResult[];
  summary: string;
};

function clampProb(value: number): number {
  return Math.min(0.999999, Math.max(1e-12, value));
}

function logLoss(probs: readonly number[], outcomeIndex: number): number {
  return -Math.log(clampProb(probs[outcomeIndex] ?? 0));
}

function brier(probs: readonly number[], outcomeIndex: number): number {
  let total = 0;
  for (let i = 0; i < probs.length; i += 1) {
    const y = i === outcomeIndex ? 1 : 0;
    total += (clampProb(probs[i] ?? 0) - y) ** 2;
  }
  return total;
}

/** Ranked probability score for ordered outcomes (1X2-style). */
function rps(probs: readonly number[], outcomeIndex: number): number {
  let score = 0;
  let cumP = 0;
  let cumY = 0;
  for (let i = 0; i < probs.length - 1; i += 1) {
    cumP += clampProb(probs[i] ?? 0);
    cumY += i === outcomeIndex ? 1 : 0;
    score += (cumP - cumY) ** 2;
  }
  return score / Math.max(1, probs.length - 1);
}

function metricValue(
  metric: MetricName,
  probs: readonly number[],
  outcomeIndex: number,
): number {
  if (metric === "logLoss") return logLoss(probs, outcomeIndex);
  if (metric === "brier") return brier(probs, outcomeIndex);
  return rps(probs, outcomeIndex);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function groupBlocks(
  observations: readonly BootstrapObservation[],
): BootstrapObservation[][] {
  const map = new Map<string, BootstrapObservation[]>();
  for (const row of observations) {
    const group = map.get(row.blockKey) ?? [];
    group.push(row);
    map.set(row.blockKey, group);
  }
  return [...map.values()];
}

function averageDelta(
  rows: readonly BootstrapObservation[],
  metric: MetricName,
): { model: number; market: number; delta: number } {
  const modelScores: number[] = [];
  const marketScores: number[] = [];
  for (const row of rows) {
    modelScores.push(metricValue(metric, row.modelProbs, row.outcomeIndex));
    marketScores.push(metricValue(metric, row.marketProbs, row.outcomeIndex));
  }
  const model = mean(modelScores);
  const market = mean(marketScores);
  return { model, market, delta: model - market };
}

export function runPairedBlockBootstrap(
  observations: readonly BootstrapObservation[],
  options?: {
    iterations?: number;
    seed?: number;
    metrics?: readonly MetricName[];
  },
): PairedBootstrapReport {
  const iterations = options?.iterations ?? 1000;
  const seed = options?.seed ?? 42;
  const metrics = options?.metrics ?? (["logLoss", "brier", "rps"] as const);
  const blocks = groupBlocks(observations);
  const rng = mulberry32(seed);

  const results: BootstrapMetricResult[] = metrics.map((metric) => {
    const observed = averageDelta(observations, metric);
    const deltas: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      const resampled: BootstrapObservation[] = [];
      for (let b = 0; b < blocks.length; b += 1) {
        const pick = blocks[Math.floor(rng() * blocks.length)]!;
        resampled.push(...pick);
      }
      deltas.push(averageDelta(resampled, metric).delta);
    }
    deltas.sort((a, b) => a - b);
    const ciLow = deltas[Math.floor(0.025 * deltas.length)] ?? observed.delta;
    const ciHigh = deltas[Math.floor(0.975 * deltas.length)] ?? observed.delta;
    const worseOrEqual = deltas.filter((delta) => delta >= 0).length;
    const pValue = worseOrEqual / Math.max(1, deltas.length);
    const beatsMarket = observed.delta < 0 && ciHigh < 0;
    const indistinguishable = ciLow <= 0 && ciHigh >= 0;

    return {
      metric,
      model: observed.model,
      market: observed.market,
      delta: observed.delta,
      ciLow,
      ciHigh,
      pValue,
      beatsMarket,
      indistinguishable,
    };
  });

  const primary = results.find((row) => row.metric === "logLoss") ?? results[0];
  const summary = !primary
    ? "Insufficient observations."
    : primary.indistinguishable
      ? `Model matches the market on ${primary.metric} (Δ ${primary.delta.toFixed(5)}, 95% CI ${primary.ciLow.toFixed(4)}…${primary.ciHigh.toFixed(4)}, p=${primary.pValue.toFixed(2)}).`
      : primary.beatsMarket
        ? `Model beats the market on ${primary.metric} (Δ ${primary.delta.toFixed(5)}).`
        : `Model does not beat the market on ${primary.metric} (Δ ${primary.delta.toFixed(5)}).`;

  return {
    observations: observations.length,
    blocks: blocks.length,
    iterations,
    metrics: results,
    summary,
  };
}

/** Build 1X2-style observations from settled binary rows when only one selection is known. */
export function binaryRowsToBootstrapObservations(
  rows: readonly {
    blockKey: string;
    modelProbability: number;
    marketProbability: number;
    won: boolean;
  }[],
): BootstrapObservation[] {
  return rows.map((row) => {
    const modelP = clampProb(row.modelProbability);
    const marketP = clampProb(row.marketProbability);
    return {
      blockKey: row.blockKey,
      modelProbs: [modelP, 1 - modelP],
      marketProbs: [marketP, 1 - marketP],
      outcomeIndex: row.won ? 0 : 1,
    };
  });
}
