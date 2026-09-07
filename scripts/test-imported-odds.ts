import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "IMPORTED ODDS TEST",
  );

  console.log(
    "==============================================",
  );

  const [
    bookmakerCount,
    snapshotCount,
    marketCount,
    selectionCount,
  ] =
    await Promise.all([
      prisma.bookmaker.count(),

      prisma.oddsSnapshot.count(),

      prisma.oddsMarket.count(),

      prisma.oddsSelection.count(),
    ]);

  console.table({
    Bookmaker:
      bookmakerCount,

    Snapshot:
      snapshotCount,

    Market:
      marketCount,

    Selection:
      selectionCount,
  });

  const latestSnapshots =
    await prisma.oddsSnapshot.findMany({
      orderBy: {
        sourceUpdatedAt:
          "desc",
      },

      take:
        10,

      select: {
        sourceUpdatedAt:
          true,

        bookmaker: {
          select: {
            name:
              true,
          },
        },

        match: {
          select: {
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
        },

        markets: {
          select: {
            marketName:
              true,

            marketFamily:
              true,

            selections: {
              select: {
                selectionName:
                  true,

                decimalOdds:
                  true,

                impliedProbability:
                  true,

                normalizedProbability:
                  true,
              },

              orderBy: {
                selectionName:
                  "asc",
              },
            },
          },

          orderBy: {
            marketFamily:
              "asc",
          },
        },
      },
    });

  for (
    const snapshot
    of latestSnapshots
  ) {
    console.log("");
    console.log(
      [
        snapshot.match.homeTeam.name,
        "-",
        snapshot.match.awayTeam.name,
        "•",
        snapshot.bookmaker.name,
      ].join(
        " ",
      ),
    );

    console.log(
      snapshot.sourceUpdatedAt.toISOString(),
    );

    console.table(
      snapshot.markets.flatMap(
        (
          market,
        ) =>
          market.selections.map(
            (
              selection,
            ) => ({
              market:
                market.marketName,

              family:
                market.marketFamily,

              selection:
                selection.selectionName,

              odds:
                selection.decimalOdds,

              implied:
                selection.impliedProbability.toFixed(
                  2,
                ),

              normalized:
                selection.normalizedProbability?.toFixed(
                  2,
                ) ??
                "—",
            }),
          ),
      ),
    );
  }

  console.log("");
  console.log(
    "IMPORTED ODDS TESTİ TAMAMLANDI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Imported odds testi başarısız.",
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