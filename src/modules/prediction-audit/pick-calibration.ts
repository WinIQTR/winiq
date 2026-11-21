/**
 * Calibration table by pick probability bins (open-data examples/calibration.py).
 */

import { pickProbability } from "@/modules/prediction-audit/scoring";
import type { SettledOneXTwoRow } from "@/modules/prediction-audit/types";

export const DEFAULT_PICK_PROB_EDGES = [
  0.0, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 1.01,
] as const;

export type PickCalibrationBin = {
  label: string;
  min: number;
  max: number;
  matches: number;
  meanPredicted: number | null;
  observedHitRate: number | null;
  gapPp: number | null;
};

export function buildPickProbabilityCalibration(
  rows: readonly SettledOneXTwoRow[],
  edges: readonly number[] = DEFAULT_PICK_PROB_EDGES,
): PickCalibrationBin[] {
  const bins = edges.slice(0, -1).map((min, index) => ({
    min,
    max: edges[index + 1]!,
    matches: 0,
    predictedSum: 0,
    hits: 0,
  }));

  for (const row of rows) {
    if (row.result === null) continue;
    const p = pickProbability(row.pick, row.pHome, row.pDraw, row.pAway);
    const hit = row.pick === row.result ? 1 : 0;
    for (const bin of bins) {
      if (p >= bin.min && p < bin.max) {
        bin.matches += 1;
        bin.predictedSum += p;
        bin.hits += hit;
        break;
      }
    }
  }

  return bins.map((bin) => {
    const meanPredicted = bin.matches > 0 ? bin.predictedSum / bin.matches : null;
    const observedHitRate = bin.matches > 0 ? bin.hits / bin.matches : null;
    return {
      label: `${bin.min.toFixed(2)}–${Math.min(bin.max, 1).toFixed(2)}`,
      min: bin.min,
      max: bin.max,
      matches: bin.matches,
      meanPredicted,
      observedHitRate,
      gapPp:
        meanPredicted !== null && observedHitRate !== null
          ? (observedHitRate - meanPredicted) * 100
          : null,
    };
  });
}
