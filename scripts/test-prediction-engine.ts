import "dotenv/config";

import {
  MatchStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  generateMatchPrediction,
} from "../src/modules/prediction-engine";

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

  if (options.homeScore > options.awayScore) {
    return "HOME";
  }

  if (options.homeScore < options.awayScore) {
    return "AWAY";
  }

  return "DRAW";
}

async function main(): Promise<void> {
  const match =
    await prisma.match.findFirst({
      where: {
        status: MatchStatus.FINISHED,

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
      "Prediction Engine testi için maç bulunamadı.",
    );
  }

  const result =
    await generateMatchPrediction({
      matchId: match.id,
    });

  const actualOutcome =
    getActualOutcome({
      homeScore:
        result.match.actualHomeScore,

      awayScore:
        result.match.actualAwayScore,
    });

  console.log(
    "\nBİRLEŞİK PREDICTION ENGINE TESTİ\n",
  );

  console.log({
    match:
      `${result.match.homeTeam} - ${result.match.awayTeam}`,

    actualScore:
      `${result.match.actualHomeScore} - ${result.match.actualAwayScore}`,

    actualOutcome,

    rawProbabilities:
      result.rawProbabilities,

    calibratedProbabilities:
      result.calibratedProbabilities,

    rawPrediction:
      result.rawPredictedOutcome,

    finalPrediction:
      result.predictedOutcome,

    finalProbability:
      result.predictedProbability,

    rawFairOdds:
      result.rawFairOdds,

    calibratedFairOdds:
      result.calibratedFairOdds,

    probabilityConfidence:
      result.probabilityConfidenceScore,

    calibrationReliability:
      result.calibrationReliabilityScore,

    combinedConfidence:
      result.combinedConfidenceScore,

    combinedConfidenceLevel:
      result.combinedConfidenceLevel,

    correct:
      result.predictedOutcome ===
      actualOutcome,

    status:
      result.model.status,
  });

  console.log("\nUYARILAR\n");

  for (const warning of result.warnings) {
    console.log(`- ${warning}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "Prediction Engine testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });