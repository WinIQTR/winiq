/**
 * Published decimal-odds bands for member results ÖZET row.
 *
 * Scheme:
 *   [1.10, 1.50] · (1.50, 1.75] · (1.75, 2.00] · (2.00, 3.00] · (3.00, ∞)
 * So 2.00 sits in “1.76 – 2.00”; “2.00 – 3.00” means above 2.00 up to 3.00.
 * Odds below 1.10 are excluded from all bands.
 */

export const MEMBER_ODDS_BAND_DEFS = [
  {
    key: "o110_150",
    label: "1.10 – 1.50",
    tone: "band1" as const,
    minExclusive: null as number | null,
    minInclusive: 1.1,
    maxInclusive: 1.5,
  },
  {
    key: "o151_175",
    label: "1.51 – 1.75",
    tone: "band2" as const,
    minExclusive: 1.5,
    minInclusive: null as number | null,
    maxInclusive: 1.75,
  },
  {
    key: "o176_200",
    label: "1.76 – 2.00",
    tone: "band3" as const,
    minExclusive: 1.75,
    minInclusive: null as number | null,
    maxInclusive: 2.0,
  },
  {
    key: "o200_300",
    label: "2.00 – 3.00",
    tone: "band4" as const,
    minExclusive: 2.0,
    minInclusive: null as number | null,
    maxInclusive: 3.0,
  },
  {
    key: "o300_plus",
    label: "3.00+",
    tone: "band5" as const,
    minExclusive: 3.0,
    minInclusive: null as number | null,
    maxInclusive: null as number | null,
  },
] as const;

export function mapPublishedOddsToBandKey(
  odds: number,
): (typeof MEMBER_ODDS_BAND_DEFS)[number]["key"] | null {
  if (!(odds >= 1.1) || !Number.isFinite(odds)) return null;
  for (const band of MEMBER_ODDS_BAND_DEFS) {
    if (band.minInclusive !== null && odds < band.minInclusive) continue;
    if (band.minExclusive !== null && !(odds > band.minExclusive)) continue;
    if (band.maxInclusive !== null && odds > band.maxInclusive) continue;
    return band.key;
  }
  return null;
}

/** Prefer fair (published model) odds; fall back to market odds. */
export function resolvePublishedSelectionOdds(row: {
  fairOdds: number | null;
  marketOdds: number | null;
}): number | null {
  if (row.fairOdds != null && Number.isFinite(row.fairOdds) && row.fairOdds > 1) {
    return row.fairOdds;
  }
  if (
    row.marketOdds != null &&
    Number.isFinite(row.marketOdds) &&
    row.marketOdds > 1
  ) {
    return row.marketOdds;
  }
  return null;
}
