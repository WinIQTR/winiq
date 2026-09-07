import "dotenv/config";

import {
  prisma,
} from "../src/lib/prisma";

import {
  generateLearnedMatchPrediction,
} from "../src/modules/prediction-engine";

async function main(): Promise<void> {
  /*
   * Öncelikle oynanmamış bir maç aranır.
   * Yoksa test amacıyla en son maç kullanılır.
   */
  const match =
    await prisma.match.findFirst({
      where: {
        status: {
          in: [
            "SCHEDULED",
            "POSTPONED",
          ],
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      select: {
        id: true,
      },
    }) ??
    await prisma.match.findFirst({
      orderBy: {
        kickoffAt:
          "desc",
      },

      select: {
        id: true,
      },
    });

  if (!match) {
    throw new Error(
      "Tahmin testi için maç bulunamadı.",
    );
  }

  const prediction =
    await generateLearnedMatchPrediction({
      matchId:
        match.id,
    });

  console.log(
    "\nLEARNED MATCH PREDICTION\n",
  );

  console.log({
    matchId:
      prediction.match.id,

    match:
      `${prediction.match.homeTeam} - ${prediction.match.awayTeam}`,

    kickoffAt:
      prediction.match.kickoffAt,

    status:
      prediction.match.status,

    predictedOutcome:
      prediction.predictedOutcome,

    predictedProbability:
      prediction.predictedProbability,

    confidenceScore:
      prediction.confidenceScore,

    confidenceLevel:
      prediction.confidenceLevel,

    featureCount:
      prediction.model.featureCount,
  });

  console.log(
    "\nPROBABILITIES\n",
  );

  console.table([
    {
      outcome: "HOME",
      probability:
        prediction.probabilities.home,
      fairOdds:
        prediction.fairOdds.home,
    },
    {
      outcome: "DRAW",
      probability:
        prediction.probabilities.draw,
      fairOdds:
        prediction.fairOdds.draw,
    },
    {
      outcome: "AWAY",
      probability:
        prediction.probabilities.away,
      fairOdds:
        prediction.fairOdds.away,
    },
  ]);

  console.log(
    "\nFEATURE VECTOR\n",
  );

  console.table(
    Object.entries(
      prediction.featureVector,
    ).map(
      ([featureName, value]) => ({
        featureName,
        value,
      }),
    ),
  );

  console.log(
    "\nMODEL\n",
  );

  console.log(
    prediction.model,
  );

  if (
    prediction.warnings.length > 0
  ) {
    console.log("\nUYARILAR\n");

    for (
      const warning
      of prediction.warnings
    ) {
      console.warn(
        `- ${warning}`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "Learned Match Prediction testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });