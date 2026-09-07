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

const DEFAULT_SEASON_YEAR =
  2024;

/*
 * V1 CORE MODEL
 *
 * İlk gerçek production baseline modelimizi
 * 7 organizasyonda ortak ve tarihsel olarak
 * üretilebilen feature'larla kuruyoruz.
 *
 * Squad / Shot Threat / xG / Player Impact
 * daha sonra ayrı model karşılaştırmalarıyla
 * eklenecek.
 */
const CORE_MODEL_FEATURE_KEYS = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",

  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

function getSeasonYear(): number {
  const raw =
    process.env
      .API_FOOTBALL_SEASON
      ?.trim();

  if (!raw) {
    return DEFAULT_SEASON_YEAR;
  }

  const parsed =
    Number.parseInt(
      raw,
      10,
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < 2000 ||
    parsed > 2100
  ) {
    throw new Error(
      "API_FOOTBALL_SEASON geçerli bir sezon yılı olmalıdır.",
    );
  }

  return parsed;
}

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
  const seasonYear =
    getSeasonYear();

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "V1 CORE MODEL BACKTEST",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Sezon: ${seasonYear}`,
  );

  console.log(
    `Organizasyon: ${ACTIVE_COMPETITIONS.length}`,
  );

  console.log(
    `Core feature: ${CORE_MODEL_FEATURE_KEYS.length}`,
  );

  const allRows:
    Awaited<
      ReturnType<
        typeof collectTrainingData
      >
    >["rows"] = [];

  let totalFinishedMatches =
    0;

  let totalCollectorSkipped =
    0;

  const collectionSummary:
    Array<{
      apiId: number;

      competition:
        string;

      finished:
        number;

      collected:
        number;

      skipped:
        number;
    }> = [];

  /*
   * ============================================================
   * DATA COLLECTION
   * ============================================================
   */
  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    console.log("");

    console.log(
      `Collecting: ${competition.name} (${competition.apiId})`,
    );

    const result =
      await collectTrainingData({
        leagueApiId:
          competition.apiId,

        seasonYear,

        /*
         * Yalnızca production baseline modelinin
         * kullandığı feature'ları istiyoruz.
         *
         * Böylece modelin kullanmayacağı squad /
         * shot / xG alanlarının eksikliği yüzünden
         * maç kaybetmiyoruz.
         */
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

    totalFinishedMatches +=
      result.totalFinishedMatches;

    totalCollectorSkipped +=
      result.skippedMatchCount;

    collectionSummary.push({
      apiId:
        competition.apiId,

      competition:
        competition.name,

      finished:
        result.totalFinishedMatches,

      collected:
        result.collectedMatchCount,

      skipped:
        result.skippedMatchCount,
    });

    console.log(
      [
        `finished ${result.totalFinishedMatches}`,
        `collected ${result.collectedMatchCount}`,
        `skipped ${result.skippedMatchCount}`,
      ].join(" • "),
    );

    for (
      const warning
      of result.warnings
    ) {
      console.log(
        `  Warning: ${warning}`,
      );
    }
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "DATA COLLECTION",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    collectionSummary,
  );

  if (
    allRows.length <
    2
  ) {
    throw new Error(
      "Backtest için yeterli training row bulunamadı.",
    );
  }

  /*
   * ============================================================
   * TRAINING MATRIX
   * ============================================================
   *
   * Mevcut model yalnızca DIFF feature'ları
   * kullanıyor.
   *
   * Bu nedenle HOME + AWAY kolonlarını matrise
   * koyup eksik veri oranını gereksiz yere
   * artırmıyoruz.
   */
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

  /*
   * ============================================================
   * CHRONOLOGICAL SPLIT
   * ============================================================
   *
   * Random split kullanmıyoruz.
   *
   * Eski maçlar:
   * TRAIN
   *
   * Daha yeni maçlar:
   * VALIDATION
   */
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

  /*
   * ============================================================
   * MODEL
   * ============================================================
   */
  const result =
    trainSimpleLearningModel(
      split,
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "DATASET",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    "Finished matches":
      totalFinishedMatches,

    "Collected rows":
      allRows.length,

    "Collector skipped":
      totalCollectorSkipped,

    "Matrix rows":
      matrix.rowCount,

    "Matrix columns":
      matrix.columnCount,

    "Matrix skipped":
      matrix.skippedRowCount,

    "Imputed values":
      matrix.imputedValueCount,

    "Training rows":
      split.training.rowCount,

    "Validation rows":
      split.validation.rowCount,

    "Training %":
      split.trainingPercentage,

    "Validation %":
      split.validationPercentage,

    "Split date":
      split.splitDate
        .toISOString(),
  });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "GLOBAL MODEL RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    Epochs:
      result.model
        .epochsCompleted,

    "Training loss":
      result.model
        .finalTrainingLoss,

    "Training accuracy":
      result.trainingMetrics
        .accuracyPercentage,

    "Validation accuracy":
      result.validationMetrics
        .accuracyPercentage,

    "Accuracy gap":
      round(
        result.trainingMetrics
          .accuracyPercentage -
        result.validationMetrics
          .accuracyPercentage,
      ),

    "Brier score":
      result.validationMetrics
        .brierScore,

    "Log loss":
      result.validationMetrics
        .logLoss,

    "Average confidence":
      result.validationMetrics
        .averageConfidencePercentage,
  });

  /*
   * ============================================================
   * HOME / DRAW / AWAY
   * ============================================================
   */
  console.log("");
  console.log(
    "OUTCOME PERFORMANCE",
  );

  console.log("");

  console.table(
    result.validationMetrics
      .outcomePerformance
      .map(
        (
          item,
        ) => ({
          outcome:
            item.outcome,

          actual:
            item.actualCount,

          predicted:
            item.predictedCount,

          correct:
            item.correctCount,

          recall:
            item.recallPercentage,

          precision:
            item.precisionPercentage,
        }),
      ),
  );

  /*
   * ============================================================
   * COMPETITION VALIDATION
   * ============================================================
   */
  const trainingRowByMatchId =
    new Map(
      allRows.map(
        (
          row,
        ) => [
          row.matchId,
          row,
        ],
      ),
    );

  const competitionResults =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) => {
        const predictions =
          result.validationPredictions
            .filter(
              (
                prediction,
              ) =>
                trainingRowByMatchId
                  .get(
                    prediction.matchId,
                  )
                  ?.leagueApiId ===
                competition.apiId,
            );

        const correct =
          predictions.filter(
            (
              prediction,
            ) =>
              prediction.isCorrect,
          ).length;

        const accuracy =
          predictions.length >
          0
            ? round(
                (
                  correct /
                  predictions.length
                ) *
                  100,
              )
            : null;

        const averageConfidence =
          predictions.length >
          0
            ? round(
                predictions.reduce(
                  (
                    total,
                    prediction,
                  ) =>
                    total +
                    prediction
                      .confidencePercentage,
                  0,
                ) /
                  predictions.length,
              )
            : null;

        return {
          apiId:
            competition.apiId,

          competition:
            competition.name,

          matches:
            predictions.length,

          correct,

          accuracy,

          confidence:
            averageConfidence,
        };
      },
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "COMPETITION VALIDATION RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    competitionResults,
  );

  /*
   * ============================================================
   * FEATURES
   * ============================================================
   */
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MODEL FEATURES",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    result.model
      .featureNames
      .map(
        (
          featureName,
          index,
        ) => ({
          index:
            index + 1,

          feature:
            featureName,
        }),
      ),
  );

  /*
   * ============================================================
   * WARNINGS
   * ============================================================
   */
  const warnings = [
    ...matrix.warnings,
    ...split.warnings,
    ...result.warnings,
  ];

  if (
    warnings.length >
    0
  ) {
    console.log("");
    console.log(
      "========================================",
    );

    console.log(
      "WARNINGS",
    );

    console.log(
      "========================================",
    );

    console.log("");

    for (
      const warning
      of warnings
    ) {
      console.log(
        `• ${warning}`,
      );
    }
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "BACKTEST COMPLETE",
  );

  console.log(
    "========================================",
  );
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