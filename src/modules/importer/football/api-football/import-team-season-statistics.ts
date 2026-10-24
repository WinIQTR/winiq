import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type TeamStatsResponse = {
  form?: string | null;
  fixtures?: {
    played?: { total?: number | null };
    wins?: { total?: number | null };
    draws?: { total?: number | null };
    loses?: { total?: number | null };
  };
  goals?: {
    for?: { total?: { total?: number | null } };
    against?: { total?: { total?: number | null } };
  };
  clean_sheet?: { total?: number | null };
  failed_to_score?: { total?: number | null };
};

/**
 * /teams/statistics — one request per team. Keep maximumTeams small.
 */
export async function importTeamSeasonStatisticsFromApiFootball(options: {
  leagueApiId: number;
  seasonYear: number;
  maximumTeams?: number;
}): Promise<{ teams: number }> {
  const season = await prisma.season.findFirst({
    where: {
      year: options.seasonYear,
      league: { apiId: options.leagueApiId },
    },
    select: { id: true },
  });
  if (!season) {
    throw new Error(`Season ${options.seasonYear} / league ${options.leagueApiId} not found.`);
  }

  const max = Math.max(1, options.maximumTeams ?? 8);
  let teamRows = await prisma.teamSeason.findMany({
    where: { seasonId: season.id, status: "ACTIVE" },
    take: max,
    select: { team: { select: { id: true, apiId: true } } },
    orderBy: { id: "asc" },
  });
  if (!teamRows.length) {
    const fromStandings = await prisma.leagueStanding.findMany({
      where: { seasonId: season.id },
      orderBy: { rank: "asc" },
      take: max,
      select: { team: { select: { id: true, apiId: true } } },
    });
    teamRows = fromStandings;
  }

  let saved = 0;
  for (const row of teamRows) {
    try {
      const data = await apiFootballRequest<TeamStatsResponse>("teams/statistics", {
        league: options.leagueApiId,
        season: options.seasonYear,
        team: row.team.apiId,
      });
      const stats = data.response as TeamStatsResponse | undefined;
      if (!stats || typeof stats !== "object") continue;

      await prisma.teamSeasonApiStatistic.upsert({
        where: {
          teamId_seasonId: { teamId: row.team.id, seasonId: season.id },
        },
        update: {
          form: stats.form ?? null,
          played: stats.fixtures?.played?.total ?? null,
          wins: stats.fixtures?.wins?.total ?? null,
          draws: stats.fixtures?.draws?.total ?? null,
          losses: stats.fixtures?.loses?.total ?? null,
          goalsFor: stats.goals?.for?.total?.total ?? null,
          goalsAgainst: stats.goals?.against?.total?.total ?? null,
          cleanSheet: stats.clean_sheet?.total ?? null,
          failedToScore: stats.failed_to_score?.total ?? null,
          payloadJson: stats as object,
          sourceUpdatedAt: new Date(),
        },
        create: {
          teamId: row.team.id,
          seasonId: season.id,
          form: stats.form ?? null,
          played: stats.fixtures?.played?.total ?? null,
          wins: stats.fixtures?.wins?.total ?? null,
          draws: stats.fixtures?.draws?.total ?? null,
          losses: stats.fixtures?.loses?.total ?? null,
          goalsFor: stats.goals?.for?.total?.total ?? null,
          goalsAgainst: stats.goals?.against?.total?.total ?? null,
          cleanSheet: stats.clean_sheet?.total ?? null,
          failedToScore: stats.failed_to_score?.total ?? null,
          payloadJson: stats as object,
          sourceUpdatedAt: new Date(),
        },
      });
      saved += 1;
    } catch (error) {
      console.error("[importTeamSeasonStatistics]", row.team.apiId, error);
      break;
    }
  }

  return { teams: saved };
}
