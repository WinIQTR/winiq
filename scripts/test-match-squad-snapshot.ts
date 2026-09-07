import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchSquadSnapshot,
} from "@/modules/squad-strength-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MATCH SQUAD SNAPSHOT TEST",
  );

  console.log(
    "========================================",
  );

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
      "Test için confirmed lineup bulunan maç yok.",
    );

    return;
  }

  const calculationRunId =
    `test-squad-snapshot-match-${match.id}`;

  console.log("");

  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

  console.log(
    `Run: ${calculationRunId}`,
  );

  console.log("");

  const result =
    await generateMatchSquadSnapshot({
      matchId:
        match.id,

      calculationRunId,

      effectiveCalculatedAt:
        match.kickoffAt,
    });

  console.log(
    "SNAPSHOT RESULT",
  );

  console.log("");

  console.table({
    Durum:
      result.status,

    "Impact üretimi":
      result.impactGenerationAttempted
        ? "EVET"
        : "HAYIR",

    "Önce hazır":
      result.readinessBefore
        .ready
        ? "EVET"
        : "HAYIR",

    "Sonra hazır":
      result.readinessAfter
        .ready
        ? "EVET"
        : "HAYIR",

    "Home impact":
      result.readinessAfter
        .homeImpactCount,

    "Away impact":
      result.readinessAfter
        .awayImpactCount,

    "Home feature":
      result.home?.values
        .length ??
      0,

    "Away feature":
      result.away?.values
        .length ??
      0,
  });

  if (
    result.home &&
    result.away
  ) {
    console.log("");
    console.log(
      "HOME FEATURES",
    );

    console.table(
      result.home.values.map(
        (feature) => ({
          key:
            feature.key,

          raw:
            feature.rawValue,

          normalized:
            feature.normalizedValue,

          quality:
            feature.dataQualityScore,
        }),
      ),
    );

    console.log("");
    console.log(
      "AWAY FEATURES",
    );

    console.table(
      result.away.values.map(
        (feature) => ({
          key:
            feature.key,

          raw:
            feature.rawValue,

          normalized:
            feature.normalizedValue,

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