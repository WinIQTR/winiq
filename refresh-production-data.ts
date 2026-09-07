import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
  type TargetCompetition,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

type MatchStatusValue =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

type ApiFootballFixtureResponse = {
  errors:
    | Record<string, unknown>
    | unknown[];

  results: number;

  response: ApiFootballFixture[];
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;

    status: {
      short: string;
    };
  };

  league: {
    id: number;
    name: string;
    season: number;
    round: string | null;
  };

  teams: {
    home: {
      id: number;
      name: string;
      logo?: string | null;
    };

    away: {
      id: number;
      name: string;
      logo?: string | null;
    };
  };

  goals: {
    home: number | null;
    away: number | null;
  };
};

type CompetitionRefreshResult = {
  leagueApiId: number;
  leagueName: string;

  fixturesReceived: number;

  created: number;
  updated: number;
  skipped: number;
  failed: number;

  apiRequests: number;

  errorMessage: string | null;
};

const DEFAULT_DAYS_AHEAD =
  30;

const MAXIMUM_DAYS_AHEAD =
  60;

const DEFAULT_REQUEST_DELAY_MS =
  500;

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (
    !value
  ) {
    throw new Error(
      `${name} ortam değişkeni bulunamadı.`,
    );
  }

  return value;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (
    !value
  ) {
    return fallback;
  }

  const parsed =
    Number.parseInt(
      value,
      10,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <= 0 ||
    parsed > maximum
  ) {
    return fallback;
  }

  return parsed;
}

function getDaysAhead(): number {
  return parsePositiveInteger(
    process.env.PREDICTION_DAYS,
    DEFAULT_DAYS_AHEAD,
    MAXIMUM_DAYS_AHEAD,
  );
}

function getRequestDelayMs(): number {
  return parsePositiveInteger(
    process.env.API_REQUEST_DELAY_MS,
    DEFAULT_REQUEST_DELAY_MS,
    10_000,
  );
}

