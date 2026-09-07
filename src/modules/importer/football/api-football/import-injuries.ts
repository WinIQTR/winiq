import {
  apiFootballRequest,
} from "@/lib/api-football/client";

import {
  prisma,
} from "@/lib/prisma";

import type {
  InjuryStatus,
} from "@/generated/prisma/enums";

type ApiFootballInjuryResponse = {
  player: {
    id: number;
    name: string;
    photo?: string | null;
    type?: string | null;
    reason?: string | null;
  };

  team: {
    id: number;
    name: string;
  };

  fixture?: {
    id?: number | null;
    date?: string | null;
  } | null;

  league: {
    id: number;
    season: number;
  };
};

export type ImportInjuriesResult = {
  apiRequests: number;
  rowsReceived: number;
  created: number;
  updated: number;
  skippedUnknownPlayer: number;
  skippedUnknownTeam: number;
};

function resolveInjuryStatus(
  type: string | null | undefined,
): InjuryStatus {
  const normalized =
    (type ?? "").toUpperCase();

  if (normalized.includes("DOUBT")) {
    return "DOUBTFUL";
  }

  if (
    normalized.includes("SUSPEND") ||
    normalized.includes("MISSING FIXTURE")
  ) {
    // API-Football's /injuries endpoint also returns suspensions under
    // the same "Missing Fixture" umbrella; we still record them here as
    // an availability signal even though they aren't a physical injury.
    return "UNKNOWN";
  }

  if (normalized.length > 0) {
    return "INJURED";
  }

  return "UNKNOWN";
}

/**
 * Belirtilen lig + sezon için sakatlık/eksik oyuncu kayıtlarını
 * API-Football'dan çeker ve Injury tablosuna yazar.
 *
 * Not: API-Football'un /injuries endpoint'i bir "fixture" veya
 * "team + season" kombinasyonu ister; burada ligdeki tüm takımlar
 * için (mevcut fixture kayıtlarından türetilerek) team+season bazlı
 * sorgu yapılır — import-players.ts ile aynı desen.
 */
export async function importInjuriesFromApiFootball(
  apiLeagueId: number,
  seasonYear: number,
): Promise<ImportInjuriesResult> {
  if (
    !Number.isInteger(apiLeagueId) ||
    apiLeagueId <= 0
  ) {
    throw new Error(
      "Geçerli bir lig API ID değeri girilmelidir.",
    );
  }

  if (
    !Number.isInteger(seasonYear) ||
    seasonYear < 1900
  ) {
    throw new Error(
      "Geçerli bir sezon yılı girilmelidir.",
    );
  }

  const league =
    await prisma.league.findUnique({
      where: {
        apiId: apiLeagueId,
      },

      include: {
        seasons: true,
      },
    });

  if (!league) {
    throw new Error(
      `${apiLeagueId} API ID değerine sahip lig veritabanında bulunamadı.`,
    );
  }

  const season =
    league.seasons.find(
      (item) => item.year === seasonYear,
    );

  if (!season) {
    throw new Error(
      `${seasonYear} sezonu ${league.name} için veritabanında bulunamadı.`,
    );
  }

  const matches =
    await prisma.match.findMany({
      where: {
        seasonId: season.id,
      },

      select: {
        homeTeam: {
          select: { id: true, apiId: true, name: true },
        },
        awayTeam: {
          select: { id: true, apiId: true, name: true },
        },
      },
    });

  const teamsById = new Map<
    number,
    { id: number; apiId: number; name: string }
  >();

  for (const match of matches) {
    teamsById.set(match.homeTeam.id, match.homeTeam);
    teamsById.set(match.awayTeam.id, match.awayTeam);
  }

  const teams = [...teamsById.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  if (teams.length === 0) {
    throw new Error(
      `${league.name} ${seasonYear} sezonu için takım bulunamadı.`,
    );
  }

  let apiRequests = 0;
  let rowsReceived = 0;
  let created = 0;
  let updated = 0;
  let skippedUnknownPlayer = 0;
  let skippedUnknownTeam = 0;

  for (const team of teams) {
    const data =
      await apiFootballRequest<ApiFootballInjuryResponse[]>(
        "injuries",
        {
          league: apiLeagueId,
          season: seasonYear,
          team: team.apiId,
        },
      );

    apiRequests += 1;
    rowsReceived += data.response.length;

    for (const source of data.response) {
      const player =
        await prisma.player.findUnique({
          where: { apiId: source.player.id },
          select: { id: true },
        });

      if (!player) {
        skippedUnknownPlayer += 1;
        continue;
      }

      const dbTeam =
        await prisma.team.findUnique({
          where: { apiId: source.team.id },
          select: { id: true },
        });

      if (!dbTeam) {
        skippedUnknownTeam += 1;
        continue;
      }

      let matchId: number | null = null;

      if (source.fixture?.id) {
        const match =
          await prisma.match.findUnique({
            where: { apiId: source.fixture.id },
            select: { id: true },
          });

        matchId = match?.id ?? null;
      }

      const status = resolveInjuryStatus(source.player.type);

      const existing =
        await prisma.injury.findFirst({
          where: {
            playerId: player.id,
            teamId: dbTeam.id,
            matchId,
          },
          select: { id: true },
        });

      if (existing) {
        await prisma.injury.update({
          where: { id: existing.id },
          data: {
            injuryType: source.player.type ?? null,
            status,
            source: "API_FOOTBALL",
          },
        });

        updated += 1;
      } else {
        await prisma.injury.create({
          data: {
            playerId: player.id,
            teamId: dbTeam.id,
            matchId,
            injuryType: source.player.type ?? null,
            status,
            startDate: source.fixture?.date
              ? new Date(source.fixture.date)
              : null,
            source: "API_FOOTBALL",
          },
        });

        created += 1;
      }
    }
  }

  return {
    apiRequests,
    rowsReceived,
    created,
    updated,
    skippedUnknownPlayer,
    skippedUnknownTeam,
  };
}
