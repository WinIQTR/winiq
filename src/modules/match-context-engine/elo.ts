/**
 * Competition-weighted Elo with margin-of-victory and neutral home advantage.
 * Pre-match ratings only; updates applied after the score (leakage-safe).
 */

export type CompetitionCategory =
  | "friendly"
  | "nations_league"
  | "qualifier"
  | "continental"
  | "world_cup"
  | "league"
  | "cup"
  | "other";

export type EloMatchInput = {
  matchId: number | string;
  kickoffAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  competition?: string | null;
  neutral?: boolean;
};

export type EloPreMatch = {
  matchId: number | string;
  homeEloPre: number;
  awayEloPre: number;
  homeExpected: number;
  awayExpected: number;
  homeAdvantageApplied: number;
};

export type EloConfig = {
  initialRating: number;
  homeAdvantage: number;
  neutralHomeAdvantage: number;
  kFactors: Record<CompetitionCategory, number>;
  useMarginMultiplier: boolean;
};

export const DEFAULT_ELO_CONFIG: EloConfig = {
  initialRating: 1500,
  homeAdvantage: 60,
  neutralHomeAdvantage: 0,
  kFactors: {
    friendly: 15,
    nations_league: 20,
    qualifier: 30,
    continental: 40,
    world_cup: 50,
    league: 28,
    cup: 35,
    other: 20,
  },
  useMarginMultiplier: true,
};

export function categorizeCompetition(
  competition: string | null | undefined,
): CompetitionCategory {
  const value = (competition ?? "").toLowerCase();
  if (!value) return "other";
  if (value.includes("friendly")) return "friendly";
  if (value.includes("nations league") || value.includes("uefa nations")) {
    return "nations_league";
  }
  if (value.includes("qualif") || value.includes("eleme")) return "qualifier";
  if (
    value.includes("world cup") ||
    value.includes("dünya kupası") ||
    value.includes("dunya kupasi")
  ) {
    return "world_cup";
  }
  if (
    value.includes("champions") ||
    value.includes("europa") ||
    value.includes("conference") ||
    value.includes("copa") ||
    value.includes("afcon") ||
    value.includes("asian cup") ||
    value.includes("gold cup")
  ) {
    return "continental";
  }
  if (value.includes("cup") || value.includes("kupa") || value.includes("fa ")) {
    return "cup";
  }
  if (
    value.includes("league") ||
    value.includes("lig") ||
    value.includes("serie") ||
    value.includes("bundesliga") ||
    value.includes("laliga") ||
    value.includes("premier")
  ) {
    return "league";
  }
  return "other";
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function marginMultiplier(goalDiff: number): number {
  const abs = Math.abs(goalDiff);
  if (abs <= 1) return 1;
  return Math.min(1.75, Math.log(abs + 1) / Math.log(2));
}

/**
 * Chronologically process matches; returns pre-match Elo for each fixture.
 */
export function computeChronologicalElo(
  matches: readonly EloMatchInput[],
  config: EloConfig = DEFAULT_ELO_CONFIG,
): {
  preMatch: EloPreMatch[];
  finalRatings: Map<string, number>;
} {
  const ratings = new Map<string, number>();
  const get = (id: string) => ratings.get(id) ?? config.initialRating;
  const ordered = [...matches].sort(
    (a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime(),
  );
  const preMatch: EloPreMatch[] = [];

  for (const match of ordered) {
    const homePre = get(match.homeTeamId);
    const awayPre = get(match.awayTeamId);
    const ha = match.neutral
      ? config.neutralHomeAdvantage
      : config.homeAdvantage;
    const homeEffective = homePre + ha;
    const homeExpected = expectedScore(homeEffective, awayPre);
    const awayExpected = 1 - homeExpected;

    preMatch.push({
      matchId: match.matchId,
      homeEloPre: homePre,
      awayEloPre: awayPre,
      homeExpected,
      awayExpected,
      homeAdvantageApplied: ha,
    });

    const homeActual =
      match.homeScore > match.awayScore
        ? 1
        : match.homeScore === match.awayScore
          ? 0.5
          : 0;
    const awayActual = 1 - homeActual;
    const category = categorizeCompetition(match.competition);
    let k = config.kFactors[category] ?? config.kFactors.other;
    if (config.useMarginMultiplier) {
      k *= marginMultiplier(match.homeScore - match.awayScore);
    }

    ratings.set(match.homeTeamId, homePre + k * (homeActual - homeExpected));
    ratings.set(match.awayTeamId, awayPre + k * (awayActual - awayExpected));
  }

  return { preMatch, finalRatings: ratings };
}

export function eloWinProbability(
  homeElo: number,
  awayElo: number,
  options?: { neutral?: boolean; config?: EloConfig },
): { home: number; draw: number; away: number } {
  const config = options?.config ?? DEFAULT_ELO_CONFIG;
  const ha = options?.neutral
    ? config.neutralHomeAdvantage
    : config.homeAdvantage;
  const homeExpected = expectedScore(homeElo + ha, awayElo);
  // Simple draw mass around 0.5 expected — fitted loosely for UI/advisory use.
  const draw = Math.max(0.18, 0.32 - Math.abs(homeExpected - 0.5) * 0.45);
  const remainder = 1 - draw;
  const home = remainder * homeExpected;
  const away = remainder * (1 - homeExpected);
  return { home, draw, away };
}
