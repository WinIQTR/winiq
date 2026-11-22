/**
 * Published decimal-odds bands for member results ÖZET row.
 *
 * Scheme A (5 bands; all edges inclusive; 2-decimal book odds abut):
 *   [1.10, 1.49] · [1.50, 1.79] · [1.80, 2.19] · [2.20, 2.99] · [3.00, ∞)
 * Odds below 1.10 are excluded from all bands (“Oranı yok”).
 */

export const MEMBER_ODDS_BAND_DEFS = [
  {
    key: "o110_149",
    label: "1.10 – 1.49",
    tone: "band1" as const,
    minInclusive: 1.1,
    maxInclusive: 1.49 as number | null,
  },
  {
    key: "o150_179",
    label: "1.50 – 1.79",
    tone: "band2" as const,
    minInclusive: 1.5,
    maxInclusive: 1.79 as number | null,
  },
  {
    key: "o180_219",
    label: "1.80 – 2.19",
    tone: "band3" as const,
    minInclusive: 1.8,
    maxInclusive: 2.19 as number | null,
  },
  {
    key: "o220_299",
    label: "2.20 – 2.99",
    tone: "band4" as const,
    minInclusive: 2.2,
    maxInclusive: 2.99 as number | null,
  },
  {
    key: "o300_plus",
    label: "3.00+",
    tone: "band5" as const,
    minInclusive: 3.0,
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