function getSeasonYear(): number {
  const rawValue =
    process.env
      .API_FOOTBALL_SEASON
      ?.trim();

  if (
    !rawValue
  ) {
    return ACTIVE_SEASON_YEAR;
  }

  const parsed =
    Number.parseInt(
      rawValue,
      10,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < 2000 ||
    parsed > 2100
  ) {
    throw new Error(
      "API_FOOTBALL_SEASON geçerli bir sezon yılı olmalıdır.",
    );
  }

  return parsed;
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (
      resolve,
    ) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function formatApiDate(
  value: Date,
): string {
  return value
    .toISOString()
    .slice(
      0,
      10,
    );
}

function resolveDateRange(
  daysAhead: number,
): {
  from: string;
  to: string;
} {
  const configuredFrom =
    process.env
      .FIXTURE_FROM
      ?.trim();

  const configuredTo =
    process.env
      .FIXTURE_TO
      ?.trim();

  const fromDate =
    configuredFrom
      ? new Date(
          `${configuredFrom}T00:00:00.000Z`,
        )
      : new Date();

  const toDate =
    configuredTo
      ? new Date(
          `${configuredTo}T23:59:59.999Z`,
        )
      : new Date(
          fromDate,
        );

  if (
    !configuredTo
  ) {
    toDate.setUTCDate(
      toDate.getUTCDate() +
        daysAhead,
    );
  }

  if (
    Number.isNaN(
      fromDate.getTime(),
    ) ||
    Number.isNaN(
      toDate.getTime(),
    )
  ) {
    throw new Error(
      "FIXTURE_FROM veya FIXTURE_TO tarihi geçersiz.",
    );
  }

  if (
    fromDate >
    toDate
  ) {
    throw new Error(
      "FIXTURE_FROM tarihi FIXTURE_TO tarihinden sonra olamaz.",
    );
  }

  return {
    from:
      formatApiDate(
        fromDate,
      ),

    to:
      formatApiDate(
        toDate,
      ),
  };
}

function mapFixtureStatus(
  status: string,
): MatchStatusValue {
  if (
    [
      "TBD",
      "NS",
    ].includes(
      status,
    )
  ) {
    return "SCHEDULED";
  }

  if (
    [
      "1H",
      "HT",
      "2H",
      "ET",
      "BT",
      "P",
      "SUSP",
      "INT",
      "LIVE",
    ].includes(
      status,
    )
  ) {
    return "LIVE";
  }

  if (
    [
      "FT",
      "AET",
      "PEN",
    ].includes(
      status,
    )
  ) {
    return "FINISHED";
  }

  if (
    status ===
    "PST"
  ) {
    return "POSTPONED";
  }

  if (
    [
      "CANC",
      "ABD",
      "AWD",
      "WO",
    ].includes(
      status,
    )
  ) {
    return "CANCELLED";
  }

  return "SCHEDULED";
}

function hasApiErrors(
  errors:
    | Record<string, unknown>
    | unknown[]
    | undefined,
): boolean {
  if (
    Array.isArray(
      errors,
    )
  ) {
    return (
      errors.length >
      0
    );
  }

  if (
    errors &&
    typeof errors ===
      "object"
  ) {
    return (
      Object.keys(
        errors,
      ).length >
      0
    );
  }

  return false;
}

async function fetchCompetitionFixtures(
  options: {
    apiKey: string;
    baseUrl: string;

    leagueApiId: number;
    seasonYear: number;

    from: string;
    to: string;
  },
): Promise<ApiFootballFixtureResponse> {
  const url =
    new URL(
      "/fixtures",
      options.baseUrl,
    );

  url.searchParams.set(
    "league",
    String(
      options.leagueApiId,
    ),
  );

  url.searchParams.set(
    "season",
    String(
      options.seasonYear,
    ),
  );

  url.searchParams.set(
    "from",
    options.from,
  );

  url.searchParams.set(
    "to",
    options.to,
  );

  url.searchParams.set(
    "timezone",
    "Europe/Istanbul",
  );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          "x-apisports-key":
            options.apiKey,
        },
      },
    );

  if (
    !response.ok
  ) {
    const body =
      await response.text();

    throw new Error(
      [
        "API-Football fikstür isteği başarısız.",
        `HTTP ${response.status}.`,
        body,
      ].join(
        " ",
      ),
    );
  }

  return response.json() as Promise<ApiFootballFixtureResponse>;
}

async function ensureTeam(
  apiTeam: {
    id: number;
    name: string;
    logo?: string | null;
  },
): Promise<{
  id: number;
}> {
  return prisma.team.upsert({
    where: {
      apiId:
        apiTeam.id,
    },

    create: {
      apiId:
        apiTeam.id,

      name:
        apiTeam.name,

      logoUrl:
        apiTeam.logo ??
        null,
    },

    update: {
      name:
        apiTeam.name,

      logoUrl:
        apiTeam.logo ??
        undefined,
    },

    select: {
      id:
        true,
    },
  });
}

