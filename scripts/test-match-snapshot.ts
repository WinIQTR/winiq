import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchSnapshot,
  HISTORICAL_SNAPSHOT_RUN_PREFIX,
} from "@/modules/feature-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MATCH SNAPSHOT PIPELINE TEST",
  );

  console.log(
    "========================================",
  );

  /*
   * Confirmed lineup bulunan en ileri
   * tarihli Premier League 2024 maçını
   * seçiyoruz.
   */
  const match =
    await prisma.match.findFirst({
      where: {
        status:
          "FINISHED",

        season: {
          year:
            2024,

          league: {
            apiId:
              39,
          },
        },

        lineups: {
          some: {
            status:
              "CONFIRMED",

            isConfirmed:
              true,
          },
        },
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeam: {
          select: {
            name: true,
          },
        },

        awayTeam: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "desc",
      },
    });

  if (!match) {
    console.log(
      "Uygun maç bulunamadı.",
    );

    return;
  }

  const runId =
    `${HISTORICAL_SNAPSHOT_RUN_PREFIX}-match-${match.id}`;

  console.log("");

  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

  console.log(
    `Run: ${runId}`,
  );

  console.log("");

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

  console.log(
    "PIPELINE RESULT",
  );

  console.log("");

  console.table({
    Durum:
      result.status,

    "Core home":
      result.core.home.values
        .length,

    "Core away":
      result.core.away.values
        .length,

    "Squad durumu":
      result.squad.status,

    "Squad home":
      result.squad.home
        ?.values.length ??
      0,

    "Squad away":
      result.squad.away
        ?.values.length ??
      0,

    "Impact üretildi":
      result.squad
        .impactGenerationAttempted
        ? "EVET"
        : "HAYIR",

    Uyarı:
      result.warnings.length,
  });

  console.log("");

  console.log(
    "HOME SQUAD QUALITY",
  );

  if (
    result.squad.home
  ) {
    console.table(
      result.squad.home.values.map(
        (feature) => ({
          key:
            feature.key,

          raw:
            feature.rawValue,

          quality:
            feature.dataQualityScore,
        }),
      ),
    );
  }

  console.log("");

  console.log(
    "AWAY SQUAD QUALITY",
  );

  if (
    result.squad.away
  ) {
    console.table(
      result.squad.away.values.map(
        (feature) => ({
          key:
            feature.key,

          raw:
            feature.rawValue,

          quality:
            feature.dataQualityScore,
        }),
      ),
    );
  }

  if (
    result.warnings.length >
    0
  ) {
    console.log("");

    console.log(
      "UYARILAR",
    );

    console.table(
      result.warnings.map(
        (warning) => ({
          uyarı:
            warning,
        }),
      ),
    );
  }
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );