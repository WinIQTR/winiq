import "dotenv/config";

import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type ApiFootballStatistic = {
  type: string;
  value: number | string | null;
};

type ApiFootballFixtureStatisticsTeam = {
  team: { id: number; name: string };
  statistics: ApiFootballStatistic[];
};

function normalizeType(value: string) {
  return value.trim().toLowerCase();
}

function parseNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace("%", "").trim();
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: number | string | null | undefined): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round(parsed));
}

function getStatistic(
  statistics: ApiFootballStatistic[],
  type: string,
): number | string | null | undefined {
  const target = normalizeType(type);
  return statistics.find((item) => normalizeType(item.type) === target)?.value;
}

/**
 * On-demand backfill of fixtures/statistics for finished matches that still
 * lack MatchTeamStatistic rows (used by referee profile pages).
 *
 * API-Football has no referee career endpoint — cards/fouls come only from
 * per-fixture statistics.
 */
export async function syncRefereeMatchStatistics(
  matches: Array<{
    id: number;
    apiId: number;
    homeTeamId: number;
    awayTeamId: number;
    _count?: { teamStatistics: number };
  }>,
  options?: { maxMatches?: number },
): Promise<{ updated: number; checked: number }> {
  const pending = matches.filter((match) => (match._count?.teamStatistics ?? 0) < 2);
  if (!pending.length) return { updated: 0, checked: 0 };

  const maxMatches = Math.max(1, options?.maxMatches ?? 8);
  let updated = 0;
  let checked = 0;

  for (const match of pending.slice(0, maxMatches)) {
    checked += 1;
    try {
      const response = await apiFootballRequest<ApiFootballFixtureStatisticsTeam[]>(
        "fixtures/statistics",
        { fixture: match.apiId },
        { bypassRateLimit: true },
      );

      const rows = response.response ?? [];
      if (!rows.length) continue;

      const apiTeamIds = rows.map((row) => row.team.id);
      const databaseTeams = await prisma.team.findMany({
        where: { apiId: { in: apiTeamIds } },
        select: { id: true, apiId: true },
      });
      const dbTeamByApiId = new Map(databaseTeams.map((team) => [team.apiId, team.id]));

      let saved = 0;
      for (const row of rows) {
        const teamId = dbTeamByApiId.get(row.team.id);
        if (!teamId) continue;
        if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) continue;

        const stats = row.statistics;
        await prisma.matchTeamStatistic.upsert({
          where: { matchId_teamId: { matchId: match.id, teamId } },
          update: {
            shots: parseInteger(getStatistic(stats, "Total Shots")),
            shotsOnTarget: parseInteger(getStatistic(stats, "Shots on Goal")),
            possession: parseNumber(getStatistic(stats, "Ball Possession")),
            corners: parseInteger(getStatistic(stats, "Corner Kicks")),
            fouls: parseInteger(getStatistic(stats, "Fouls")),
            offsides: parseInteger(getStatistic(stats, "Offsides")),
            yellowCards: parseInteger(getStatistic(stats, "Yellow Cards")),
            redCards: parseInteger(getStatistic(stats, "Red Cards")),
            source: "API_FOOTBALL",
            sourceUpdatedAt: new Date(),
          },
          create: {
            matchId: match.id,
            teamId,
            expectedGoals: null,
            expectedGoalsAgainst: null,
            shots: parseInteger(getStatistic(stats, "Total Shots")),
            shotsOnTarget: parseInteger(getStatistic(stats, "Shots on Goal")),
            possession: parseNumber(getStatistic(stats, "Ball Possession")),
            corners: parseInteger(getStatistic(stats, "Corner Kicks")),
            fouls: parseInteger(getStatistic(stats, "Fouls")),
            offsides: parseInteger(getStatistic(stats, "Offsides")),
            yellowCards: parseInteger(getStatistic(stats, "Yellow Cards")),
            redCards: parseInteger(getStatistic(stats, "Red Cards")),
            source: "API_FOOTBALL",
            sourceUpdatedAt: new Date(),
          },
        });
        saved += 1;
      }

      if (saved > 0) updated += 1;
    } catch (error) {
      console.error("[syncRefereeMatchStatistics]", error);
      break;
    }
  }

  return { updated, checked };
}
