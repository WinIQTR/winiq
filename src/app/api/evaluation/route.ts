import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";

import {
  HISTORICAL_MODEL_SEASON_LABEL,
  HISTORICAL_MODEL_SEASON_YEAR,
} from "@/config/season";

import {
  buildTrainingMatrix,
  collectTrainingData,
  evaluateBaselineModel,
  splitTrainingValidationChronologically,
  trainSimpleLearningModel,
} from "@/modules/learning-engine";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const startedAt = Date.now();

  try {
    const collection =
      await collectTrainingData({
        leagueApiId: 39,
        seasonYear: HISTORICAL_MODEL_SEASON_YEAR,

        includeExperimentalFeatures: true,

        /*
         * Geçmiş sezon feature'larının bir kısmı
         * maçlardan sonra üretildiği için şimdilik false.
         */
        strictPreMatchOnly: true,

        minimumDataQualityScore: 0,
      });

    const matrix =
      buildTrainingMatrix(
        collection.rows,
        {
          includeSideFeatures: true,

          includeDifferenceFeatures: true,

          missingValueStrategy:
            "COLUMN_MEAN",

          maximumMissingRatio: 0.5,
        },
      );

    const split =
      splitTrainingValidationChronologically(
        matrix,
        {
          trainingPercentage: 70,

          minimumTrainingRows: 200,

          minimumValidationRows: 80,
        },
      );

    const baseline =
      evaluateBaselineModel(split);

    /*
     * trainSimpleLearningModel artık
     * Weight Optimizer'ın seçtiği varsayılan
     * ayarları kullanıyor:
     *
     * learningRate: 0.01
     * maximumEpochs: 1500
     * l2Regularization: 0.05
     */
    const learning =
      trainSimpleLearningModel(split);

    const baselineAccuracy =
      baseline.validationMetrics
        .accuracyPercentage;

    const currentAccuracy =
      learning.validationMetrics
        .accuracyPercentage;

    const correctPredictionCount =
      learning.validationMetrics
        .correctPredictionCount;

    const validationMatchCount =
      learning.validationMetrics
        .evaluatedMatchCount;

    const outcomePerformance =
      learning.validationMetrics
        .outcomePerformance.map(
          (item) => ({
            outcome: item.outcome,

            actualCount:
              item.actualCount,

            predictedCount:
              item.predictedCount,

            correctCount:
              item.correctCount,

            recallPercentage:
              item.recallPercentage,

            precisionPercentage:
              item.precisionPercentage,
          }),
        );

    const durationMilliseconds =
      Date.now() - startedAt;

    return NextResponse.json({
      success: true,

      generatedAt:
        new Date().toISOString(),

      dataRole:
        "HISTORICAL_MODEL_VALIDATION",

      seasonLabel:
        HISTORICAL_MODEL_SEASON_LABEL,

      durationMilliseconds,

      dataStatus:
        collection.warnings.length > 0 ||
        learning.warnings.length > 0
          ? "EXPERIMENTAL"
          : "VALID",

      competition: {
        leagueApiId:
          collection.leagueApiId,

        leagueName:
          collection.rows[0]
            ?.leagueName ??
          "Premier League",

        seasonYear:
          collection.seasonYear,
      },

      dataset: {
        totalFinishedMatches:
          collection.totalFinishedMatches,

        collectedMatchCount:
          collection.collectedMatchCount,

        trainingMatchCount:
          split.training.rowCount,

        validationMatchCount:
          split.validation.rowCount,

        matrixColumnCount:
          matrix.columnCount,

        skippedMatchCount:
          collection.skippedMatchCount +
          matrix.skippedRowCount,

        splitDate:
          split.splitDate.toISOString(),
      },

      performance: {
        correctPredictionCount,

        incorrectPredictionCount:
          learning.validationMetrics
            .incorrectPredictionCount,

        validationMatchCount,

        accuracyPercentage:
          currentAccuracy,

        baselineAccuracyPercentage:
          baselineAccuracy,

        accuracyImprovement:
          round(
            currentAccuracy -
              baselineAccuracy,
          ),

        brierScore:
          learning.validationMetrics
            .brierScore,

        logLoss:
          learning.validationMetrics
            .logLoss,

        averageConfidencePercentage:
          learning.validationMetrics
            .averageConfidencePercentage,
      },

      model: {
        name:
          "Simple Learning Model V2",

        featureCount:
          learning.model
            .featureNames.length,

        featureNames:
          learning.model
            .featureNames,

        learningRate:
          learning.model
            .configuration
            .learningRate,

        maximumEpochs:
          learning.model
            .configuration
            .maximumEpochs,

        l2Regularization:
          learning.model
            .configuration
            .l2Regularization,

        convergenceTolerance:
          learning.model
            .configuration
            .convergenceTolerance,

        epochsCompleted:
          learning.model
            .epochsCompleted,

        finalTrainingLoss:
          learning.model
            .finalTrainingLoss,

        trainingAccuracyPercentage:
          learning.trainingMetrics
            .accuracyPercentage,

        validationAccuracyPercentage:
          currentAccuracy,
      },

      outcomePerformance,

      warnings: [
        ...collection.warnings,
        ...matrix.warnings,
        ...split.warnings,
        ...baseline.warnings,
        ...learning.warnings,
      ],

      recentPredictions:
        learning.validationPredictions
          .slice(0, 10)
          .map((prediction) => ({
            matchId:
              prediction.matchId,

            match:
              prediction.match,

            actualOutcome:
              prediction.actualOutcome,

            predictedOutcome:
              prediction.predictedOutcome,

            homeProbability:
              prediction.homeProbability,

            drawProbability:
              prediction.drawProbability,

            awayProbability:
              prediction.awayProbability,

            confidencePercentage:
              prediction.confidencePercentage,

            isCorrect:
              prediction.isCorrect,
          })),
    });
  } catch (error: unknown) {
    console.error(
      "Evaluation API hatası:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Evaluation çalıştırılırken bilinmeyen hata oluştu.",
      },
      {
        status: 500,
      },
    );
  }
}
