import "dotenv/config";

import { MatchStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculate1x2Probabilities } from "../src/modules/probability-engine";

function getActualOutcome(options: {
  homeScore: number | null;
  awayScore: number | null;
}): "HOME" | "DRAW" | "AWAY" | "UNKNOWN" {
  if (
    options.homeScore === null ||
    options.awayScore === null
  ) {
    return "UNKNOWN";
  }

  if (
    options.homeScore >
    options.awayScore
  ) {
    return "HOME";
  }

  if (
    options.homeScore <
    options.awayScore
  ) {
    return "AWAY";
  }

  return "DRAW";
}

async function main(): Promise<void> {
  const match =
    await prisma.match.findFirst({
      where: {
        status:
          MatchStatus.FINISHED,

        season: {
          year: 2024,

          league: {
            apiId: 39,
          },
        },
      },

      orderBy: {
        kickoffAt: "desc",
      },
    });

  if (!match) {
    throw new Error(
      "Probability Engine testi için maç bulunamadı.",
    );
  }

  const result =
    await calculate1x2Probabilities(
      match.id,
    );

  const actualOutcome =
    getActualOutcome({
      homeScore:
        result.match.actualHomeScore,

      awayScore:
        result.match.actualAwayScore,
    });

  console.log(
    "\nPROBABILITY ENGINE TESTİ\n",
  );

  console.log({
    match:
      `${result.match.homeTeam} - ${result.match.awayTeam}`,

    actualScore:
      `${result.match.actualHomeScore} - ${result.match.actualAwayScore}`,

    actualOutcome,

    predictedOutcome:
      result.predictedOutcome,

    predictionCorrect:
      actualOutcome ===
      result.predictedOutcome,

    homeOverall:
      result.rating.homeOverall,

    awayOverall:
      result.rating.awayOverall,

    rawDifference:
      result.rating.rawDifference,

    homeAdvantage:
      result.rating.homeAdvantage,

    adjustedDifference:
      result.rating.adjustedDifference,

    probabilities:
      result.probabilities,

    fairOdds:
      result.fairOdds,

    predictedProbability:
      result.predictedProbability,

    confidenceScore:
      result.confidenceScore,

    confidenceLevel:
      result.confidenceLevel,
  });

  if (
    result.warnings.length > 0
  ) {
    console.log("\nUYARILAR\n");

    for (
      const warning of result.warnings
    ) {
      console.log(`- ${warning}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "Probability Engine testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });