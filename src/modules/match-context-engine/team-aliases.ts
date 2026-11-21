/**
 * Former-names / team alias normalizer for multi-source joins.
 */

export type TeamAliasTable = {
  /** Canonical name → aliases (including historical names). */
  aliases: Record<string, string[]>;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAliasIndex(
  table: TeamAliasTable,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(table.aliases)) {
    const canonKey = normalizeKey(canonical);
    index.set(canonKey, canonical);
    for (const alias of aliases) {
      index.set(normalizeKey(alias), canonical);
    }
  }
  return index;
}

export function canonicalizeTeamName(
  rawName: string,
  index: Map<string, string>,
): string {
  const key = normalizeKey(rawName);
  return index.get(key) ?? rawName.trim();
}

export function canonicalizeMany(
  names: readonly string[],
  index: Map<string, string>,
): string[] {
  return names.map((name) => canonicalizeTeamName(name, index));
}

/** Built-in starter aliases (extend via data/team-aliases.json). */
export const DEFAULT_TEAM_ALIASES: TeamAliasTable = {
  aliases: {
    "Manchester United": ["Man United", "Man Utd", "Manchester Utd"],
    "Manchester City": ["Man City", "Manchester City FC"],
    "Tottenham Hotspur": ["Tottenham", "Spurs"],
    "Inter Milan": ["Inter", "FC Internazionale", "Internazionale"],
    "AC Milan": ["Milan", "A.C. Milan"],
    "Bayern Munich": ["Bayern München", "Bayern Munchen", "FC Bayern"],
    "Paris Saint-Germain": ["PSG", "Paris SG", "Paris Saint Germain"],
    "Atletico Madrid": ["Atlético Madrid", "Atletico de Madrid", "Atleti"],
  },
};
