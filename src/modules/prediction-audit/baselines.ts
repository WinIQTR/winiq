/**
 * Naive baselines next to model metrics (open-data style).
 * - Always-pick-home hit rate
 * - Uniform ⅓ Brier (= 2/3 ≈ 0.6667 for 3-way one-hot)
 */

import type { SettledOneXTwoRow } from "@/modules/prediction-audit/types";
import { multiClassBrier } from "@/modules/prediction-audit/scoring";

export const UNIFORM_ONE_THIRD_BRIER = 2 / 3;

export type NaiveBaselines = {
  matches: number;
  modelPickHitRate: number | null;
  homePickHitRate: number | null;
  modelBrier: number | null;
  uniformBrier: number;
  /** Positive = model better than home-pick baseline (pp). */
  hitRateVsHomePp: number | null;
  /** Positive = model better than uniform (lower Brier). */
  brierImprovementVsUniform: number | null;
};

export function computeNaiveBaselines(
  rows: readonly SettledOneXTwoRow[],
): NaiveBaselines {
  const settled = rows.filter((row) => row.result !== null);
  if (settled.length === 0) {
    return {
      matches: 0,
      modelPickHitRate: null,
      homePickHitRate: null,
      modelBrier: null,
      uniformBrier: UNIFORM_ONE_THIRD_BRIER,
      hitRateVsHomePp: null,
      brierImprovementVsUniform: null,
    };
  }

  let pickHits = 0;
  let homeHits = 0;
  let brierSum = 0;
  for (const row of settled) {
    const result = row.result!;
    if (row.pick === result) pickHits += 1;
    if (result === "1") homeHits += 1;
    brierSum += multiClassBrier(row.pHome, row.pDraw, row.pAway, result);
  }

  const modelPickHitRate = pickHits / settled.length;
  const homePickHitRate = homeHits / settled.length;
  const modelBrier = brierSum / settled.length;

  return {
    matches: settled.length,
    modelPickHitRate,
    homePickHitRate,
    modelBrier,
    uniformBrier: UNIFORM_ONE_THIRD_BRIER,
    hitRateVsHomePp: (modelPickHitRate - homePickHitRate) * 100,
    brierImprovementVsUniform: UNIFORM_ONE_THIRD_BRIER - modelBrier,
  };
}
