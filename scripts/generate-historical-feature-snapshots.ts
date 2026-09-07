import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchSnapshot,
  HISTORICAL_SNAPSHOT_RUN_PREFIX,
} from "@/modules/feature-engine";

const DEFAULT_SEASON_YEAR =
  2024;

function getSeasonYear(): number {
  const raw =
    process.env
      .API_FOOTBALL_SEASON
      ?.trim();

  if (!raw) {
    return DEFAULT_SEASON_YEAR;
  }

  const parsed =
    Number.parseInt(
      raw,
      10,
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < 2000 ||
    parsed > 2100
  ) {
    throw new Error(
      "API_FOOTBALL_SEASON geçerli bir sezon yılı olmalıdır.",
    );
  }

  return parsed;
}

async function main(): Promise<void> {
  const seasonYear =
    getSeasonYear();

  const competitionApiIds =
    ACTIVE_COMPETITIONS.map(
      (competition) =>
        competition.apiId,
    );

  const competitionPriority =
    new Map(
      ACTIVE_COMPETITIONS.map(
        (competition) => [
          competition.apiId,
          competition.priority,
        ],
      ),
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "HISTORICAL MATCH SNAPSHOT GENERATOR",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Sezon: ${seasonYear}`,
  );

  console.log(
    `Organizasyon: ${ACTIVE_COMPETITIONS.length}`,
  );

  /*
   * Artık lineup veya player performance
   * zorunluluğu YOK.
   *
   * Amaç:
   *
   * 1. Tüm bitmiş maçlarda CORE snapshot üretmek.
   * 2. Kadro verisi bulunan maçlarda SQUAD katmanını
   *    otomatik olarak eklemek.
   *
   * Böylece eksik lineup yüzünden historical
   * training dataset'i kaybetmiyoruz.
   */
  const databaseMatches =
    await prisma.match.findMany({
      where: {
        status:
          "FINISHED",

        homeScore: {
          not:
            null,
        },

        awayScore: {
          not:
            null,
        },

        season: {
          year:
            seasonYear,

          league: {
            apiId: {
              in:
                competitionApiIds,
            },
          },
        },
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        season: {
          select: {
            year:
              true,

            league: {
              select: {
                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },

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
      },
    });

  /*
   * Önce competition priority,
   * sonra maç tarihi.
   */
  const matches =
    databaseMatches.sort(
      (
        left,
        right,
      ) => {
        const leftPriority =
          competitionPriority.get(
            left.season.league.apiId,
          ) ??
          999;

        const rightPriority =
          competitionPriority.get(
            right.season.league.apiId,
          ) ??
          999;

        if (
          leftPriority !==
          rightPriority
        ) {
          return (
            leftPriority -
            rightPriority
          );
        }

        return (
          left.kickoffAt.getTime() -
          right.kickoffAt.getTime()
        );
      },
    );

  console.log("");

  console.log(
    `Hazır maç: ${matches.length}`,
  );

  console.log("");

  let complete =
    0;

  let coreOnly =
    0;

  let failed =
    0;

  let warnings =
    0;

  const competitionResults =
    new Map<
      number,
      {
        apiId: number;
        competition: string;

        matches: number;
        complete: number;
        coreOnly: number;
        failed: number;
        warnings: number;
      }
    >();

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    competitionResults.set(
      competition.apiId,
      {
        apiId:
          competition.apiId,

        competition:
          competition.name,

        matches:
          0,

        complete:
          0,

        coreOnly:
          0,

        failed:
          0,

        warnings:
          0,
      },
    );
  }

  for (
    let index = 0;
    index < matches.length;
    index += 1
  ) {
    const match =
      matches[index];

    const leagueApiId =
      match.season.league.apiId;

    const leagueResult =
      competitionResults.get(
        leagueApiId,
      );

    if (leagueResult) {
      leagueResult.matches +=
        1;
    }

    /*
     * Şimdilik mevcut historical run formatını
     * KORUYORUZ.
     *
     * Learning Engine bu formatı kullandığı için
     * V1 tamamlanmadan run-id mimarisini
     * değiştirmiyoruz.
     *
     * match.id zaten global unique olduğu için
     * diğer liglerle çakışma olmaz.
     */
    const runId =
      `${HISTORICAL_SNAPSHOT_RUN_PREFIX}-match-${match.id}`;

    console.log("");

    console.log(
      `[${index + 1}/${matches.length}] ` +
      `[${match.season.league.name}] ` +
      `${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    try {
      /*
       * DATA LEAKAGE KORUMASI
       *
       * Snapshot zamanı = maç kickoff zamanı.
       *
       * Feature motorları yalnızca bu tarihten
       * önceki verileri kullanmalıdır.
       */
      const result =
        await generateMatchSnapshot({
          matchId:
            match.id,

          calculationRunId:
            runId,

          snapshotTime:
            match.kickoffAt,

          effectiveCalculatedAt:
            match.kickoffAt,
        });

      if (
        result.status ===
        "COMPLETE"
      ) {
        complete += 1;

        if (
          leagueResult
        ) {
          leagueResult.complete +=
            1;
        }
      } else {
        coreOnly += 1;

        if (
          leagueResult
        ) {
          leagueResult.coreOnly +=
            1;
        }
      }

      warnings +=
        result.warnings.length;

      if (
        leagueResult
      ) {
        leagueResult.warnings +=
          result.warnings.length;
      }

      console.log(
        [
          `  ${result.status}`,
          `core ${result.core.home.values.length}+${result.core.away.values.length}`,
          `squad ${result.squad.home?.values.length ?? 0}+${result.squad.away?.values.length ?? 0}`,
        ].join(" • "),
      );

      for (
        const warning
        of result.warnings
      ) {
        console.log(
          `  Warning: ${warning}`,
        );
      }
    } catch (
      error
    ) {
      failed += 1;

      if (
        leagueResult
      ) {
        leagueResult.failed +=
          1;
      }

      console.error(
        "  FAILED:",
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "COMPETITION SNAPSHOT RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) => {
        const result =
          competitionResults.get(
            competition.apiId,
          );

        return {
          apiId:
            competition.apiId,

          competition:
            competition.name,

          matches:
            result?.matches ??
            0,

          complete:
            result?.complete ??
            0,

          coreOnly:
            result?.coreOnly ??
            0,

          failed:
            result?.failed ??
            0,

          warnings:
            result?.warnings ??
            0,
        };
      },
    ),
  );

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "HISTORICAL SNAPSHOT RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    "Hazır maç":
      matches.length,

    COMPLETE:
      complete,

    CORE_ONLY:
      coreOnly,

    FAILED:
      failed,

    Uyarı:
      warnings,

    "Snapshot üretilen":
      complete +
      coreOnly,
  });
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");

      console.error(
        "Historical snapshot üretimi başarısız.",
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