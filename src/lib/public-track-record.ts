import { loadMemberPastPerformance } from "@/lib/member-past-performance";
import { MEMBER_ODDS_BAND_DEFS } from "@/lib/member-odds-bands";

export type PublicTrackBand = {
  key: string;
  label: string;
  wins: number;
  losses: number;
  voids: number;
  samples: number;
  rate: number | null;
};

export type PublicTrackRecordSummary = {
  generatedAtIso: string;
  /** WON + LOST (voids excluded from hit rate). */
  evaluated: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number | null;
  strength: PublicTrackBand[];
  oddsBands: PublicTrackBand[];
  oddsMissing: number;
};

/**
 * Login-free ÖZET for sales/trust. Aggregates settled SmartPickHistory;
 * does not expose per-match picks (those stay behind membership).
 */
export async function loadPublicTrackRecordSummary(): Promise<PublicTrackRecordSummary> {
  const past = await loadMemberPastPerformance({ matchLimit: 1 });
  const strengthDefs = [
    { key: "strong", label: "Güçlü", band: past.performance.strong },
    { key: "medium", label: "Orta", band: past.performance.medium },
    { key: "weak", label: "Zayıf", band: past.performance.weak },
  ] as const;

  const strength: PublicTrackBand[] = strengthDefs.map((item) => ({
    key: item.key,
    label: item.label,
    wins: item.band.wins,
    losses: item.band.losses,
    voids: item.band.voids,
    samples: item.band.samples,
    rate: item.band.rate,
  }));

  const oddsBands: PublicTrackBand[] = past.oddsBands.map((band) => {
    const def = MEMBER_ODDS_BAND_DEFS.find((row) => row.key === band.key);
    return {
      key: band.key,
      label: def?.label ?? band.label,
      wins: band.wins,
      losses: band.losses,
      voids: 0,
      samples: band.samples,
      rate: band.rate,
    };
  });

  const wins = strength.reduce((sum, band) => sum + band.wins, 0);
  const losses = strength.reduce((sum, band) => sum + band.losses, 0);
  const voids = strength.reduce((sum, band) => sum + band.voids, 0);
  const evaluated = wins + losses;

  return {
    generatedAtIso: new Date().toISOString(),
    evaluated,
    wins,
    losses,
    voids,
    hitRate: evaluated > 0 ? (wins / evaluated) * 100 : null,
    strength,
    oddsBands,
    oddsMissing: past.oddsMissing,
  };
}
