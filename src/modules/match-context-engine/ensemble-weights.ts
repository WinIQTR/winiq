/**
 * Ensemble weight redistribute — when a component (e.g. market odds / ML)
 * is disabled or missing, redistribute its weight across remaining parts.
 */

export type EnsembleWeightMap = Record<string, number>;

export function redistributeEnsembleWeights(
  weights: EnsembleWeightMap,
  disabledKeys: readonly string[],
): EnsembleWeightMap {
  const disabled = new Set(disabledKeys);
  const activeEntries = Object.entries(weights).filter(
    ([key, value]) => !disabled.has(key) && value > 0,
  );
  if (activeEntries.length === 0) {
    return { ...weights };
  }
  const activeSum = activeEntries.reduce((total, [, value]) => total + value, 0);
  const disabledSum = Object.entries(weights)
    .filter(([key]) => disabled.has(key))
    .reduce((total, [, value]) => total + Math.max(0, value), 0);

  const result: EnsembleWeightMap = {};
  for (const key of Object.keys(weights)) {
    if (disabled.has(key)) {
      result[key] = 0;
      continue;
    }
    const base = Math.max(0, weights[key] ?? 0);
    if (activeSum <= 0) {
      result[key] = 0;
      continue;
    }
    result[key] = base + disabledSum * (base / activeSum);
  }
  return result;
}

export function normalizeWeightMap(weights: EnsembleWeightMap): EnsembleWeightMap {
  const sum = Object.values(weights).reduce((total, value) => total + Math.max(0, value), 0);
  if (sum <= 0) return { ...weights };
  const result: EnsembleWeightMap = {};
  for (const [key, value] of Object.entries(weights)) {
    result[key] = Math.max(0, value) / sum;
  }
  return result;
}

/** Production Champion defaults: 20% ML / 80% Poisson. */
export const PRODUCTION_ENSEMBLE_WEIGHTS: EnsembleWeightMap = {
  ml: 0.2,
  poisson: 0.8,
  market: 0,
  elo: 0,
};

export function resolveProductionBlendWeights(options: {
  mlAvailable: boolean;
  marketAvailable?: boolean;
  eloAvailable?: boolean;
}): { ml: number; poisson: number; market: number; elo: number } {
  const disabled: string[] = [];
  if (!options.mlAvailable) disabled.push("ml");
  if (!options.marketAvailable) disabled.push("market");
  if (!options.eloAvailable) disabled.push("elo");
  const redistributed = normalizeWeightMap(
    redistributeEnsembleWeights(PRODUCTION_ENSEMBLE_WEIGHTS, disabled),
  );
  return {
    ml: redistributed.ml ?? 0,
    poisson: redistributed.poisson ?? 1,
    market: redistributed.market ?? 0,
    elo: redistributed.elo ?? 0,
  };
}
