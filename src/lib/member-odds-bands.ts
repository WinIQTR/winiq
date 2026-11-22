/**
 * Published decimal-odds bands for member results ÖZET row.
 *
 * Scheme (all edges inclusive; typical book odds are 2-decimal so adjacent
 * labels abut with no gap — e.g. 1.45 ends band 1, 1.46 starts band 2):
 *   [1.10, 1.45] · [1.46, 1.85] · [1.86, 2.15] · [2.16, ∞)
 * Odds below 1.10 are excluded from all bands (“Oranı yok”).
 */

export const MEMBER_ODDS_BAND_DEFS = [
  {
    key: "o110_145",
    label: "1.10 – 1.45",
    tone: "band1" as const,
    minInclusive: 1.1,
    maxInclusive: 1.45 as number | null,
  },
  {
    key: "o146_185",
    label: "1.46 – 1.85",
    tone: "band2" as const,
    minInclusive: 1.46,
    maxInclusive: 1.85 as number | null,
  },
  {
    key: "o186_215",
    label: "1.86 – 2.15",
    tone: "band3" as const,
    minInclusive: 1.86,
    maxInclusive: 2.15 as number | null,
  },
  {
    key: "o216_plus",
    label: "2.16+",
    tone: "band4" as const,
    minInclusive: 2.16,
    maxInclusive: null as number | null,
  },
] as const;

export function mapPublishedOddsToBandKey(
  odds: number,
): (typeof MEMBER_ODDS_BAND_DEFS)[number]["key"] | null {
  if (!(odds >= 1.1) || !Number.isFinite(odds)) return null;
  for (const band of MEMBER_ODDS_BAND_DEFS) {
    if (odds < band.minInclusive) continue;
    if (band.maxInclusive !== null && odds > band.maxInclusive) continue;
    return band.key;
  }
  return null;
}

/**
 * Prefer market/book decimal odds shown for the published pick;
 * fall back to fair (model) odds only when market is missing.
 */
export function resolvePublishedSelectionOdds(row: {
  fairOdds: number | null;
  marketOdds: number | null;
}): number | null {
  if (
    row.marketOdds != null &&
    Number.isFinite(row.marketOdds) &&
    row.marketOdds > 1
  ) {
    return row.marketOdds;
  }
  if (row.fairOdds != null && Number.isFinite(row.fairOdds) && row.fairOdds > 1) {
    return row.fairOdds;
  }
  return null;
}
