import {
  prisma,
} from "@/lib/prisma";

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "PLAYER MATCH PERFORMANCE CHECK",
  );
  console.log(
    "========================================",
  );
  console.log("");

  const [
    total,
    withRating,
    starters,
  ] = await Promise.all([
    prisma.playerMatchPerformance.count(),

    prisma.playerMatchPerformance.count({
      where: {
        rating: {
          not: null,
        },
      },
    }),

    prisma.playerMatchPerformance.count({
      where: {
        starter: true,
      },
    }),
  ]);

  console.table({
    "Toplam performans":
      total,

    "Rating bulunan":
      withRating,

    "İlk 11 kayıt":
      starters,
  });

  const matches =
    await prisma.match.findMany({
      where: {
        playerPerformances: {
          some: {},
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

        playerPerformances: {
          where: {
            rating: {
              not: null,
            },
          },

          select: {
            rating: true,
            minutes: true,
            starter: true,
            goals: true,
            assists: true,

            player: {
              select: {
                name: true,
                position: true,
              },
            },

            team: {
              select: {
                name: true,
              },
            },
          },

          orderBy: {
            rating: "desc",
          },
        },
      },

      orderBy: {
        kickoffAt: "asc",
      },

      take: 10,
    });

  for (const match of matches) {
    console.log("");
    console.log(
      "========================================",
    );

    console.log(
      `${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    console.log(
      "========================================",
    );

    console.table(
      match.playerPerformances.map(
        (performance) => ({
          oyuncu:
            performance.player.name,

          takım:
            performance.team.name,

          pozisyon:
            performance.player.position,

          rating:
            performance.rating,

          dakika:
            performance.minutes,

          ilk11:
            performance.starter
              ? "EVET"
              : "HAYIR",

          gol:
            performance.goals,

          asist:
            performance.assists,
        }),
      ),
    );
  }

  const ratingValues =
    await prisma.playerMatchPerformance.findMany({
      where: {
        rating: {
          not: null,
        },
      },

      select: {
        rating: true,
      },
    });

  const ratings =
    ratingValues
      .map(
        (item) =>
          item.rating,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  if (
    ratings.length > 0
  ) {
    const average =
      ratings.reduce(
        (
          totalValue,
          value,
        ) =>
          totalValue +
          value,
        0,
      ) /
      ratings.length;

    console.log("");
    console.log(
      "========================================",
    );

    console.log(
      "RATING SUMMARY",
    );

    console.log(
      "========================================",
    );

    console.table({
      Minimum:
        Math.min(
          ...ratings,
        ),

      Maksimum:
        Math.max(
          ...ratings,
        ),

      Ortalama:
        round(
          average,
        ),

      "Rating sayısı":
        ratings.length,
    });
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