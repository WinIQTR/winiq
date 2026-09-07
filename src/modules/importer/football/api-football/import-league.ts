import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type ApiFootballLeague = {
  league: {
    id: number;
    name: string;
    type?: string;
    logo?: string;
  };
  country: {
    name: string;
    code?: string | null;
    flag?: string | null;
  };
  seasons: Array<{
    year: number;
    start?: string;
    end?: string;
    current: boolean;
  }>;
};

export type ImportLeagueResult = {
  country: {
    id: number;
    name: string;
  };
  league: {
    id: number;
    apiId: number;
    name: string;
  };
  seasonsImported: number;
};

function parseOptionalDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function importLeagueFromApiFootball(
  apiLeagueId: number,
): Promise<ImportLeagueResult> {
  if (!Number.isInteger(apiLeagueId) || apiLeagueId <= 0) {
    throw new Error("Geçerli bir API lig ID değeri girilmelidir.");
  }

  const data = await apiFootballRequest<ApiFootballLeague[]>("leagues", {
    id: apiLeagueId,
  });

  const sourceLeague = data.response[0];

  if (!sourceLeague) {
    throw new Error(
      `API-Football üzerinde ${apiLeagueId} ID değerine sahip lig bulunamadı.`,
    );
  }

  const country = await prisma.country.upsert({
    where: {
      name: sourceLeague.country.name,
    },
    update: {
      code: sourceLeague.country.code ?? undefined,
      flagUrl: sourceLeague.country.flag ?? undefined,
    },
    create: {
      name: sourceLeague.country.name,
      code: sourceLeague.country.code ?? undefined,
      flagUrl: sourceLeague.country.flag ?? undefined,
    },
  });

  const league = await prisma.league.upsert({
    where: {
      apiId: sourceLeague.league.id,
    },
    update: {
      name: sourceLeague.league.name,
      type: sourceLeague.league.type,
      logoUrl: sourceLeague.league.logo,
      countryId: country.id,
    },
    create: {
      apiId: sourceLeague.league.id,
      name: sourceLeague.league.name,
      type: sourceLeague.league.type,
      logoUrl: sourceLeague.league.logo,
      countryId: country.id,
    },
  });

  for (const sourceSeason of sourceLeague.seasons) {
    await prisma.season.upsert({
      where: {
        leagueId_year: {
          leagueId: league.id,
          year: sourceSeason.year,
        },
      },
      update: {
        startDate: parseOptionalDate(sourceSeason.start),
        endDate: parseOptionalDate(sourceSeason.end),
        isCurrent: sourceSeason.current,
      },
      create: {
        leagueId: league.id,
        year: sourceSeason.year,
        startDate: parseOptionalDate(sourceSeason.start),
        endDate: parseOptionalDate(sourceSeason.end),
        isCurrent: sourceSeason.current,
      },
    });
  }

  return {
    country: {
      id: country.id,
      name: country.name,
    },
    league: {
      id: league.id,
      apiId: league.apiId,
      name: league.name,
    },
    seasonsImported: sourceLeague.seasons.length,
  };
}