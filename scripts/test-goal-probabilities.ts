import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "GOAL PROBABILITY ENGINE TEST",
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

  const result =
    await calculateGoalProbabilities(
      match.id,
    );

  console.log("");
  console.log(
    "EXPECTED GOALS",
  );

  console.table({
    Home:
      result.expectedGoals.home,

    Away:
      result.expectedGoals.away,
  });

  console.log("");
  console.log(
    "1X2",
  );

  console.table(
    result.outcomeProbabilities,
  );

  console.log("");
  console.log(
    "BTTS",
  );

  console.table(
    result.btts,
  );

  console.log("");
  console.log(
    "TOTAL GOALS",
  );

  console.table(
    result.totals,
  );

  console.log("");
  console.log(
    "MOST LIKELY SCORES",
  );

  console.table(
    result.mostLikelyScores.map(
      (
        score,
      ) => ({
        score:
          `${score.homeGoals}-${score.awayGoals}`,

        probability:
          score.probability,
      }),
    ),
  );

  if (
    result.warnings.length >
    0
  ) {
    console.log("");
    console.log(
      "WARNINGS",
    );

    for (
      const warning
      of result.warnings
    ) {
      console.log(
        `• ${warning}`,
      );
    }
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

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );