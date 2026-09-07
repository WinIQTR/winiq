import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  buildTrainingMatrix,
  collectTrainingData,
  splitTrainingValidationChronologically,
  trainSimpleLearningModel,
} from "@/modules/learning-engine";

const SEASON_YEAR = 2024;

const CORE_MODEL_FEATURE_KEYS = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

const DRAW_WEIGHTS = [
  1,
  1.25,
  1.5,
  1.75,
  2,
] as const;

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "V1 CLASS WEIGHT TEST",
  );

  console.log(
    "========================================",
  );

  console.log("");

  const allRows:
    Awaited<
      ReturnType<
        typeof collectTrainingData
      >
    >["rows"] = [];

  /*
   * ============================================================
   * DATASET
   * ============================================================
   */
  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    console.log(
      `Collecting: ${competition.name}`,
    );

    const result =
      await collectTrainingData({
        leagueApiId:
          competition.apiId,

        seasonYear:
          SEASON_YEAR,

        featureKeys: [
          ...CORE_MODEL_FEATURE_KEYS,
        ],

        minimumDataQualityScore:
          0,

        strictPreMatchOnly:
          true,
      });

    allRows.push(
      ...result.rows,
    );
  }

  const matrix =
    buildTrainingMatrix(
      allRows,
      {
        includeSideFeatures:
          false,

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
          500,

        minimumValidationRows:
          200,
      },
    );

  console.log("");
  console.log(
    "DATASET READY",
  );

  console.table({
    Rows:
      matrix.rowCount,

    Columns:
      matrix.columnCount,

    Training:
      split.training.rowCount,

    Validation:
      split.validation.rowCount,

    Imputed:
      matrix.imputedValueCount,
  });

  /*
   * ============================================================
   * MODEL TESTS
   * ============================================================
   */
  const results = [];

  for (
    const drawWeight
    of DRAW_WEIGHTS
  ) {
    console.log("");
    console.log(
      `Testing DRAW weight: ${drawWeight}`,
    );

    const result =
      trainSimpleLearningModel(
        split,
        {
          classWeights: {
            HOME:
              1,

            DRAW:
              drawWeight,

            AWAY:
              1,
          },
        },
      );

    const home =
      result.validationMetrics
        .outcomePerformance
        .find(
          (item) =>
            item.outcome ===
            "HOME",
        );

    const draw =
      result.validationMetrics
        .outcomePerformance
        .find(
          (item) =>
            item.outcome ===
            "DRAW",
        );

    const away =
      result.validationMetrics
        .outcomePerformance
        .find(
          (item) =>
            item.outcome ===
            "AWAY",
        );

    results.push({
      drawWeight,

      accuracy:
        result.validationMetrics
          .accuracyPercentage,

      brier:
        result.validationMetrics
          .brierScore,

      logLoss:
        result.validationMetrics
          .logLoss,

      confidence:
        result.validationMetrics
          .averageConfidencePercentage,

      homePredicted:
        home?.predictedCount ??
        0,

      homeRecall:
        home?.recallPercentage ??
        null,

      homePrecision:
        home?.precisionPercentage ??
        null,

      drawPredicted:
        draw?.predictedCount ??
        0,

      drawRecall:
        draw?.recallPercentage ??
        null,

      drawPrecision:
        draw?.precisionPercentage ??
        null,

      awayPredicted:
        away?.predictedCount ??
        0,

      awayRecall:
        away?.recallPercentage ??
        null,

      awayPrecision:
        away?.precisionPercentage ??
        null,
    });
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "CLASS WEIGHT COMPARISON",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    results,
  );

  /*
   * ============================================================
   * SIMPLE SCORE
   * ============================================================
   *
   * Amaç yalnız accuracy seçmek değil.
   *
   * Accuracy yüksek olsun,
   * Brier düşük olsun,
   * Draw tamamen sıfır olmasın.
   */
  const scored =
    results.map(
      (
        item,
      ) => {
        const drawRecall =
          item.drawRecall ??
          0;

        const drawPrecision =
          item.drawPrecision ??
          0;

        /*
         * Basit seçim puanı.
         *
         * Accuracy ana ağırlık.
         * DRAW recall / precision destekleyici.
         * Brier ceza.
         */
        const score =
          item.accuracy *
            0.55 +
          drawRecall *
            0.2 +
          drawPrecision *
            0.15 -
          item.brier *
            10 *
            0.1;

        return {
          ...item,

          score:
            round(
              score,
              4,
            ),
        };
      },
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.score -
        left.score,
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "RANKING",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    scored.map(
      (
        item,
        index,
      ) => ({
        rank:
          index + 1,

        drawWeight:
          item.drawWeight,

        score:
          item.score,

        accuracy:
          item.accuracy,

        drawRecall:
          item.drawRecall,

        drawPrecision:
          item.drawPrecision,

        brier:
          item.brier,

        logLoss:
          item.logLoss,
      }),
    ),
  );

  const best =
    scored[0];

  console.log("");

  if (
    best
  ) {
    console.log(
      `Önerilen DRAW weight: ${best.drawWeight}`,
    );

    console.log(
      `Accuracy: ${best.accuracy}%`,
    );

    console.log(
      `DRAW recall: ${best.drawRecall ?? 0}%`,
    );

    console.log(
      `DRAW precision: ${best.drawPrecision ?? 0}%`,
    );

    console.log(
      `Brier: ${best.brier}`,
    );

    console.log(
      `Log Loss: ${best.logLoss}`,
    );
  }
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  );