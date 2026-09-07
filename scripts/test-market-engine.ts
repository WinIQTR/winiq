import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  calculateMarketsFromGoalModel,
} from "@/modules/market-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MARKET ENGINE V1 TEST",
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
      },

      orderBy: {
        kickoffAt:
          "desc",
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
    });

  if (
    !match
  ) {
    throw new Error(
      "Test maçı bulunamadı.",
    );
  }

  console.log("");
  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

  const goalModel =
    await calculateGoalProbabilities(
      match.id,
    );

  const markets =
    calculateMarketsFromGoalModel(
      goalModel,
    );

  console.log("");
  console.log(
    "SUMMARY",
  );

  console.table({
    matchId:
      markets.matchId,

    selections:
      markets
        .selections
        .length,

    topSelections:
      markets
        .topSelections
        .length,

    model:
      markets
        .model
        .version,
  });

  console.log("");
  console.log(
    "ALL MARKETS",
  );

  console.table(
    markets.selections.map(
      (
        item,
      ) => ({
        key:
          item.key,

        category:
          item.category,

        market:
          item.market,

        selection:
          item.selection,

        probability:
          item.probability,

        fairOdds:
          item.fairOdds,
      }),
    ),
  );

  console.log("");
  console.log(
    "TOP 15 BY PROBABILITY",
  );

  console.table(
    markets
      .topSelections
      .map(
        (
          item,
          index,
        ) => ({
          rank:
            index + 1,

          market:
            item.market,

          selection:
            item.selection,

          probability:
            item.probability,

          fairOdds:
            item.fairOdds,
        }),
      ),
  );
}

main()
  .catch(
    (
      error:
        unknown,
    ) => {
      console.error("");

      console.error(
        error instanceof
        Error
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