async function refreshCompetition(
  options: {
    competition:
      TargetCompetition;

    apiKey: string;
    baseUrl: string;

    seasonYear: number;

    from: string;
    to: string;
  },
): Promise<CompetitionRefreshResult> {
  const result:
    CompetitionRefreshResult = {
    leagueApiId:
      options
        .competition
        .apiId,

    leagueName:
      options
        .competition
        .name,

    fixturesReceived:
      0,

    created:
      0,

    updated:
      0,

    skipped:
      0,

    failed:
      0,

    apiRequests:
      0,

    errorMessage:
      null,
  };

  console.log("");
  console.log(
    "----------------------------------------------",
  );

  console.log(
    `${options.competition.name} (${options.competition.apiId})`,
  );

  console.log(
    "----------------------------------------------",
  );

  try {
    const apiResult =
      await fetchCompetitionFixtures({
        apiKey:
          options.apiKey,

        baseUrl:
          options.baseUrl,

        leagueApiId:
          options
            .competition
            .apiId,

        seasonYear:
          options.seasonYear,

        from:
          options.from,

        to:
          options.to,
      });

    result.apiRequests +=
      1;

    if (
      hasApiErrors(
        apiResult.errors,
      )
    ) {
      throw new Error(
        `API-Football hata döndürdü: ${JSON.stringify(apiResult.errors)}`,
      );
    }

    if (
      !Array.isArray(
        apiResult.response,
      )
    ) {
      throw new Error(
        "API-Football response alanı geçerli değil.",
      );
    }

    result.fixturesReceived =
      apiResult.response.length;

    console.log(
      `API maç sayısı: ${result.fixturesReceived}`,
    );

    if (
      apiResult.response.length ===
      0
    ) {
      console.log(
        "Bu tarih aralığında maç bulunamadı.",
      );

      return result;
    }

    const seasonRecord =
      await prisma.season.findFirst({
        where: {
          year:
            options.seasonYear,

          league: {
            apiId:
              options
                .competition
                .apiId,
          },
        },

        select: {
          id:
            true,
        },
      });

    if (
      !seasonRecord
    ) {
      result.skipped =
        apiResult.response.length;

      result.errorMessage =
        [
          "Season kaydı bulunamadı.",
          `league=${options.competition.apiId}`,
          `season=${options.seasonYear}`,
          "Önce bootstrap-target-competitions çalıştırılmalı.",
        ].join(
          " ",
        );

      console.log(
        `ATLANDI: ${result.errorMessage}`,
      );

      return result;
    }

    for (
      const fixture
      of apiResult.response
    ) {
      try {
        const [
          homeTeam,
          awayTeam,
          existingMatch,
        ] =
          await Promise.all([
            ensureTeam(
              fixture.teams.home,
            ),

            ensureTeam(
              fixture.teams.away,
            ),

            prisma.match.findUnique({
              where: {
                apiId:
                  fixture.fixture.id,
              },

              select: {
                id:
                  true,
              },
            }),
          ]);

        const kickoffAt =
          new Date(
            fixture.fixture.date,
          );

        if (
          Number.isNaN(
            kickoffAt.getTime(),
          )
        ) {
          console.log(
            `ATLANDI: Geçersiz tarih — ${fixture.teams.home.name} - ${fixture.teams.away.name}`,
          );

          result.skipped +=
            1;

          continue;
        }

        await prisma.match.upsert({
          where: {
            apiId:
              fixture.fixture.id,
          },

          create: {
            apiId:
              fixture.fixture.id,

            seasonId:
              seasonRecord.id,

            homeTeamId:
              homeTeam.id,

            awayTeamId:
              awayTeam.id,

            round:
              fixture
                .league
                .round,

            kickoffAt,

            status:
              mapFixtureStatus(
                fixture
                  .fixture
                  .status
                  .short,
              ),

            homeScore:
              fixture
                .goals
                .home,

            awayScore:
              fixture
                .goals
                .away,
          },

          update: {
            seasonId:
              seasonRecord.id,

            homeTeamId:
              homeTeam.id,

            awayTeamId:
              awayTeam.id,

            round:
              fixture
                .league
                .round,

            kickoffAt,

            status:
              mapFixtureStatus(
                fixture
                  .fixture
                  .status
                  .short,
              ),

            homeScore:
              fixture
                .goals
                .home,

            awayScore:
              fixture
                .goals
                .away,
          },
        });

        if (
          existingMatch
        ) {
          result.updated +=
            1;
        } else {
          result.created +=
            1;
        }

        console.log(
          [
            existingMatch
              ? "GÜNCELLENDİ"
              : "EKLENDİ",

            `${fixture.teams.home.name} - ${fixture.teams.away.name}`,
          ].join(
            ": ",
          ),
        );
      } catch (
        error: unknown
      ) {
        result.failed +=
          1;

        console.error(
          [
            "HATA",
            `${fixture.teams.home.name} - ${fixture.teams.away.name}`,
            error instanceof Error
              ? error.message
              : String(
                  error,
                ),
          ].join(
            ": ",
          ),
        );
      }
    }

    return result;
  } catch (
    error: unknown
  ) {
    result.errorMessage =
      error instanceof Error
        ? error.message
        : String(
            error,
          );

    console.error(
      `Organizasyon aktarımı başarısız: ${result.errorMessage}`,
    );

    return result;
  }
}

