import "dotenv/config";

import {
  prisma,
} from "../src/lib/prisma";

import {
  buildTrainingMatrix,
  collectTrainingData,
  evaluateBaselineModel,
  optimizeSimpleLearningModel,
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
    "\nWEIGHT OPTIMIZER BAŞLADI\n",
  );

  const optimizer =
    optimizeSimpleLearningModel(
      split,
      {
        leaderboardSize: 10,

        onProgress: (
          candidate,
          totalCandidateCount,
        ) => {
          console.log(
            [
              `[${candidate.candidateNumber}/${totalCandidateCount}]`,

              `LR=${candidate.configuration.learningRate}`,

              `Epoch=${candidate.configuration.maximumEpochs}`,

              `L2=${candidate.configuration.l2Regularization}`,

              `Accuracy=${candidate.validationAccuracy}`,

              `Brier=${candidate.validationBrierScore}`,

              `LogLoss=${candidate.validationLogLoss}`,
            ].join(" | "),
          );
        },
      },
    );

  const best =
    optimizer.bestCandidate;

  console.log(
    "\nWEIGHT OPTIMIZER SONUCU\n",
  );

  console.log({
    evaluatedCandidateCount:
      optimizer
        .evaluatedCandidateCount,

    featureCount:
      best.configuration
        .featureNames.length,

    baselineAccuracy:
      baseline.validationMetrics
        .accuracyPercentage,

    bestValidationAccuracy:
      best.validationAccuracy,

    accuracyImprovement:
      Math.round(
        (
          best.validationAccuracy -
          baseline
            .validationMetrics
            .accuracyPercentage
        ) *
          100,
      ) / 100,

    bestBrierScore:
      best.validationBrierScore,

    bestLogLoss:
      best.validationLogLoss,

    averageConfidence:
      best
        .averageConfidencePercentage,

    trainingAccuracy:
      best.trainingAccuracy,

    epochsCompleted:
      best.epochsCompleted,

    learningRate:
      best.configuration
        .learningRate,

    maximumEpochs:
      best.configuration
        .maximumEpochs,

    l2Regularization:
      best.configuration
        .l2Regularization,

    convergenceTolerance:
      best.configuration
        .convergenceTolerance,
  });

  console.log(
    "\nEN İYİ 10 ADAY\n",
  );

  console.table(
    optimizer.leaderboard.map(
      (candidate, index) => ({
        rank:
          index + 1,

        candidate:
          candidate.candidateNumber,

        learningRate:
          candidate.configuration
            .learningRate,

        maxEpochs:
          candidate.configuration
            .maximumEpochs,

        l2:
          candidate.configuration
            .l2Regularization,

        epochsCompleted:
          candidate.epochsCompleted,

        trainingAccuracy:
          candidate.trainingAccuracy,

        validationAccuracy:
          candidate.validationAccuracy,

        brier:
          candidate.validationBrierScore,

        logLoss:
          candidate.validationLogLoss,

        confidence:
          candidate
            .averageConfidencePercentage,
      }),
    ),
  );

  console.log(
    "\nEN İYİ MODELİN OUTCOME PERFORMANSI\n",
  );

  console.table(
    optimizer
      .bestLearningResult
      .validationMetrics
      .outcomePerformance,
  );

  if (
    optimizer.warnings.length > 0
  ) {
    console.log("\nUYARILAR\n");

    for (
      const warning
      of optimizer.warnings
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
      "Weight Optimizer testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });