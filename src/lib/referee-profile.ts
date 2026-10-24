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

/** Drop trailing ", Country" suffixes that API-Football sometimes appends. */
export function stripRefereeCountrySuffix(name: string): string {
  const trimmed = name.trim();
  const comma = trimmed.indexOf(",");
  return (comma >= 0 ? trimmed.slice(0, comma) : trimmed).trim();
}

function refereeTokens(name: string): string[] {
  return stripRefereeCountrySuffix(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/\./g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function tokenCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  return false;
}

/**
 * API-Football returns both "S. Barrott" and "Samuel Barrott" (sometimes with
 * ", England"). Exact string equality fails — match on surname + given initials.
 */
export function refereeNamesMatch(a: string, b: string): boolean {
  const left = refereeTokens(a);
  const right = refereeTokens(b);
  if (!left.length || !right.length) return false;
  if (left.join(" ") === right.join(" ")) return true;

  const lastLeft = left[left.length - 1];
  const lastRight = right[right.length - 1];
  if (lastLeft !== lastRight) return false;

  const givenLeft = left.slice(0, -1);
  const givenRight = right.slice(0, -1);
  if (!givenLeft.length || !givenRight.length) {
    return givenLeft.length === 0 && givenRight.length === 0;
  }

  const shorter = givenLeft.length <= givenRight.length ? givenLeft : givenRight;
  const longer = givenLeft.length <= givenRight.length ? givenRight : givenLeft;
  return shorter.every((token, index) => tokenCompatible(token, longer[index]!));
}

export function slugifyRefereeName(name: string): string {
  return stripRefereeCountrySuffix(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Prefer the longest non-country form for display (full name over initials). */
export function preferRefereeDisplayName(
  preferred: string,
  aliases: Array<string | null | undefined>,
): string {
  const cleanedPreferred = stripRefereeCountrySuffix(preferred);
  let best = cleanedPreferred;
  for (const alias of aliases) {
    if (!alias?.trim()) continue;
    if (!refereeNamesMatch(cleanedPreferred, alias)) continue;
    const cleaned = stripRefereeCountrySuffix(alias);
    if (cleaned.length > best.length) best = cleaned;
  }
  return best;
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
  const trimmed = stripRefereeCountrySuffix(name.trim());
  const officiated = finishedMatches
    .filter(
      (match) =>
        Boolean(match.referee?.trim()) &&
        refereeNamesMatch(trimmed, match.referee!) &&
        match.teamStatistics.length > 0,
    )
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
  const displayName = preferRefereeDisplayName(
    trimmed,
    finishedMatches.map((match) => match.referee),
  );

  return {
    name: displayName,
    slug: slugifyRefereeName(displayName),
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

export function findRefereeNameForSlug(
  slug: string,
  names: Array<string | null | undefined>,
): string | null {
  const cleaned = names
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name));

  const exact = cleaned.find((name) => slugifyRefereeName(name) === slug);
  if (exact) {
    return preferRefereeDisplayName(exact, cleaned);
  }

  // Cross-slug: week link may be "samuel-barrott" while DB only has "S. Barrott".
  for (const name of cleaned) {
    const display = preferRefereeDisplayName(name, cleaned);
    if (slugifyRefereeName(display) === slug || slugifyRefereeName(name) === slug) {
      return display;
    }
  }

  return null;
}
