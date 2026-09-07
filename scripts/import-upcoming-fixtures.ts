import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

type ApiFootballFixtureResponse = {
  errors:
    Record<string, unknown>;

  results:
    number;

  response:
    Array<{
      fixture: {
        id:
          number;

        date:
          string;

        status: {
          short:
            string;
        };
      };

      league: {
        id:
          number;

        season:
          number;

        round:
          string | null;
      };

      teams: {
        home: {
          id:
            number;

          name:
            string;
        };

        away: {
          id:
            number;

          name:
            string;
        };
      };

      goals: {
        home:
          number | null;

        away:
          number | null;
      };
    }>;
};

type InternalMatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

type CompetitionImportResult = {
  apiId:
    number;

  competition:
    string;

  received:
    number;

  created:
    number;

  updated:
    number;

  finished:
    number;

  live:
    number;

  scheduled:
    number;

  postponed:
    number;

  cancelled:
    number;

  skipped:
    number;

  failed:
    number;
};

const DEFAULT_DAYS_AHEAD =
  30;

const DEFAULT_LOOKBACK_DAYS =
  7;

const DEFAULT_REQUEST_DELAY_MS =
  250;

function getRequiredEnvironmentVariable(
  name:
    string,
): string {
  const value =
    process.env[
      name
    ]?.trim();

  if (
    !value
  ) {
    throw new Error(
      `${name} environment değişkeni bulunamadı.`,
    );
  }

  return value;
}

function parsePositiveIntegerEnvironmentVariable(
  options: {
    name:
      string;

    fallback:
      number;

    minimum:
      number;

    maximum:
      number;
  },
): number {
  const rawValue =
    process.env[
      options.name
    ]?.trim();

  if (
    !rawValue
  ) {
    return options.fallback;
  }

  const parsedValue =
    Number.parseInt(
      rawValue,
      10,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue <
      options.minimum ||
    parsedValue >
      options.maximum
  ) {
    console.warn(
      [
        `${options.name} geçersiz.`,
        `Fallback=${options.fallback}`,
      ].join(
        " ",
      ),
    );

    return options.fallback;
  }

  return parsedValue;
}

function getDaysAhead():
  number {
  return (
    parsePositiveIntegerEnvironmentVariable({
      name:
        "PREDICTION_DAYS",

      fallback:
        DEFAULT_DAYS_AHEAD,

      minimum:
        1,

      maximum:
        90,
    })
  );
}

function getLookbackDays():
  number {
  return (
    parsePositiveIntegerEnvironmentVariable({
      name:
        "FIXTURE_LOOKBACK_DAYS",

      fallback:
        DEFAULT_LOOKBACK_DAYS,

      minimum:
        1,

      maximum:
        30,
    })
  );
}

function getRequestDelayMs():
  number {
  return (
    parsePositiveIntegerEnvironmentVariable({
      name:
        "FIXTURE_REQUEST_DELAY_MS",

      fallback:
        DEFAULT_REQUEST_DELAY_MS,

      minimum:
        50,

      maximum:
        5000,
    })
  );
}

function formatApiDate(
  date:
    Date,
): string {
  return (
    date
      .toISOString()
      .slice(
        0,
        10,
      )
  );
}

function addDays(
  input:
    Date,

  days:
    number,
): Date {
  const result =
    new Date(
      input,
    );

  result.setUTCDate(
    result.getUTCDate() +
      days,
  );

  return result;
}

function mapFixtureStatus(
  status:
    string,
): InternalMatchStatus {
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

  /*
   * API'ye yeni bir status eklenirse
   * yanlışlıkla FINISHED yapmaktansa
   * SCHEDULED olarak tutmak daha güvenlidir.
   */
  return "SCHEDULED";
}

function wait(
  milliseconds:
    number,
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

async function fetchFixtures(
  options: {
    apiKey:
      string;

    baseUrl:
      string;

    leagueApiId:
      number;

    season:
      number;

    from:
      string;

    to:
      string;
  },
): Promise<
  ApiFootballFixtureResponse
> {
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
      options.season,
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
    const responseText =
      await response.text();

    throw new Error(
      [
        "API-Football fixture isteği başarısız.",
        `league=${options.leagueApiId}`,
        `HTTP=${response.status}`,
        responseText,
      ].join(
        " ",
      ),
    );
  }

  return (
    response.json() as Promise<
      ApiFootballFixtureResponse
    >
  );
}

