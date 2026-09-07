import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "PLAYER DATA CHECK",
  );
  console.log(
    "========================================",
  );
  console.log("");

  const [
    playerCount,
    activePlayerCount,
    statisticCount,
    playersWithStatistics,
  ] = await Promise.all([
    prisma.player.count(),

    prisma.player.count({
      where: {
        isActive: true,
      },
    }),

    prisma.playerSeasonStatistic.count(),

    prisma.player.count({
      where: {
        seasonStatistics: {
          some: {},
        },
      },
    }),
  ]);

  console.log(
    "GENEL DURUM",
  );

  console.table({
    "Toplam oyuncu":
      playerCount,

    "Aktif oyuncu":
      activePlayerCount,

    "Sezon istatistik kaydı":
      statisticCount,

    "İstatistiği olan oyuncu":
      playersWithStatistics,
  });

  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "ORNEK OYUNCULAR",
  );
  console.log(
    "========================================",
  );
  console.log("");

  const players =
    await prisma.player.findMany({
      where: {
        isActive: true,
      },

      select: {
        id: true,
        name: true,
        age: true,
        position: true,
        shirtNumber: true,
        marketValue: true,

        team: {
          select: {
            name: true,
          },
        },

        seasonStatistics: {
          select: {
            appearances: true,
            starts: true,
            minutes: true,

            goals: true,
            assists: true,

            expectedGoals: true,
            expectedAssists: true,

            shots: true,
            shotsOnTarget: true,

            keyPasses: true,

            bigChancesCreated: true,
            bigChancesMissed: true,

            successfulDribbles: true,

            tackles: true,
            interceptions: true,
            clearances: true,

            duelsWon: true,
            aerialDuelsWon: true,

            passAccuracy: true,

            yellowCards: true,
            redCards: true,

            averageRating: true,

            season: {
              select: {
                year: true,
              },
            },
          },

          orderBy: {
            season: {
              year: "desc",
            },
          },

          take: 1,
        },
      },

      orderBy: {
        name: "asc",
      },

      take: 20,
    });

  console.table(
    players.map(
      (player) => {
        const stats =
          player.seasonStatistics[0];

        return {
          oyuncu:
            player.name,

          takım:
            player.team?.name ??
            "—",

          pozisyon:
            player.position,

          yaş:
            player.age ?? "—",

          sezon:
            stats?.season.year ??
            "—",

          maç:
            stats?.appearances ??
            0,

          ilk11:
            stats?.starts ??
            0,

          dakika:
            stats?.minutes ??
            0,

          gol:
            stats?.goals ??
            0,

          asist:
            stats?.assists ??
            0,

          xG:
            stats?.expectedGoals ??
            null,

          xA:
            stats?.expectedAssists ??
            null,

          rating:
            stats?.averageRating ??
            null,
        };
      },
    ),
  );

  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "ISTATISTIK DOLULUK KONTROLU",
  );
  console.log(
    "========================================",
  );
  console.log("");

  const statistics =
    await prisma.playerSeasonStatistic.findMany({
      select: {
        appearances: true,
        minutes: true,

        goals: true,
        assists: true,

        expectedGoals: true,
        expectedAssists: true,

        shots: true,
        shotsOnTarget: true,

        keyPasses: true,

        tackles: true,
        interceptions: true,

        passAccuracy: true,

        averageRating: true,
      },
    });

  function countPositive(
    selector: (
      statistic: (typeof statistics)[number],
    ) => number | null,
  ): number {
    return statistics.filter(
      (statistic) => {
        const value =
          selector(statistic);

        return (
          value !== null &&
          Number(value) > 0
        );
      },
    ).length;
  }

  console.table({
    appearances:
      countPositive(
        (statistic) =>
          statistic.appearances,
      ),

    minutes:
      countPositive(
        (statistic) =>
          statistic.minutes,
      ),

    goals:
      countPositive(
        (statistic) =>
          statistic.goals,
      ),

    assists:
      countPositive(
        (statistic) =>
          statistic.assists,
      ),

    expectedGoals:
      countPositive(
        (statistic) =>
          statistic.expectedGoals,
      ),

    expectedAssists:
      countPositive(
        (statistic) =>
          statistic.expectedAssists,
      ),

    shots:
      countPositive(
        (statistic) =>
          statistic.shots,
      ),

    shotsOnTarget:
      countPositive(
        (statistic) =>
          statistic.shotsOnTarget,
      ),

    keyPasses:
      countPositive(
        (statistic) =>
          statistic.keyPasses,
      ),

    tackles:
      countPositive(
        (statistic) =>
          statistic.tackles,
      ),

    interceptions:
      countPositive(
        (statistic) =>
          statistic.interceptions,
      ),

    passAccuracy:
      countPositive(
        (statistic) =>
          statistic.passAccuracy,
      ),

    averageRating:
      countPositive(
        (statistic) =>
          statistic.averageRating,
      ),
  });
}

main()
  .catch(
    (error: unknown) => {
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