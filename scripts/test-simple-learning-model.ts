import "dotenv/config";

import {
  prisma,
} from "../src/lib/prisma";

import {
  buildTrainingMatrix,
  collectTrainingData,
  evaluateBaselineModel,
  splitTrainingValidationChronologically,
  trainSimpleLearningModel,
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

  const learning =
    trainSimpleLearningModel(
      split,
      {
        learningRate:
          0.05,

        maximumEpochs:
          5000,

        l2Regularization:
          0.001,

        convergenceTolerance:
          0.0000001,
      },
    );

  const baselineAccuracy =
    baseline.validationMetrics
      .accuracyPercentage;

  const learningAccuracy =
    learning.validationMetrics
      .accuracyPercentage;

  console.log(
    "\nSIMPLE LEARNING MODEL TESTİ\n",
  );

  console.log({
    featureCount:
      learning.model
        .featureNames.length,

    epochsCompleted:
      learning.model
        .epochsCompleted,

    finalTrainingLoss:
      learning.model
        .finalTrainingLoss,

    baselineAccuracy,

    trainingAccuracy:
      learning.trainingMetrics
        .accuracyPercentage,

    validationAccuracy:
      learning.validationMetrics
        .accuracyPercentage,

    accuracyImprovement:
      Math.round(
        (
          learningAccuracy -
          baselineAccuracy
        ) *
          100,
      ) / 100,

    validationBrierScore:
      learning.validationMetrics
        .brierScore,

    validationLogLoss:
      learning.validationMetrics
        .logLoss,

    averageConfidence:
      learning.validationMetrics
        .averageConfidencePercentage,
  });

  console.log(
    "\nÖĞRENİLEN FEATURE'LAR\n",
  );

  console.table(
    learning.model
      .standardization,
  );

  console.log(
    "\nÖĞRENİLEN AĞIRLIKLAR\n",
  );

  const outcomes = [
    "HOME",
    "DRAW",
    "AWAY",
  ];

  console.table(
    learning.model.weights.map(
      (weights, classIndex) => ({
        outcome:
          outcomes[classIndex],

        bias:
          weights[0],

        form:
          weights[1],

        goalsScored:
          weights[2],

        goalsConceded:
          weights[3],

        restDays:
          weights[4],
      }),
    ),
  );

  console.log(
    "\nVALIDATION OUTCOME PERFORMANCE\n",
  );

  console.table(
    learning.validationMetrics
      .outcomePerformance,
  );

  console.log(
    "\nİLK 10 VALIDATION TAHMİNİ\n",
  );

  console.table(
    learning.validationPredictions
      .slice(0, 10),
  );

  if (
    learning.warnings.length > 0
  ) {
    console.log("\nUYARILAR\n");

    for (
      const warning
      of learning.warnings
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
      "Simple Learning Model testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });