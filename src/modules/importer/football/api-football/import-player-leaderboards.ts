import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type PlayerLeaderboardKind = "TOP_SCORERS" | "TOP_ASSISTS" | "TOP_YELLOW" | "TOP_RED";

type TopPlayerRow = {
  player: { id: number; name: string };
  statistics: Array<{
    team?: { id: number } | null;
    goals?: { total?: number | null; assists?: number | null };
    cards?: { yellow?: number | null; red?: number | null };
  }>;
};

const KIND_ENDPOINT: Record<
  PlayerLeaderboardKind,
  { path: string; valueOf: (row: TopPlayerRow) => number }
> = {
  TOP_SCORERS: {
    path: "players/topscorers",
    valueOf: (row) => row.statistics[0]?.goals?.total ?? 0,
  },
  TOP_ASSISTS: {
    path: "players/topassists",
    valueOf: (row) => row.statistics[0]?.goals?.assists ?? 0,
  },
  TOP_YELLOW: {
    path: "players/topyellowcards",
    valueOf: (row) => row.statistics[0]?.cards?.yellow ?? 0,
  },
  TOP_RED: {
    path: "players/topredcards",
    valueOf: (row) => row.statistics[0]?.cards?.red ?? 0,
  },
};

export async function importPlayerLeaderboardsFromApiFootball(options: {
  leagueApiId: number;
  seasonYear: number;
  kinds?: PlayerLeaderboardKind[];
}): Promise<{ rows: number }> {
  const season = await prisma.season.findFirst({
    where: {
      year: options.seasonYear,
      league: { apiId: options.leagueApiId },
    },
    select: { id: true, leagueId: true },
  });
  if (!season) {
    throw new Error(`Season ${options.seasonYear} / league ${options.leagueApiId} not found.`);
  }

  const kinds = options.kinds ?? ["TOP_SCORERS", "TOP_ASSISTS"];
  let rows = 0;

  for (const kind of kinds) {
    const endpoint = KIND_ENDPOINT[kind];
    try {
      const data = await apiFootballRequest<TopPlayerRow[]>(endpoint.path, {
        league: options.leagueApiId,
        season: options.seasonYear,
      });
      const list = data.response ?? [];
      let rank = 0;
      for (const row of list.slice(0, 20)) {
        rank += 1;
        const player = await prisma.player.findUnique({
          where: { apiId: row.player.id },
          select: { id: true },
        });
        if (!player) continue;
        const teamApiId = row.statistics[0]?.team?.id;
        const team = teamApiId
          ? await prisma.team.findUnique({ where: { apiId: teamApiId }, select: { id: true } })
          : null;
        const value = endpoint.valueOf(row);
        await prisma.playerLeaderboardEntry.upsert({
          where: {
            seasonId_leagueId_kind_playerId: {
              seasonId: season.id,
              leagueId: season.leagueId,
              kind,
              playerId: player.id,
            },
          },
          update: {
            rank,
            teamId: team?.id ?? null,
            value,
            sourceUpdatedAt: new Date(),
          },
          create: {
            seasonId: season.id,
            leagueId: season.leagueId,
            kind,
            rank,
            playerId: player.id,
            teamId: team?.id ?? null,
            value,
            sourceUpdatedAt: new Date(),
          },
        });
        rows += 1;
      }
    } catch (error) {
      console.error("[importPlayerLeaderboards]", kind, error);
      break;
    }
  }

  return { rows };
}
