import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type StandingTeam = {
  rank: number;
  points: number;
  goalsDiff: number;
  group?: string | null;
  form?: string | null;
  description?: string | null;
  team: { id: number; name: string };
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

type StandingsResponse = Array<{
  league: {
    id: number;
    season: number;
    standings: StandingTeam[][];
  };
}>;

export async function importStandingsFromApiFootball(options: {
  leagueApiId: number;
  seasonYear: number;
}): Promise<{ rows: number }> {
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

  const data = await apiFootballRequest<StandingsResponse>("standings", {
    league: options.leagueApiId,
    season: options.seasonYear,
  });

  const tables = data.response?.[0]?.league?.standings ?? [];
  let rows = 0;

  for (const table of tables) {
    for (const row of table) {
      const apiTeamId = row.team?.id;
      if (!apiTeamId) continue;
      const team = await prisma.team.findUnique({
        where: { apiId: apiTeamId },
        select: { id: true },
      });
      if (!team) continue;

      const groupName = (row.group ?? "").trim();
      await prisma.leagueStanding.upsert({
        where: {
          seasonId_teamId_groupName: {
            seasonId: season.id,
            teamId: team.id,
            groupName,
          },
        },
        update: {
          rank: row.rank,
          points: row.points,
          played: row.all.played,
          won: row.all.win,
          drawn: row.all.draw,
          lost: row.all.lose,
          goalsFor: row.all.goals.for,
          goalsAgainst: row.all.goals.against,
          goalDiff: row.goalsDiff,
          form: row.form ?? null,
          description: row.description ?? null,
          sourceUpdatedAt: new Date(),
        },
        create: {
          seasonId: season.id,
          teamId: team.id,
          rank: row.rank,
          points: row.points,
          played: row.all.played,
          won: row.all.win,
          drawn: row.all.draw,
          lost: row.all.lose,
          goalsFor: row.all.goals.for,
          goalsAgainst: row.all.goals.against,
          goalDiff: row.goalsDiff,
          form: row.form ?? null,
          groupName,
          description: row.description ?? null,
          sourceUpdatedAt: new Date(),
        },
      });
      rows += 1;
    }
  }

  return { rows };
}
