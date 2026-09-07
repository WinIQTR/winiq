import {
  DataAvailabilityStatus,
  DataProviderCode,
  ExternalEntityType,
  ImportRunStatus,
  MatchStatus,
} from "@/generated/prisma/client";
import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type ApiFootballFixtureResponse = {
  fixture: {
    id: number;
    referee?: string | null;
    timezone?: string | null;
    date: string;
    timestamp?: number;
    periods?: {
      first?: number | null;
      second?: number | null;
    };
    venue?: {
      id?: number | null;
      name?: string | null;
      city?: string | null;
    };
    status: {
      long?: string;
      short?: string;
      elapsed?: number | null;
      extra?: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country?: string;
    season: number;
    round?: string | null;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo?: string | null;
      winner?: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo?: string | null;
      winner?: boolean | null;
    };
  };
  goals: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: {
      home?: number | null;
      away?: number | null;
    };
    fulltime?: {
      home?: number | null;
      away?: number | null;
    };
    extratime?: {
      home?: number | null;
      away?: number | null;
    };
    penalty?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

export type ImportFixturesResult = {
  league: {
    id: number;
    apiId: number;
    name: string;
  };
  season: number;
  fixturesReceived: number;
  fixturesCreated: number;
  fixturesUpdated: number;
  fixturesSkipped: number;
  finishedFixtures: number;
  scheduledFixtures: number;
  liveFixtures: number;
  postponedFixtures: number;
  cancelledFixtures: number;
  staleFixturesCancelled: number;
  skippedReasons: string[];
};

function mapFixtureStatus(statusCode?: string): MatchStatus {
  switch (statusCode) {
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
    case "INT":
      return MatchStatus.LIVE;

    case "FT":
    case "AET":
    case "PEN":
    case "AWD":
    case "WO":
      return MatchStatus.FINISHED;

    case "PST":
      return MatchStatus.POSTPONED;

    case "CANC":
    case "ABD":
    case "SUSP":
      return MatchStatus.CANCELLED;

    case "TBD":
    case "NS":
    default:
      return MatchStatus.SCHEDULED;
  }
}

function parseKickoffDate(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Geçersiz maç tarihi alındı: ${value}`);
  }

  return date;
}

function getScoreValue(
  primary: number | null | undefined,
  fallback: number | null | undefined,
): number | null {
  if (typeof primary === "number") {
    return primary;
  }

  if (typeof fallback === "number") {
    return fallback;
  }

  return null;
}

export async function importFixturesFromApiFootball(
  apiLeagueId: number,
  seasonYear: number,
): Promise<ImportFixturesResult> {
  if (!Number.isInteger(apiLeagueId) || apiLeagueId <= 0) {
    throw new Error("leagueId pozitif bir tam sayı olmalıdır.");
  }

  if (
    !Number.isInteger(seasonYear) ||
    seasonYear < 2000 ||
    seasonYear > 2100
  ) {
    throw new Error("season geçerli bir yıl olmalıdır.");
  }

  const dataSource = await prisma.dataSource.findUnique({
    where: {
      code: DataProviderCode.API_FOOTBALL,
    },
  });

  if (!dataSource) {
    throw new Error(
      "API_FOOTBALL veri kaynağı bulunamadı. Önce prisma db seed çalıştırılmalıdır.",
    );
  }

  const league = await prisma.league.findUnique({
    where: {
      apiId: apiLeagueId,
    },
    include: {
      seasons: true,
    },
  });

  if (!league) {
    throw new Error(
      `${apiLeagueId} API ID değerine sahip lig bulunamadı. Önce lig importu yapılmalıdır.`,
    );
  }

  const season = league.seasons.find(
    (item) => item.year === seasonYear,
  );

  if (!season) {
    throw new Error(
      `${league.name} için ${seasonYear} sezonu veritabanında bulunamadı.`,
    );
  }

  const importRun = await prisma.importRun.create({
    data: {
      dataSourceId: dataSource.id,
      entityType: ExternalEntityType.MATCH,
      operation: "IMPORT_FIXTURES",
      requestedLeagueId: apiLeagueId,
      requestedSeason: seasonYear,
      status: ImportRunStatus.RUNNING,
      requestCount: 1,
    },
  });

  let fixturesCreated = 0;
  let fixturesUpdated = 0;
  let fixturesSkipped = 0;

  let finishedFixtures = 0;
  let scheduledFixtures = 0;
  let liveFixtures = 0;
  let postponedFixtures = 0;
  let cancelledFixtures = 0;
  let staleFixturesCancelled = 0;

  const skippedReasons: string[] = [];

  try {
    const data = await apiFootballRequest<ApiFootballFixtureResponse[]>(
      "fixtures",
      {
        league: apiLeagueId,
        season: seasonYear,
      },
    );

    for (const source of data.response) {
      const homeTeam = await prisma.team.findUnique({
        where: {
          apiId: source.teams.home.id,
        },
      });

      const awayTeam = await prisma.team.findUnique({
        where: {
          apiId: source.teams.away.id,
        },
      });

      if (!homeTeam || !awayTeam) {
        fixturesSkipped += 1;

        const reason =
          `Fixture ${source.fixture.id} atlandı: ` +
          `${!homeTeam ? source.teams.home.name : ""}` +
          `${!homeTeam && !awayTeam ? " ve " : ""}` +
          `${!awayTeam ? source.teams.away.name : ""}` +
          " takım kaydı bulunamadı.";

        skippedReasons.push(reason);

        continue;
      }

      const existingMatch = await prisma.match.findUnique({
        where: {
          apiId: source.fixture.id,
        },
        select: {
          id: true,
        },
      });

      const status = mapFixtureStatus(
        source.fixture.status.short,
      );

      switch (status) {
        case MatchStatus.FINISHED:
          finishedFixtures += 1;
          break;
        case MatchStatus.LIVE:
          liveFixtures += 1;
          break;
        case MatchStatus.POSTPONED:
          postponedFixtures += 1;
          break;
        case MatchStatus.CANCELLED:
          cancelledFixtures += 1;
          break;
        case MatchStatus.SCHEDULED:
        default:
          scheduledFixtures += 1;
          break;
      }

      const homeScore = getScoreValue(
        source.score?.fulltime?.home,
        source.goals.home,
      );

      const awayScore = getScoreValue(
        source.score?.fulltime?.away,
        source.goals.away,
      );

      const match = await prisma.match.upsert({
        where: {
          apiId: source.fixture.id,
        },
        update: {
          seasonId: season.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          round: source.league.round ?? undefined,
          kickoffAt: parseKickoffDate(source.fixture.date),
          status,
          homeScore,
          awayScore,
          statusShort: source.fixture.status.short ?? undefined,
          elapsedMinutes: source.fixture.status.elapsed ?? undefined,
          referee: source.fixture.referee ?? undefined,
          venueName: source.fixture.venue?.name ?? undefined,
          venueCity: source.fixture.venue?.city ?? undefined,
          halfTimeHomeScore: source.score?.halftime?.home ?? undefined,
          halfTimeAwayScore: source.score?.halftime?.away ?? undefined,
          extraTimeHomeScore: source.score?.extratime?.home ?? undefined,
          extraTimeAwayScore: source.score?.extratime?.away ?? undefined,
          penaltyHomeScore: source.score?.penalty?.home ?? undefined,
          penaltyAwayScore: source.score?.penalty?.away ?? undefined,
        },
        create: {
          apiId: source.fixture.id,
          seasonId: season.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          round: source.league.round ?? undefined,
          kickoffAt: parseKickoffDate(source.fixture.date),
          status,
          homeScore,
          awayScore,
          statusShort: source.fixture.status.short ?? undefined,
          elapsedMinutes: source.fixture.status.elapsed ?? undefined,
          referee: source.fixture.referee ?? undefined,
          venueName: source.fixture.venue?.name ?? undefined,
          venueCity: source.fixture.venue?.city ?? undefined,
          halfTimeHomeScore: source.score?.halftime?.home ?? undefined,
          halfTimeAwayScore: source.score?.halftime?.away ?? undefined,
          extraTimeHomeScore: source.score?.extratime?.home ?? undefined,
          extraTimeAwayScore: source.score?.extratime?.away ?? undefined,
          penaltyHomeScore: source.score?.penalty?.home ?? undefined,
          penaltyAwayScore: source.score?.penalty?.away ?? undefined,
        },
      });

      if (existingMatch) {
        fixturesUpdated += 1;
      } else {
        fixturesCreated += 1;
      }

      await prisma.sourceEntityMap.upsert({
        where: {
          dataSourceId_entityType_externalId: {
            dataSourceId: dataSource.id,
            entityType: ExternalEntityType.MATCH,
            externalId: String(source.fixture.id),
          },
        },
        update: {
          internalEntityId: match.id,
          externalName:
            `${source.teams.home.name} - ${source.teams.away.name}`,
          confidenceScore: 100,
          isVerified: true,
          lastSeenAt: new Date(),
        },
        create: {
          dataSourceId: dataSource.id,
          entityType: ExternalEntityType.MATCH,
          externalId: String(source.fixture.id),
          internalEntityId: match.id,
          externalName:
            `${source.teams.home.name} - ${source.teams.away.name}`,
          confidenceScore: 100,
          isVerified: true,
        },
      });

      await prisma.dataCoverage.upsert({
        where: {
          dataSourceId_entityType_entityId: {
            dataSourceId: dataSource.id,
            entityType: "MATCH",
            entityId: match.id,
          },
        },
        update: {
          fixturesStatus: DataAvailabilityStatus.AVAILABLE,
          resultsStatus:
            status === MatchStatus.FINISHED
              ? DataAvailabilityStatus.AVAILABLE
              : DataAvailabilityStatus.NOT_CHECKED,
          lastCheckedAt: new Date(),
          dataUpdatedAt: new Date(),
        },
        create: {
          dataSourceId: dataSource.id,
          entityType: "MATCH",
          entityId: match.id,
          fixturesStatus: DataAvailabilityStatus.AVAILABLE,
          resultsStatus:
            status === MatchStatus.FINISHED
              ? DataAvailabilityStatus.AVAILABLE
              : DataAvailabilityStatus.NOT_CHECKED,
          coverageScore:
            status === MatchStatus.FINISHED ? 20 : 10,
          lastCheckedAt: new Date(),
          dataUpdatedAt: new Date(),
        },
      });
    }

    /*
     * API-Football occasionally replaces a provisional fixture with a new
     * fixture id when UEFA publishes the final calendar. Upsert alone leaves
     * the withdrawn provisional row active forever. A league+season fixture
     * response is a complete list, so future scheduled rows absent from that
     * authoritative response must no longer be offered as upcoming matches.
     */
    if (data.response.length > 0) {
      const receivedFixtureIds = data.response.map((source) => source.fixture.id);
      const staleResult = await prisma.match.updateMany({
        where: {
          seasonId: season.id,
          status: MatchStatus.SCHEDULED,
          kickoffAt: { gt: new Date() },
          apiId: { notIn: receivedFixtureIds },
        },
        data: {
          status: MatchStatus.CANCELLED,
          statusShort: "REMOVED_FROM_FEED",
        },
      });

      staleFixturesCancelled = staleResult.count;
    }

    const finalStatus =
      fixturesSkipped > 0
        ? ImportRunStatus.PARTIAL
        : data.response.length === 0
          ? ImportRunStatus.NO_DATA
          : ImportRunStatus.SUCCESS;

    await prisma.importRun.update({
      where: {
        id: importRun.id,
      },
      data: {
        status: finalStatus,
        recordsReceived: data.response.length,
        recordsCreated: fixturesCreated,
        recordsUpdated: fixturesUpdated,
        recordsSkipped: fixturesSkipped,
        finishedAt: new Date(),
        metadata: {
          finishedFixtures,
          scheduledFixtures,
          liveFixtures,
          postponedFixtures,
          cancelledFixtures,
          staleFixturesCancelled,
          skippedReasons: skippedReasons.slice(0, 50),
        },
      },
    });

    return {
      league: {
        id: league.id,
        apiId: league.apiId,
        name: league.name,
      },
      season: seasonYear,
      fixturesReceived: data.response.length,
      fixturesCreated,
      fixturesUpdated,
      fixturesSkipped,
      finishedFixtures,
      scheduledFixtures,
      liveFixtures,
      postponedFixtures,
      cancelledFixtures,
      staleFixturesCancelled,
      skippedReasons,
    };
  } catch (error) {
    await prisma.importRun.update({
      where: {
        id: importRun.id,
      },
      data: {
        status: ImportRunStatus.FAILED,
        recordsCreated: fixturesCreated,
        recordsUpdated: fixturesUpdated,
        recordsSkipped: fixturesSkipped,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Bilinmeyen fixture import hatası.",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}
