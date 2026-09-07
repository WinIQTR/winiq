import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  HISTORICAL_SNAPSHOT_RUN_PREFIX,
} from "@/modules/feature-engine";

const DEFAULT_SEASON_YEAR =
  2024;

function resolveSeasonYear():
  number {
  const rawValue =
    process.env
      .HISTORICAL_MODEL_SEASON?.trim();

  if (
    !rawValue
  ) {
    return DEFAULT_SEASON_YEAR;
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
      2000 ||
    parsedValue >
      2100
  ) {
    return DEFAULT_SEASON_YEAR;
  }

  return parsedValue;
}

function createRunId(
  matchId: number,
): string {
  return [
    HISTORICAL_SNAPSHOT_RUN_PREFIX,
    "match",
    matchId,
  ].join(
    "-",
  );
}

async function main():
  Promise<void> {
  const seasonYear =
    resolveSeasonYear();

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "HISTORICAL SNAPSHOT COVERAGE CHECK",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Sezon:
      seasonYear,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    "Run prefix":
      HISTORICAL_SNAPSHOT_RUN_PREFIX,
  });

  const summaryRows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    console.log("");
    console.log(
      `Kontrol: ${competition.name}`,
    );

    const matches =
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
              apiId:
                competition.apiId,
            },
          },
        },

        select: {
          id:
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
        },

        orderBy: {
          kickoffAt:
            "asc",
        },
      });

    if (
      matches.length ===
      0
    ) {
      summaryRows.push({
        apiId:
          competition.apiId,

        competition:
          competition.name,

        finished:
          0,

        snapshotMatches:
          0,

        missing:
          0,

        coverage:
          "0.00%",

        featureRows:
          0,

        averageFeatures:
          0,
      });

      continue;
    }

    const matchIds =
      matches.map(
        (
          match,
        ) =>
          match.id,
      );

    /*
     * Burada MatchFeatureValue içinden yalnızca
     * coverage hesabı için gereken alanları
     * okuyoruz.
     *
     * rawValue / normalizedValue bu Prisma
     * modelinde mevcut değil.
     */
    const featureRows =
      await prisma
        .matchFeatureValue
        .findMany({
          where: {
            matchId: {
              in:
                matchIds,
            },

            calculationRunId: {
              startsWith:
                `${HISTORICAL_SNAPSHOT_RUN_PREFIX}-match-`,
            },
          },

          select: {
            matchId:
              true,

            calculationRunId:
              true,
          },
        });

    const exactRunMatchIds =
      new Set<number>();

    const featureCountByMatch =
      new Map<
        number,
        number
      >();

    for (
      const featureRow
      of featureRows
    ) {
      const expectedRunId =
        createRunId(
          featureRow.matchId,
        );

      if (
        featureRow
          .calculationRunId !==
        expectedRunId
      ) {
        continue;
      }

      exactRunMatchIds.add(
        featureRow.matchId,
      );

      featureCountByMatch.set(
        featureRow.matchId,
        (
          featureCountByMatch.get(
            featureRow.matchId,
          ) ??
          0
        ) +
          1,
      );
    }

    const snapshotMatches =
      matches.filter(
        (
          match,
        ) =>
          exactRunMatchIds.has(
            match.id,
          ),
      );

    const missingMatches =
      matches.filter(
        (
          match,
        ) =>
          !exactRunMatchIds.has(
            match.id,
          ),
      );

    const exactFeatureRowCount =
      [...featureCountByMatch.values()]
        .reduce(
          (
            total,
            count,
          ) =>
            total +
            count,
          0,
        );

    const averageFeatures =
      snapshotMatches.length >
      0
        ? exactFeatureRowCount /
          snapshotMatches.length
        : 0;

    const coveragePercentage =
      matches.length >
      0
        ? (
            snapshotMatches.length /
            matches.length
          ) *
          100
        : 0;

    summaryRows.push({
      apiId:
        competition.apiId,

      competition:
        competition.name,

      finished:
        matches.length,

      snapshotMatches:
        snapshotMatches.length,

      missing:
        missingMatches.length,

      coverage:
        `${coveragePercentage.toFixed(
          2,
        )}%`,

      featureRows:
        exactFeatureRowCount,

      averageFeatures:
        Number(
          averageFeatures.toFixed(
            2,
          ),
        ),
    });

    console.table({
      Finished:
        matches.length,

      "Historical snapshot":
        snapshotMatches.length,

      Eksik:
        missingMatches.length,

      Coverage:
        `${coveragePercentage.toFixed(
          2,
        )}%`,

      "Feature row":
        exactFeatureRowCount,

      "Ort. feature":
        averageFeatures.toFixed(
          2,
        ),
    });

    if (
      missingMatches.length >
      0
    ) {
      console.log("");
      console.log(
        "İlk 10 eksik snapshot:",
      );

      console.table(
        missingMatches
          .slice(
            0,
            10,
          )
          .map(
            (
              match,
            ) => ({
              matchId:
                match.id,

              tarih:
                match.kickoffAt
                  .toISOString()
                  .slice(
                    0,
                    10,
                  ),

              maç:
                `${match.homeTeam.name} - ${match.awayTeam.name}`,

              expectedRunId:
                createRunId(
                  match.id,
                ),
            }),
          ),
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ALL COMPETITIONS",
  );

  console.log(
    "==============================================",
  );

  console.table(
    summaryRows,
  );

  const totalFinished =
    summaryRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.finished ??
          0,
        ),
      0,
    );

  const totalSnapshots =
    summaryRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.snapshotMatches ??
          0,
        ),
      0,
    );

  const totalFeatureRows =
    summaryRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.featureRows ??
          0,
        ),
      0,
    );

  const totalMissing =
    totalFinished -
    totalSnapshots;

  const totalCoverage =
    totalFinished >
    0
      ? (
          totalSnapshots /
          totalFinished
        ) *
        100
      : 0;

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
    "Finished maç":
      totalFinished,

    "Snapshot mevcut":
      totalSnapshots,

    "Snapshot eksik":
      totalMissing,

    "Feature row":
      totalFeatureRows,

    Coverage:
      `${totalCoverage.toFixed(
        2,
      )}%`,
  });
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Historical snapshot coverage kontrolü başarısız.",
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