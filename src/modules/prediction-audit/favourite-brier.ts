/**
 * Brier stratified by favourite strength (max 1X2 probability).
 */

import { multiClassBrier } from "@/modules/prediction-audit/scoring";
import type { SettledOneXTwoRow } from "@/modules/prediction-audit/types";

export const DEFAULT_FAVOURITE_EDGES = [
  0.0, 0.4, 0.5, 0.6, 0.7, 0.85, 1.01,
] as const;

export type FavouriteBrierSlice = {
  label: string;
  min: number;
  max: number;
  matches: number;
  meanFavouriteProb: number | null;
  brier: number | null;
  pickHitRate: number | null;
};

export function buildFavouriteStrengthBrier(
  rows: readonly SettledOneXTwoRow[],
  edges: readonly number[] = DEFAULT_FAVOURITE_EDGES,
): FavouriteBrierSlice[] {
  const slices = edges.slice(0, -1).map((min, index) => ({
    min,
    max: edges[index + 1]!,
    matches: 0,
    favSum: 0,
    brierSum: 0,
    hits: 0,
  }));

  for (const row of rows) {
    if (row.result === null) continue;
    const fav = Math.max(row.pHome, row.pDraw, row.pAway);
    for (const slice of slices) {
      if (fav >= slice.min && fav < slice.max) {
        slice.matches += 1;
        slice.favSum += fav;
        slice.brierSum += multiClassBrier(
          row.pHome,
          row.pDraw,
          row.pAway,
          row.result,
        );
        if (row.pick === row.result) slice.hits += 1;
        break;
      }
    }
  }

  return slices.map((slice) => ({
    label: `${slice.min.toFixed(2)}–${Math.min(slice.max, 1).toFixed(2)}`,
    min: slice.min,
    max: slice.max,
    matches: slice.matches,
    meanFavouriteProb:
      slice.matches > 0 ? slice.favSum / slice.matches : null,
    brier: slice.matches > 0 ? slice.brierSum / slice.matches : null,
    pickHitRate: slice.matches > 0 ? slice.hits / slice.matches : null,
  }));
}
