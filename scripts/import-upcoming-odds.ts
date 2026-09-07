import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

import {
  importFixtureOdds,
} from "@/modules/bookmaker-odds-engine";

const DEFAULT_MATCH_LIMIT =
  5;

const DEFAULT_DELAY_MS =
  300;

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (
    !value
  ) {
    throw new Error(
      `${name} ortam değişkeni tanımlı değil.`,
    );
  }

  return value;
}

function resolveMatchLimit():
  number {
  const rawValue =
    process.env
      .ODDS_MATCH_LIMIT;

  if (
    !rawValue
  ) {
    return DEFAULT_MATCH_LIMIT;
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
    parsedValue <=
      0 ||
    parsedValue >
      100
  ) {
    return DEFAULT_MATCH_LIMIT;
  }

  return parsedValue;
}

async function wait(
  milliseconds: number,
): Promise<void> {
  await new Promise<void>(
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

async function resolveImportSeason(
  now: Date,
): Promise<{
  seasonYear: number;

  source:
    | "CONFIG"
    | "DATABASE_FALLBACK";
}> {
  const configuredSeasonMatchCount =
    await prisma.match.count({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gte:
            now,
        },

        season: {
          year:
            ACTIVE_SEASON_YEAR,

          league: {
            apiId: {
              in: [
                ...ACTIVE_COMPETITION_API_IDS,
              ],
            },
          },
        },
      },
    });

  if (
    configuredSeasonMatchCount >
    0
  ) {
    return {
      seasonYear:
        ACTIVE_SEASON_YEAR,

      source:
        "CONFIG",
    };
  }

  const nextScheduledMatch =
    await prisma.match.findFirst({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gte:
            now,
        },

        season: {
          league: {
            apiId: {
              in: [
                ...ACTIVE_COMPETITION_API_IDS,
              ],
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      select: {
        season: {
          select: {
            year:
              true,
          },
        },
      },
    });

  if (
    !nextScheduledMatch
  ) {
    return {
      seasonYear:
        ACTIVE_SEASON_YEAR,

      source:
        "CONFIG",
    };
  }

  return {
    seasonYear:
      nextScheduledMatch
        .season
        .year,

    source:
      "DATABASE_FALLBACK",
  };
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "UPCOMING BOOKMAKER ODDS IMPORT",
  );

  console.log(
    "==============================================",
  );

  const apiKey =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_KEY",
    );

  const baseUrl =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_BASE_URL",
    );

  const matchLimit =
    resolveMatchLimit();

  const now =
    new Date();

  const importSeason =
    await resolveImportSeason(
      now,
    );

  if (
    importSeason.source ===
      "DATABASE_FALLBACK"
  ) {
    console.log("");
    console.warn(
      [
        "UYARI:",
        `ACTIVE_SEASON_YEAR=${ACTIVE_SEASON_YEAR}`,
        "için yaklaşan maç bulunamadı.",
        `Odds importer veritabanındaki gelecek sezonu kullanacak: ${importSeason.seasonYear}.`,
      ].join(
        " ",
      ),
    );

    console.log("");
  }

  const matches =
    await prisma.match.findMany({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gte:
            now,
        },

        season: {
          year:
            importSeason
              .seasonYear,

          league: {
            apiId: {
              in: [
                ...ACTIVE_COMPETITION_API_IDS,
              ],
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      take:
        matchLimit,

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
            year:
              true,

            league: {
              select: {
                name:
                  true,

                apiId:
                  true,
              },
            },
          },
        },
      },
    });

  console.table({
    "Config sezon":
      ACTIVE_SEASON_YEAR,

    "Import sezon":
      importSeason
        .seasonYear,

    "Sezon kaynağı":
      importSeason
        .source,

    "Maç limiti":
      matchLimit,

    "Bulunan maç":
      matches.length,
  });

  if (
    matches.length ===
    0
  ) {
    console.log("");
    console.log(
      "Yaklaşan maç bulunamadı.",
    );

    return;
  }

  const resultRows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  let totalBookmakers =
    0;

  let totalSnapshots =
    0;

  let totalMarkets =
    0;

  let totalSelections =
    0;

  let successCount =
    0;

  let noDataCount =
    0;

  let errorCount =
    0;

  for (
    const [
      index,
      match,
    ]
    of matches.entries()
  ) {
    console.log("");
    console.log(
      [
        `[${index + 1}/${matches.length}]`,
        match.homeTeam.name,
        "-",
        match.awayTeam.name,
      ].join(
        " ",
      ),
    );

    console.log(
      [
        match
          .season
          .league
          .name,
        `• ${match.season.year}`,
        `• fixture=${match.apiId}`,
      ].join(
        " ",
      ),
    );

    try {
      const result =
        await importFixtureOdds({
          matchId:
            match.id,

          apiKey,

          baseUrl,
        });

      const hasData =
        result.selectionCount >
        0;

      if (
        hasData
      ) {
        successCount +=
          1;
      } else {
        noDataCount +=
          1;
      }

      totalBookmakers +=
        result.bookmakerCount;

      totalSnapshots +=
        result.snapshotCount;

      totalMarkets +=
        result.marketCount;

      totalSelections +=
        result.selectionCount;

      resultRows.push({
        maç:
          `${result.homeTeam} - ${result.awayTeam}`,

        lig:
          match
            .season
            .league
            .name,

        sezon:
          match
            .season
            .year,

        bookmaker:
          result.bookmakerCount,

        snapshot:
          result.snapshotCount,

        market:
          result.marketCount,

        seçim:
          result.selectionCount,

        durum:
          hasData
            ? "OK"
            : "NO_DATA",
      });

      console.log(
        `Kaydedilen seçim: ${result.selectionCount}`,
      );
    } catch (
      error: unknown
    ) {
      errorCount +=
        1;

      resultRows.push({
        maç:
          `${match.homeTeam.name} - ${match.awayTeam.name}`,

        lig:
          match
            .season
            .league
            .name,

        sezon:
          match
            .season
            .year,

        bookmaker:
          0,

        snapshot:
          0,

        market:
          0,

        seçim:
          0,

        durum:
          error instanceof Error
            ? `ERROR: ${error.message}`
            : "ERROR",
      });

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );
    }

    if (
      index <
      matches.length -
        1
    ) {
      await wait(
        DEFAULT_DELAY_MS,
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "IMPORT RESULT",
  );

  console.log(
    "==============================================",
  );

  console.table(
    resultRows,
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "IMPORT SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "İşlenen maç":
      matches.length,

    Başarılı:
      successCount,

    "Odds bulunamadı":
      noDataCount,

    Hata:
      errorCount,

    "Toplam bookmaker":
      totalBookmakers,

    "Toplam snapshot":
      totalSnapshots,

    "Toplam market":
      totalMarkets,

    "Toplam seçim":
      totalSelections,
  });
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Odds import başarısız.",
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