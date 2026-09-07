import {
  prisma,
} from "@/lib/prisma";

import {
  saveSquadFeatures,
} from "@/modules/squad-strength-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "SAVE SQUAD FEATURES TEST",
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
          },
        },
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeamId: true,
        awayTeamId: true,

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

  const calculationRunId =
    `test-squad-features-match-${match.id}`;

  console.log("");

  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log("");

  const [
    home,
    away,
  ] =
    await Promise.all([
      saveSquadFeatures({
        matchId:
          match.id,

        teamId:
          match.homeTeamId,

        calculationRunId,

        effectiveCalculatedAt:
          match.kickoffAt,
      }),

      saveSquadFeatures({
        matchId:
          match.id,

        teamId:
          match.awayTeamId,

        calculationRunId,

        effectiveCalculatedAt:
          match.kickoffAt,
      }),
    ]);

  console.log(
    "HOME",
  );

  console.table(
    home.values.map(
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
    "AWAY",
  );

  console.table(
    away.values.map(
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

  console.table({
    "Home created":
      home.createdCount,

    "Home updated":
      home.updatedCount,

    "Away created":
      away.createdCount,

    "Away updated":
      away.updatedCount,

    "Run ID":
      calculationRunId,
  });
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