async function main(): Promise<void> {
  const apiKey =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_KEY",
    );

  const baseUrl =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_BASE_URL",
    );

  const seasonYear =
    getSeasonYear();

  const daysAhead =
    getDaysAhead();

  const requestDelayMs =
    getRequestDelayMs();

  const {
    from,
    to,
  } =
    resolveDateRange(
      daysAhead,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRODUCTION DATA REFRESH",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Sezon:
      seasonYear,

    "Başlangıç tarihi":
      from,

    "Bitiş tarihi":
      to,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    "API bekleme":
      `${requestDelayMs} ms`,
  });

  const results:
    CompetitionRefreshResult[] =
      [];

  for (
    let index = 0;
    index <
    ACTIVE_COMPETITIONS.length;
    index++
  ) {
    const competition =
      ACTIVE_COMPETITIONS[index];

    const result =
      await refreshCompetition({
        competition,

        apiKey,
        baseUrl,

        seasonYear,

        from,
        to,
      });

    results.push(
      result,
    );

    if (
      index <
      ACTIVE_COMPETITIONS.length -
        1
    ) {
      await sleep(
        requestDelayMs,
      );
    }
  }

  const totals =
    results.reduce(
      (
        total,
        result,
      ) => ({
        fixturesReceived:
          total.fixturesReceived +
          result.fixturesReceived,

        created:
          total.created +
          result.created,

        updated:
          total.updated +
          result.updated,

        skipped:
          total.skipped +
          result.skipped,

        failed:
          total.failed +
          result.failed,

        apiRequests:
          total.apiRequests +
          result.apiRequests,

        competitionErrors:
          total.competitionErrors +
          (
            result.errorMessage
              ? 1
              : 0
          ),
      }),

      {
        fixturesReceived:
          0,

        created:
          0,

        updated:
          0,

        skipped:
          0,

        failed:
          0,

        apiRequests:
          0,

        competitionErrors:
          0,
      },
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ORGANIZATION RESULTS",
  );

  console.log(
    "==============================================",
  );

  console.table(
    results.map(
      (
        result,
      ) => ({
        Lig:
          result.leagueName,

        "API ID":
          result.leagueApiId,

        Gelen:
          result.fixturesReceived,

        Yeni:
          result.created,

        Güncellenen:
          result.updated,

        Atlanan:
          result.skipped,

        Hatalı:
          result.failed,

        Durum:
          result.errorMessage
            ? "UYARI"
            : "OK",
      }),
    ),
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "REFRESH SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "API isteği":
      totals.apiRequests,

    "API maç":
      totals.fixturesReceived,

    "Yeni maç":
      totals.created,

    "Güncellenen maç":
      totals.updated,

    "Atlanan maç":
      totals.skipped,

    "Hatalı maç":
      totals.failed,

    "Organizasyon uyarısı":
      totals.competitionErrors,
  });

  if (
    totals.failed >
      0 ||
    totals.competitionErrors >
      0
  ) {
    console.log("");
    console.log(
      "Refresh tamamlandı ancak bazı kayıtlar için uyarı oluştu.",
    );

    process.exitCode =
      2;
  } else {
    console.log("");
    console.log(
      "Production veri yenileme başarıyla tamamlandı.",
    );
  }
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Production refresh başarısız.",
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );