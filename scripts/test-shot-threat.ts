import {
  prisma,
} from "@/lib/prisma";

import {
  calculateTeamShotThreat,
} from "@/modules/shot-threat-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "SHOT THREAT ENGINE TEST",
  );

  console.log(
    "========================================",
  );

  /*
   * MatchTeamStatistic bulunan en ileri
   * tarihli maçı seçiyoruz.
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

        teamStatistics: {
          some: {},
        },
      },

      select: {
        id: true,

        kickoffAt:
          true,

        homeTeamId:
          true,

        awayTeamId:
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
          "desc",
      },
    });

  if (!match) {
    console.log(
      "Takım istatistiği bulunan maç yok.",
    );

    return;
  }

  /*
   * Maçın kendisini dahil etmemek için
   * beforeDate = kickoffAt kullanıyoruz.
   */
  const home =
    await calculateTeamShotThreat({
      teamId:
        match.homeTeamId,

      season:
        2024,

      beforeDate:
        match.kickoffAt,
    });

  const away =
    await calculateTeamShotThreat({
      teamId:
        match.awayTeamId,

      season:
        2024,

      beforeDate:
        match.kickoffAt,
    });

  console.log("");

  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

  console.log("");

  console.table([
    {
      takım:
        match.homeTeam.name,

      maç:
        home.matches,

      şut:
        home.shotsPerGame,

      isabetli:
        home.shotsOnTargetPerGame,

      "şut isabet %":
        home.shotAccuracy,

      possession:
        home.possessionAverage,

      korner:
        home.cornersPerGame,

      pressure:
        home.attackingPressureScore,

      "last5 pressure":
        home.last5AttackingPressureScore,

      quality:
        home.dataQualityScore,
    },

    {
      takım:
        match.awayTeam.name,

      maç:
        away.matches,

      şut:
        away.shotsPerGame,

      isabetli:
        away.shotsOnTargetPerGame,

      "şut isabet %":
        away.shotAccuracy,

      possession:
        away.possessionAverage,

      korner:
        away.cornersPerGame,

      pressure:
        away.attackingPressureScore,

      "last5 pressure":
        away.last5AttackingPressureScore,

      quality:
        away.dataQualityScore,
    },
  ]);
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

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );