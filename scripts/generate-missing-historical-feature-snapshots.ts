import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  HISTORICAL_MODEL_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchSnapshot,
  HISTORICAL_SNAPSHOT_RUN_PREFIX,
} from "@/modules/feature-engine";

type CompetitionProgress = {
  apiId: number;

  competition: string;

  finished: number;

  existing: number;

  generated: number;

  complete: number;

  coreOnly: number;

  failed: number;

  warnings: number;
};

function createRunId(
  matchId: number,
): string {
  return [
    HISTORICAL_SNAPSHOT_RUN_PREFIX,
    "match",
    matchId,
  ].join("-");
}

async function main():
  Promise<void> {
  const seasonYear =
    HISTORICAL_MODEL_SEASON_YEAR;

  const competitionApiIds =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) =>
        competition.apiId,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "MISSING HISTORICAL SNAPSHOT GENERATOR",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Historical sezon":
      seasonYear,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    "Run prefix":
      HISTORICAL_SNAPSHOT_RUN_PREFIX,
  });

  /*
   * Burada API_FOOTBALL_SEASON kullanmıyoruz.
   *
   * Historical model sezonu canlı sezondan
   * tamamen bağımsızdır.
   */
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
                apiId:
                  true,

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
    });

  console.log("");

  console.table({
    "Bitmiş maç":
      matches.length,
  });

  const progress =
    new Map<
      number,
      CompetitionProgress
    >();

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    progress.set(
      competition.apiId,
      {
        apiId:
          competition.apiId,

        competition:
          competition.name,

        finished:
          0,

        existing:
          0,

        generated:
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

  /*
   * Önce hangi maçların snapshot'ı eksik
   * onu belirliyoruz.
   */
  const missingMatches:
    typeof matches = [];

  console.log("");
  console.log(
    "Eksik snapshot kontrol ediliyor...",
  );

  let checked =
    0;

  for (
    const match
    of matches
  ) {
    const leagueApiId =
      match
        .season
        .league
        .apiId;

    const leagueProgress =
      progress.get(
        leagueApiId,
      );

    if (
      leagueProgress
    ) {
      leagueProgress.finished +=
        1;
    }

    const calculationRunId =
      createRunId(
        match.id,
      );

    const existing =
      await prisma
        .matchFeatureValue
        .findFirst({
          where: {
            matchId:
              match.id,

            calculationRunId,
          },

          select: {
            id:
              true,
          },
        });

    if (
      existing
    ) {
      if (
        leagueProgress
      ) {
        leagueProgress.existing +=
          1;
      }
    } else {
      missingMatches.push(
        match,
      );
    }

    checked +=
      1;

    if (
      checked %
        250 ===
      0
    ) {
      console.log(
        `Coverage check ${checked}/${matches.length}`,
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "BEFORE GENERATION",
  );

  console.log(
    "==============================================",
  );

  console.table(
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) => {
        const row =
          progress.get(
            competition.apiId,
          );

        return {
          apiId:
            competition.apiId,

          competition:
            competition.name,

          finished:
            row?.finished ??
            0,

          existing:
            row?.existing ??
            0,

          missing:
            (
              row?.finished ??
              0
            ) -
            (
              row?.existing ??
              0
            ),
        };
      },
    ),
  );

  console.log("");

  console.table({
    "Eksik snapshot":
      missingMatches.length,
  });

  if (
    missingMatches.length ===
    0
  ) {
    console.log("");
    console.log(
      "Tüm historical snapshotlar zaten mevcut.",
    );

    return;
  }

  console.log("");
  console.log(
    "Eksik snapshot üretimi başlıyor...",
  );

  for (
    let index = 0;
    index <
    missingMatches.length;
    index +=
      1
  ) {
    const match =
      missingMatches[
        index
      ];

    const leagueApiId =
      match
        .season
        .league
        .apiId;

    const leagueProgress =
      progress.get(
        leagueApiId,
      );

    const calculationRunId =
      createRunId(
        match.id,
      );

    console.log("");
    console.log(
      [
        `[${index + 1}/${missingMatches.length}]`,
        `[${match.season.league.name}]`,
        `${match.homeTeam.name} - ${match.awayTeam.name}`,
      ].join(
        " ",
      ),
    );

    try {
      /*
       * Kritik data leakage koruması:
       *
       * Feature'lar yalnızca maç başlangıcına
       * kadar bilinebilecek verilerden
       * hesaplanmalıdır.
       */
      const result =
        await generateMatchSnapshot({
          matchId:
            match.id,

          calculationRunId,

          snapshotTime:
            match.kickoffAt,

          effectiveCalculatedAt:
            match.kickoffAt,
        });

      if (
        leagueProgress
      ) {
        leagueProgress.generated +=
          1;

        leagueProgress.warnings +=
          result.warnings.length;

        if (
          result.status ===
          "COMPLETE"
        ) {
          leagueProgress.complete +=
            1;
        } else {
          leagueProgress.coreOnly +=
            1;
        }
      }

      console.log(
        [
          result.status,

          `core=${result.core.home.values.length}+${result.core.away.values.length}`,

          `squad=${result.squad.home?.values.length ?? 0}+${result.squad.away?.values.length ?? 0}`,

          `warning=${result.warnings.length}`,
        ].join(
          " • ",
        ),
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
      error: unknown
    ) {
      if (
        leagueProgress
      ) {
        leagueProgress.failed +=
          1;
      }

      console.error(
        "FAILED:",
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "GENERATION RESULT",
  );

  console.log(
    "==============================================",
  );

  const resultRows =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) => {
        const row =
          progress.get(
            competition.apiId,
          );

        return {
          apiId:
            competition.apiId,

          competition:
            competition.name,

          finished:
            row?.finished ??
            0,

          previous:
            row?.existing ??
            0,

          generated:
            row?.generated ??
            0,

          complete:
            row?.complete ??
            0,

          coreOnly:
            row?.coreOnly ??
            0,

          failed:
            row?.failed ??
            0,

          warnings:
            row?.warnings ??
            0,

          finalExpected:
            (
              row?.existing ??
              0
            ) +
            (
              row?.generated ??
              0
            ),
        };
      },
    );

  console.table(
    resultRows,
  );

  const totalGenerated =
    resultRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.generated,
      0,
    );

  const totalFailed =
    resultRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.failed,
      0,
    );

  const totalWarnings =
    resultRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.warnings,
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
    "Eksik başlangıç":
      missingMatches.length,

    Üretilen:
      totalGenerated,

    Başarısız:
      totalFailed,

    Uyarı:
      totalWarnings,
  });

  if (
    totalFailed ===
    0 &&
    totalGenerated ===
      missingMatches.length
  ) {
    console.log("");
    console.log(
      "TÜM EKSİK HISTORICAL SNAPSHOTLAR BAŞARIYLA ÜRETİLDİ.",
    );
  } else {
    console.log("");
    console.log(
      "Bazı snapshotlar üretilemedi. FAILED satırları incelenmelidir.",
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
        "Eksik historical snapshot üretimi başarısız.",
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