async function main():
  Promise<void> {
  const apiKey =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_KEY",
    );

  const baseUrl =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_BASE_URL",
    );

  const season =
    ACTIVE_SEASON_YEAR;

  const daysAhead =
    getDaysAhead();

  const lookbackDays =
    getLookbackDays();

  const requestDelayMs =
    getRequestDelayMs();

  /*
   * İstenirse manuel tarih aralığı
   * kullanılabilir.
   *
   * Ör:
   *
   * $env:FIXTURE_FROM="2026-08-01"
   * $env:FIXTURE_TO="2026-09-15"
   */
  const configuredFrom =
    process.env
      .FIXTURE_FROM
      ?.trim();

  const configuredTo =
    process.env
      .FIXTURE_TO
      ?.trim();

  const now =
    new Date();

  const fromDate =
    configuredFrom
      ? new Date(
          `${configuredFrom}T00:00:00.000Z`,
        )
      : addDays(
          now,
          -lookbackDays,
        );

  const toDate =
    configuredTo
      ? new Date(
          `${configuredTo}T23:59:59.999Z`,
        )
      : addDays(
          now,
          daysAhead,
        );

  if (
    Number.isNaN(
      fromDate.getTime(),
    ) ||
    Number.isNaN(
      toDate.getTime(),
    )
  ) {
    throw new Error(
      "FIXTURE_FROM veya FIXTURE_TO tarihi geçersizdir.",
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

  const from =
    formatApiDate(
      fromDate,
    );

  const to =
    formatApiDate(
      toDate,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TARGET FIXTURE + STATUS SYNC",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Sezon:
      season,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    "Geçmiş gün":
      lookbackDays,

    "İleri gün":
      daysAhead,

    Başlangıç:
      from,

    Bitiş:
      to,

    "Request delay":
      `${requestDelayMs} ms`,
  });

  const resultRows:
    CompetitionImportResult[] =
      [];

  let totalCreated =
    0;

  let totalUpdated =
    0;

  let totalSkipped =
    0;

  let totalFailed =
    0;

  /*
   * Bütün aktif organizasyonları
   * priority sırasıyla import ediyoruz.
   */
  for (
    let competitionIndex =
      0;

    competitionIndex <
    ACTIVE_COMPETITIONS.length;

    competitionIndex +=
      1
  ) {
    const competition =
      ACTIVE_COMPETITIONS[
        competitionIndex
      ];

    console.log("");
    console.log(
      "----------------------------------------------",
    );

    console.log(
      [
        `[${competitionIndex + 1}/${ACTIVE_COMPETITIONS.length}]`,
        competition.name,
        `(${competition.apiId})`,
      ].join(
        " ",
      ),
    );

    console.log(
      "----------------------------------------------",
    );

    const competitionResult:
      CompetitionImportResult = {
      apiId:
        competition.apiId,

      competition:
        competition.name,

      received:
        0,

      created:
        0,

      updated:
        0,

      finished:
        0,

      live:
        0,

      scheduled:
        0,

      postponed:
        0,

      cancelled:
        0,

      skipped:
        0,

      failed:
        0,
    };

    try {
      const apiResult =
        await fetchFixtures({
          apiKey,

          baseUrl,

          leagueApiId:
            competition.apiId,

          season,

          from,

          to,
        });

      if (
        Object.keys(
          apiResult.errors ??
            {},
        ).length >
        0
      ) {
        throw new Error(
          [
            "API-Football hata döndürdü:",
            JSON.stringify(
              apiResult.errors,
            ),
          ].join(
            " ",
          ),
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

      competitionResult.received =
        apiResult
          .response
          .length;

      console.log(
        `API fixture: ${apiResult.response.length}`,
      );

      for (
        const fixture
        of apiResult.response
      ) {
        try {
          const mappedStatus =
            mapFixtureStatus(
              fixture
                .fixture
                .status
                .short,
            );

          const seasonRecord =
            await prisma
              .season
              .findFirst({
                where: {
                  year:
                    fixture
                      .league
                      .season,

                  league: {
                    apiId:
                      fixture
                        .league
                        .id,
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
            console.log(
              [
                "ATLANDI:",
                "Sezon bulunamadı",
                `league=${fixture.league.id}`,
                `season=${fixture.league.season}`,
              ].join(
                " ",
              ),
            );

            competitionResult.skipped +=
              1;

            totalSkipped +=
              1;

            continue;
          }

          const [
            homeTeam,
            awayTeam,
          ] =
            await Promise.all([
              prisma.team.findUnique({
                where: {
                  apiId:
                    fixture
                      .teams
                      .home
                      .id,
                },

                select: {
                  id:
                    true,
                },
              }),

              prisma.team.findUnique({
                where: {
                  apiId:
                    fixture
                      .teams
                      .away
                      .id,
                },

                select: {
                  id:
                    true,
                },
              }),
            ]);

          if (
            !homeTeam ||
            !awayTeam
          ) {
            console.log(
              [
                "ATLANDI:",
                "Takım bulunamadı",
                `${fixture.teams.home.name}`,
                "/",
                `${fixture.teams.away.name}`,
              ].join(
                " ",
              ),
            );

            competitionResult.skipped +=
              1;

            totalSkipped +=
              1;

            continue;
          }

          const existingMatch =
            await prisma
              .match
              .findUnique({
                where: {
                  apiId:
                    fixture
                      .fixture
                      .id,
                },

                select: {
                  id:
                    true,

                  status:
                    true,

                  homeScore:
                    true,

                  awayScore:
                    true,
                },
              });

          await prisma
            .match
            .upsert({
              where: {
                apiId:
                  fixture
                    .fixture
                    .id,
              },

              create: {
                apiId:
                  fixture
                    .fixture
                    .id,

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

                kickoffAt:
                  new Date(
                    fixture
                      .fixture
                      .date,
                  ),

                status:
                  mappedStatus,

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

                kickoffAt:
                  new Date(
                    fixture
                      .fixture
                      .date,
                  ),

                status:
                  mappedStatus,

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
            competitionResult.updated +=
              1;

            totalUpdated +=
              1;
          } else {
            competitionResult.created +=
              1;

            totalCreated +=
              1;
          }

          switch (
            mappedStatus
          ) {
            case "FINISHED":
              competitionResult.finished +=
                1;

              break;

            case "LIVE":
              competitionResult.live +=
                1;

              break;

            case "SCHEDULED":
              competitionResult.scheduled +=
                1;

              break;

            case "POSTPONED":
              competitionResult.postponed +=
                1;

              break;

            case "CANCELLED":
              competitionResult.cancelled +=
                1;

              break;
          }

          const statusChanged =
            existingMatch &&
            existingMatch.status !==
              mappedStatus;

          const scoreChanged =
            existingMatch &&
            (
              existingMatch.homeScore !==
                fixture.goals.home ||
              existingMatch.awayScore !==
                fixture.goals.away
            );

          if (
            !existingMatch
          ) {
            console.log(
              [
                "EKLENDİ:",
                `${fixture.teams.home.name} - ${fixture.teams.away.name}`,
                `[${mappedStatus}]`,
              ].join(
                " ",
              ),
            );
          } else if (
            statusChanged ||
            scoreChanged
          ) {
            console.log(
              [
                "DURUM GÜNCELLENDİ:",
                `${fixture.teams.home.name} - ${fixture.teams.away.name}`,
                `${existingMatch.status} → ${mappedStatus}`,
                `skor ${fixture.goals.home ?? "-"}-${fixture.goals.away ?? "-"}`,
              ].join(
                " ",
              ),
            );
          }
        } catch (
          fixtureError: unknown
        ) {
          competitionResult.failed +=
            1;

          totalFailed +=
            1;

          console.error(
            [
              "FIXTURE FAILED:",
              `${fixture.teams.home.name} - ${fixture.teams.away.name}`,
              `fixture=${fixture.fixture.id}`,
            ].join(
              " ",
            ),
          );

          console.error(
            fixtureError instanceof Error
              ? fixtureError.message
              : fixtureError,
          );
        }
      }
    } catch (
      competitionError: unknown
    ) {
      competitionResult.failed +=
        1;

      totalFailed +=
        1;

      console.error(
        `${competition.name} fixture aktarımı başarısız.`,
      );

      console.error(
        competitionError instanceof Error
          ? competitionError.message
          : competitionError,
      );
    }

    resultRows.push(
      competitionResult,
    );

    if (
      competitionIndex <
      ACTIVE_COMPETITIONS.length -
        1
    ) {
      await wait(
        requestDelayMs,
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "COMPETITION IMPORT RESULT",
  );

  console.log(
    "==============================================",
  );

  console.table(
    resultRows.map(
      (
        result,
      ) => ({
        apiId:
          result.apiId,

        competition:
          result.competition,

        API:
          result.received,

        new:
          result.created,

        updated:
          result.updated,

        finished:
          result.finished,

        live:
          result.live,

        scheduled:
          result.scheduled,

        postponed:
          result.postponed,

        cancelled:
          result.cancelled,

        skipped:
          result.skipped,

        failed:
          result.failed,
      }),
    ),
  );

  const totalReceived =
    resultRows.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.received,
      0,
    );

  const totalFinished =
    resultRows.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.finished,
      0,
    );

  const totalScheduled =
    resultRows.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.scheduled,
      0,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TOTAL",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "API fixture":
      totalReceived,

    "Yeni maç":
      totalCreated,

    "Güncellenen maç":
      totalUpdated,

    "FINISHED":
      totalFinished,

    "SCHEDULED":
      totalScheduled,

    "Atlanan":
      totalSkipped,

    "Başarısız":
      totalFailed,
  });

  /*
   * Sync sonrasında halen geçmişte kalmış
   * SCHEDULED maçları ayrıca tespit ediyoruz.
   *
   * Böylece API coverage eksikliği varsa
   * sessizce gözden kaçmıyor.
   */
  const staleScheduled =
    await prisma
      .match
      .findMany({
        where: {
          status:
            "SCHEDULED",

          kickoffAt: {
            lt:
              new Date(),
          },

          season: {
            year:
              season,

            league: {
              apiId: {
                in:
                  ACTIVE_COMPETITIONS.map(
                    (
                      competition,
                    ) =>
                      competition.apiId,
                  ),
              },
            },
          },
        },

        select: {
          id:
            true,

          apiId:
            true,

          kickoffAt:
            true,

          homeTeam: {
            select: {
              name:
                true,
            },
          },

          awayTeam: {
            select: {
              name:
                true,
            },
          },

          season: {
            select: {
              league: {
                select: {
                  name:
                    true,
                },
              },
            },
          },
        },

        orderBy: {
          kickoffAt:
            "asc",
        },

        take:
          30,
      });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "STALE SCHEDULED CHECK",
  );

  console.log(
    "==============================================",
  );

  if (
    staleScheduled.length ===
    0
  ) {
    console.log(
      "Geçmişte kalmış SCHEDULED maç bulunmadı.",
    );
  } else {
    console.log(
      [
        "UYARI:",
        staleScheduled.length,
        "adet geçmiş SCHEDULED maç bulundu",
        "(ilk 30 gösteriliyor).",
      ].join(
        " ",
      ),
    );

    console.table(
      staleScheduled.map(
        (
          match,
        ) => ({
          databaseId:
            match.id,

          fixtureId:
            match.apiId,

          league:
            match
              .season
              .league
              .name,

          kickoff:
            match
              .kickoffAt
              .toISOString(),

          match:
            `${match.homeTeam.name} - ${match.awayTeam.name}`,
        }),
      ),
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "FIXTURE + STATUS SYNC TAMAMLANDI",
  );

  console.log(
    "==============================================",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Fixture aktarımı başarısız oldu.",
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