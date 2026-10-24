export type RefereeStyleTone = "hard" | "soft" | "lenient" | "unknown";

export type RefereeStyleLabel = {
  tr: string;
  en: string;
};

export type RefereeMatchSummary = {
  id: number;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  leagueName: string;
  yellowCards: number;
  redCards: number;
  fouls: number;
};

export type RefereeProfile = {
  name: string;
  slug: string;
  matches: number;
  averageCards: number | null;
  averageFouls: number | null;
  yellowCards: number;
  redCards: number;
  style: RefereeStyleTone;
  styleLabel: RefereeStyleLabel;
  recent: RefereeMatchSummary[];
};

type StatRow = {
  yellowCards: number | null;
  redCards: number | null;
  fouls: number | null;
};

type FinishedMatchInput = {
  id: number;
  referee: string | null;
  kickoffAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  season: { league: { name: string } };
  teamStatistics: StatRow[];
};

export function slugifyRefereeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function styleFromAverage(average: number | null): {
  style: RefereeStyleTone;
  styleLabel: RefereeStyleLabel;
} {
  if (average == null) {
    return {
      style: "unknown",
      styleLabel: { tr: "Profil bekleniyor", en: "Profile pending" },
    };
  }
  if (average >= 5) {
    return { style: "hard", styleLabel: { tr: "Sert", en: "Strict" } };
  }
  if (average <= 3) {
    return { style: "soft", styleLabel: { tr: "Yumuşak", en: "Soft" } };
  }
  return { style: "lenient", styleLabel: { tr: "Toleranslı", en: "Lenient" } };
}

function cardsFromStats(stats: StatRow[]): { yellow: number; red: number; fouls: number } {
  return stats.reduce(
    (sum, row) => ({
      yellow: sum.yellow + (row.yellowCards ?? 0),
      red: sum.red + (row.redCards ?? 0),
      fouls: sum.fouls + (row.fouls ?? 0),
    }),
    { yellow: 0, red: 0, fouls: 0 },
  );
}

/** Weighted card load: yellow + 2×red, used for style banding. */
export function buildRefereeProfile(
  name: string,
  finishedMatches: FinishedMatchInput[],
): RefereeProfile {
  const trimmed = name.trim();
  const officiated = finishedMatches
    .filter((match) => match.referee?.trim() === trimmed && match.teamStatistics.length > 0)
    .sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime());

  let yellowCards = 0;
  let redCards = 0;
  let fouls = 0;

  const recent: RefereeMatchSummary[] = officiated.slice(0, 12).map((match) => {
    const totals = cardsFromStats(match.teamStatistics);
    yellowCards += totals.yellow;
    redCards += totals.red;
    fouls += totals.fouls;
    return {
      id: match.id,
      kickoffAt: match.kickoffAt,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      leagueName: match.season.league.name,
      yellowCards: totals.yellow,
      redCards: totals.red,
      fouls: totals.fouls,
    };
  });

  // Full career totals for averages (not only recent slice)
  for (const match of officiated.slice(12)) {
    const totals = cardsFromStats(match.teamStatistics);
    yellowCards += totals.yellow;
    redCards += totals.red;
    fouls += totals.fouls;
  }

  const matches = officiated.length;
  const averageCards = matches ? (yellowCards + redCards * 2) / matches : null;
  const averageFouls = matches ? fouls / matches : null;
  const { style, styleLabel } = styleFromAverage(averageCards);

  return {
    name: trimmed,
    slug: slugifyRefereeName(trimmed),
    matches,
    averageCards,
    averageFouls,
    yellowCards,
    redCards,
    style,
    styleLabel,
    recent,
  };
}

export function buildRefereeProfileMap(
  names: Array<string | null | undefined>,
  finishedMatches: FinishedMatchInput[],
): Map<string, RefereeProfile> {
  const unique = [...new Set(names.map((name) => name?.trim()).filter(Boolean) as string[])];
  const map = new Map<string, RefereeProfile>();
  for (const name of unique) {
    map.set(name, buildRefereeProfile(name, finishedMatches));
  }
  return map;
}
