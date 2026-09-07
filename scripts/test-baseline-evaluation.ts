import "dotenv/config";

import {
  prisma,
} from "../src/lib/prisma";

import {
  buildTrainingMatrix,
  collectTrainingData,
  evaluateBaselineModel,
  splitTrainingValidationChronologically,
} from "../src/modules/learning-engine";

async function main(): Promise<void> {
  const collection =
    await collectTrainingData({
      leagueApiId: 39,
      seasonYear: 2024,

      includeExperimentalFeatures:
        true,

      strictPreMatchOnly:
        true,

      minimumDataQualityScore:
        0,
    });

  const matrix =
    buildTrainingMatrix(
      collection.rows,
      {
        includeSideFeatures:
          true,

        includeDifferenceFeatures:
          true,

        missingValueStrategy:
          "COLUMN_MEAN",

        maximumMissingRatio:
          0.5,
      },
    );

  const split =
    splitTrainingValidationChronologically(
      matrix,
      {
        trainingPercentage:
          70,

        minimumTrainingRows:
          200,

        minimumValidationRows:
          80,
      },
    );

  const baseline =
    evaluateBaselineModel(split);

  console.log(
    "\nBASELINE MODEL EVALUATION\n",
  );

  console.log({
    trainingRowCount:
      baseline.trainingRowCount,

    validationRowCount:
      baseline.validationRowCount,

    predictedOutcome:
      baseline
        .validationMetrics
        .predictedOutcome,

    accuracyPercentage:
      baseline
        .validationMetrics
        .accuracyPercentage,

    brierScore:
      baseline
        .validationMetrics
        .brierScore,

    logLoss:
      baseline
        .validationMetrics
        .logLoss,

    correctPredictionCount:
      baseline
        .validationMetrics
        .correctPredictionCount,

    incorrectPredictionCount:
      baseline
        .validationMetrics
        .incorrectPredictionCount,
  });

  console.log(
    "\nTRAINING OUTCOME DISTRIBUTION\n",
  );

  console.table([
    {
      outcome: "HOME",

      count:
        baseline
          .trainingOutcomeDistribution
          .homeCount,

      percentage:
        baseline
          .trainingOutcomeDistribution
          .homePercentage,
    },
    {
      outcome: "DRAW",

      count:
        baseline
          .trainingOutcomeDistribution
          .drawCount,

      percentage:
        baseline
          .trainingOutcomeDistribution
          .drawPercentage,
    },
    {
      outcome: "AWAY",

      count:
        baseline
          .trainingOutcomeDistribution
          .awayCount,

      percentage:
        baseline
          .trainingOutcomeDistribution
          .awayPercentage,
    },
  ]);

  console.log(
    "\nBASELINE PROBABILITIES\n",
  );

  console.table([
    {
      outcome: "HOME",

      probability:
        baseline
          .validationMetrics
          .predictedProbabilities
          .home,
    },
    {
      outcome: "DRAW",

      probability:
        baseline
          .validationMetrics
          .predictedProbabilities
          .draw,
    },
    {
      outcome: "AWAY",

      probability:
        baseline
          .validationMetrics
          .predictedProbabilities
          .away,
    },
  ]);

  console.log(
    "\nOUTCOME PERFORMANCE\n",
  );

  console.table(
    baseline
      .validationMetrics
      .outcomePerformance,
  );

  if (
    baseline.warnings.length > 0
  ) {
    console.log("\nUYARILAR\n");

    for (
      const warning
      of baseline.warnings
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
      "Baseline Evaluation testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });