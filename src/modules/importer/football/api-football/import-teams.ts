import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type ApiFootballTeamResponse = {
  team: {
    id: number;
    name: string;
    code?: string | null;
    country?: string | null;
    founded?: number | null;
    national?: boolean;
    logo?: string | null;
  };
  venue?: {
    id?: number | null;
    name?: string | null;
    address?: string | null;
    city?: string | null;
    capacity?: number | null;
    surface?: string | null;
    image?: string | null;
  } | null;
};

export type ImportTeamsResult = {
  league: {
    id: number;
    apiId: number;
    name: string;
  };
  season: number;
  teamsReceived: number;
  teamsCreated: number;
  teamsUpdated: number;
  teamNames: string[];
};

export async function importTeamsFromApiFootball(
  apiLeagueId: number,
  seasonYear?: number,
): Promise<ImportTeamsResult> {
  if (!Number.isInteger(apiLeagueId) || apiLeagueId <= 0) {
    throw new Error("Geçerli bir lig ID değeri girilmelidir.");
  }

  const league = await prisma.league.findUnique({
    where: {
      apiId: apiLeagueId,
    },
    include: {
      seasons: {
        orderBy: {
          year: "desc",
        },
      },
      country: true,
    },
  });

  if (!league) {
    throw new Error(
      `${apiLeagueId} API ID değerine sahip lig veritabanında bulunamadı. Önce lig importu yapılmalıdır.`,
    );
  }

  const selectedSeason =
  seasonYear ??
  league.seasons
    .filter((season) => season.year <= 2024)
    .sort((a, b) => b.year - a.year)[0]?.year;

  if (!selectedSeason) {
    throw new Error("İçe aktarılacak sezon belirlenemedi.");
  }

  const seasonExists = league.seasons.some(
    (season) => season.year === selectedSeason,
  );

  if (!seasonExists) {
    throw new Error(
      `${selectedSeason} sezonu ${league.name} için veritabanında bulunamadı.`,
    );
  }

  const data = await apiFootballRequest<ApiFootballTeamResponse[]>("teams", {
    league: apiLeagueId,
    season: selectedSeason,
  });

  let teamsCreated = 0;
  let teamsUpdated = 0;
  const teamNames: string[] = [];

  for (const source of data.response) {
    const existingTeam = await prisma.team.findUnique({
      where: {
        apiId: source.team.id,
      },
      select: {
        id: true,
      },
    });

    await prisma.team.upsert({
      where: {
        apiId: source.team.id,
      },
      update: {
        name: source.team.name,
        shortName: source.team.name,
        code: source.team.code ?? undefined,
        logoUrl: source.team.logo ?? undefined,
        countryId: league.countryId ?? undefined,
        founded: source.team.founded ?? undefined,
        national: source.team.national ?? false,
        venueApiId: source.venue?.id ?? undefined,
        venueName: source.venue?.name ?? undefined,
        venueAddress: source.venue?.address ?? undefined,
        venueCity: source.venue?.city ?? undefined,
        venueCapacity: source.venue?.capacity ?? undefined,
        venueSurface: source.venue?.surface ?? undefined,
        venueImageUrl: source.venue?.image ?? undefined,
      },
      create: {
        apiId: source.team.id,
        name: source.team.name,
        shortName: source.team.name,
        code: source.team.code ?? undefined,
        logoUrl: source.team.logo ?? undefined,
        countryId: league.countryId ?? undefined,
        founded: source.team.founded ?? undefined,
        national: source.team.national ?? false,
        venueApiId: source.venue?.id ?? undefined,
        venueName: source.venue?.name ?? undefined,
        venueAddress: source.venue?.address ?? undefined,
        venueCity: source.venue?.city ?? undefined,
        venueCapacity: source.venue?.capacity ?? undefined,
        venueSurface: source.venue?.surface ?? undefined,
        venueImageUrl: source.venue?.image ?? undefined,
      },
    });

    if (existingTeam) {
      teamsUpdated += 1;
    } else {
      teamsCreated += 1;
    }

    teamNames.push(source.team.name);
  }

  return {
    league: {
      id: league.id,
      apiId: league.apiId,
      name: league.name,
    },
    season: selectedSeason,
    teamsReceived: data.response.length,
    teamsCreated,
    teamsUpdated,
    teamNames: teamNames.sort((a, b) => a.localeCompare(b)),
  };
}
