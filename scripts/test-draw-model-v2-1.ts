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

import type {
  MatchOutcome,
  SimpleLearningClassWeights,
  TrainingMatrix,
} from "@/modules/learning-engine";

const SEASON_YEAR =
  2024;

const CORE_MODEL_FEATURE_KEYS = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",

  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

type MatrixMode =
  | "DIFF"
  | "DIFF_ABS"
  | "SIDE_DIFF_ABS";

type ExperimentConfig = {
  name: string;

  matrixMode:
    MatrixMode;

  classWeights:
    SimpleLearningClassWeights;
};

const DRAW_WEIGHTS = [
  1.35,
  1.5,
  1.75,
  2,
] as const;

const EXPERIMENTS:
  ExperimentConfig[] = [
  ...DRAW_WEIGHTS.map(
    (
      drawWeight,
    ) => ({
      name:
        `DIFF_DRAW_${drawWeight.toFixed(
          2,
        )}`,

      matrixMode:
        "DIFF" as const,

      classWeights: {
        HOME:
          1,

        DRAW:
          drawWeight,

        AWAY:
          1,
      },
    }),
  ),

  ...DRAW_WEIGHTS.map(
    (
      drawWeight,
    ) => ({
      name:
        `DIFF_ABS_DRAW_${drawWeight.toFixed(
          2,
        )}`,

      matrixMode:
        "DIFF_ABS" as const,

      classWeights: {
        HOME:
          1,

        DRAW:
          drawWeight,

        AWAY:
          1,
      },
    }),
  ),

  ...DRAW_WEIGHTS.map(
    (
      drawWeight,
    ) => ({
      name:
        `SIDE_DIFF_ABS_DRAW_${drawWeight.toFixed(
          2,
        )}`,

      matrixMode:
        "SIDE_DIFF_ABS" as const,

      classWeights: {
        HOME:
          1,

        DRAW:
          drawWeight,

        AWAY:
          1,
      },
    }),
  ),
];

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 **
    decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function calculateOutcomeDistribution(
  values:
    MatchOutcome[],
): {
  home: number;
  draw: number;
  away: number;
} {
  return {
    home:
      values.filter(
        (
          value,
        ) =>
          value ===
          "HOME",
      ).length,

    draw:
      values.filter(
        (
          value,
        ) =>
          value ===
          "DRAW",
      ).length,

    away:
      values.filter(
        (
          value,
        ) =>
          value ===
          "AWAY",
      ).length,
  };
}

function addAbsoluteDifferenceFeatures(
  matrix:
    TrainingMatrix,
): TrainingMatrix {
  const diffFeatureIndexes =
    matrix.featureNames
      .map(
        (
          featureName,
          index,
        ) => ({
          featureName,
          index,
        }),
      )
      .filter(
        (
          item,
        ) =>
          item
            .featureName
            .startsWith(
              "diff_",
            ),
      );

  if (
    diffFeatureIndexes.length ===
    0
  ) {
    throw new Error(
      "Matrix içinde diff feature bulunamadı.",
    );
  }

  const absoluteFeatureNames =
    diffFeatureIndexes.map(
      (
        item,
      ) =>
        `abs_${item.featureName}`,
    );

  const newFeatureNames = [
    ...matrix.featureNames,
    ...absoluteFeatureNames,
  ];

  const newX =
    matrix.X.map(
      (
        row,
      ) => [
        ...row,

        ...diffFeatureIndexes.map(
          (
            item,
          ) =>
            Math.abs(
              row[
                item.index
              ],
            ),
        ),
      ],
    );

  const newColumnMeans = {
    ...matrix.columnMeans,
  };

  for (
    let index = 0;
    index <
    absoluteFeatureNames.length;
    index +=
    1
  ) {
    const absoluteFeatureName =
      absoluteFeatureNames[
        index
      ];

    const sourceIndex =
      diffFeatureIndexes[
        index
      ].index;

    const values =
      matrix.X.map(
        (
          row,
        ) =>
          Math.abs(
            row[
              sourceIndex
            ],
          ),
      );

    const mean =
      values.length >
      0
        ? values.reduce(
            (
              total,
              value,
            ) =>
              total +
              value,
            0,
          ) /
          values.length
        : 0;

    newColumnMeans[
      absoluteFeatureName
    ] =
      mean;
  }

  return {
    ...matrix,

    featureNames:
      newFeatureNames,

    X:
      newX,

    columnCount:
      newFeatureNames.length,

    columnMeans:
      newColumnMeans,

    warnings: [
      ...matrix.warnings,

      `${absoluteFeatureNames.length} absolute difference feature eklendi.`,
    ],
  };
}

function buildExperimentMatrix(
  rows:
    Parameters<
      typeof buildTrainingMatrix
    >[0],

  matrixMode:
    MatrixMode,
): TrainingMatrix {
  if (
    matrixMode ===
    "DIFF"
  ) {
    return buildTrainingMatrix(
      rows,
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
  }

  if (
    matrixMode ===
    "DIFF_ABS"
  ) {
    const matrix =
      buildTrainingMatrix(
        rows,
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

    return addAbsoluteDifferenceFeatures(
      matrix,
    );
  }

  const matrix =
    buildTrainingMatrix(
      rows,
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

  return addAbsoluteDifferenceFeatures(
    matrix,
  );
}

function calculateBalancedScore(
  options: {
    accuracy:
      number;

    drawRecall:
      number;

    drawPrecision:
      number;

    brier:
      number;

    logLoss:
      number;
  },
): number {
  /*
   * Accuracy hâlâ en önemli metrik.
   *
   * DRAW recall ve precision ayrıca
   * ödüllendiriliyor.
   *
   * Brier ve Log Loss büyüdükçe
   * küçük ceza uygulanıyor.
   */
  const accuracyScore =
    options.accuracy *
    0.5;

  const drawRecallScore =
    options.drawRecall *
    0.25;

  const drawPrecisionScore =
    options.drawPrecision *
    0.15;

  const brierPenalty =
    options.brier *
    5;

  const logLossPenalty =
    options.logLoss *
    3;

  return round(
    accuracyScore +
      drawRecallScore +
      drawPrecisionScore -
      brierPenalty -
      logLossPenalty,
    4,
  );
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW MODEL V2.1 EXPERIMENT",
  );

  console.log(
    "==============================================",
  );

  console.log("");

  console.table({
    Sezon:
      SEASON_YEAR,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    "Core feature":
      CORE_MODEL_FEATURE_KEYS.length,

    Deney:
      EXPERIMENTS.length,
  });

  const allRows:
    Awaited<
      ReturnType<
        typeof collectTrainingData
      >
    >["rows"] = [];

  const collectionRows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    console.log("");
    console.log(
      `Collecting ${competition.name}...`,
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

    collectionRows.push({
      apiId:
        competition.apiId,

      competition:
        competition.name,

      finished:
        result
          .totalFinishedMatches,

      collected:
        result
          .collectedMatchCount,

      skipped:
        result
          .skippedMatchCount,
    });
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DATA COLLECTION",
  );

  console.log(
    "==============================================",
  );

  console.table(
    collectionRows,
  );

  console.log("");

  console.table({
    "Toplam training row":
      allRows.length,
  });

  if (
    allRows.length <
    1000
  ) {
    throw new Error(
      `Training datası yetersiz: ${allRows.length}`,
    );
  }

  const matrixCache =
    new Map<
      MatrixMode,
      TrainingMatrix
    >();

  const getMatrix = (
    matrixMode:
      MatrixMode,
  ): TrainingMatrix => {
    const cached =
      matrixCache.get(
        matrixMode,
      );

    if (
      cached
    ) {
      return cached;
    }

    const matrix =
      buildExperimentMatrix(
        allRows,
        matrixMode,
      );

    matrixCache.set(
      matrixMode,
      matrix,
    );

    return matrix;
  };

  const experimentRows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const [
      experimentIndex,
      experiment,
    ]
    of EXPERIMENTS.entries()
  ) {
    console.log("");
    console.log(
      "==============================================",
    );

    console.log(
      `[${experimentIndex + 1}/${EXPERIMENTS.length}] ${experiment.name}`,
    );

    console.log(
      "==============================================",
    );

    const matrix =
      getMatrix(
        experiment.matrixMode,
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

    const result =
      trainSimpleLearningModel(
        split,
        {
          featureNames: [
            ...matrix.featureNames,
          ],

          learningRate:
            0.01,

          maximumEpochs:
            1500,

          l2Regularization:
            0.05,

          convergenceTolerance:
            0.0000001,

          classWeights:
            experiment
              .classWeights,
        },
      );

    const drawPerformance =
      result
        .validationMetrics
        .outcomePerformance
        .find(
          (
            performance,
          ) =>
            performance.outcome ===
            "DRAW",
        );

    const homePerformance =
      result
        .validationMetrics
        .outcomePerformance
        .find(
          (
            performance,
          ) =>
            performance.outcome ===
            "HOME",
        );

    const awayPerformance =
      result
        .validationMetrics
        .outcomePerformance
        .find(
          (
            performance,
          ) =>
            performance.outcome ===
            "AWAY",
        );

    const actualDistribution =
      calculateOutcomeDistribution(
        result
          .validationPredictions
          .map(
            (
              prediction,
            ) =>
              prediction.actualOutcome,
          ),
      );

    const predictedDistribution =
      calculateOutcomeDistribution(
        result
          .validationPredictions
          .map(
            (
              prediction,
            ) =>
              prediction.predictedOutcome,
          ),
      );

    const drawRecall =
      drawPerformance
        ?.recallPercentage ??
      0;

    const drawPrecision =
      drawPerformance
        ?.precisionPercentage ??
      0;

    const balancedScore =
      calculateBalancedScore({
        accuracy:
          result
            .validationMetrics
            .accuracyPercentage,

        drawRecall,

        drawPrecision,

        brier:
          result
            .validationMetrics
            .brierScore,

        logLoss:
          result
            .validationMetrics
            .logLoss,
      });

    const row = {
      experiment:
        experiment.name,

      mode:
        experiment.matrixMode,

      features:
        matrix.columnCount,

      drawWeight:
        experiment
          .classWeights
          .DRAW,

      trainAccuracy:
        result
          .trainingMetrics
          .accuracyPercentage,

      validationAccuracy:
        result
          .validationMetrics
          .accuracyPercentage,

      brier:
        result
          .validationMetrics
          .brierScore,

      logLoss:
        result
          .validationMetrics
          .logLoss,

      averageConfidence:
        result
          .validationMetrics
          .averageConfidencePercentage,

      actualHome:
        actualDistribution.home,

      predictedHome:
        predictedDistribution.home,

      actualDraw:
        actualDistribution.draw,

      predictedDraw:
        predictedDistribution.draw,

      actualAway:
        actualDistribution.away,

      predictedAway:
        predictedDistribution.away,

      drawCorrect:
        drawPerformance
          ?.correctCount ??
        0,

      drawRecall,

      drawPrecision,

      homeRecall:
        homePerformance
          ?.recallPercentage ??
        0,

      homePrecision:
        homePerformance
          ?.precisionPercentage ??
        0,

      awayRecall:
        awayPerformance
          ?.recallPercentage ??
        0,

      awayPrecision:
        awayPerformance
          ?.precisionPercentage ??
        0,

      balancedScore,
    };

    experimentRows.push(
      row,
    );

    console.table({
      "Matrix mode":
        experiment.matrixMode,

      "Feature sayısı":
        matrix.columnCount,

      "DRAW weight":
        experiment
          .classWeights
          .DRAW,

      "Validation accuracy":
        result
          .validationMetrics
          .accuracyPercentage,

      "Brier score":
        result
          .validationMetrics
          .brierScore,

      "Log loss":
        result
          .validationMetrics
          .logLoss,

      "DRAW actual":
        drawPerformance
          ?.actualCount ??
        0,

      "DRAW predicted":
        drawPerformance
          ?.predictedCount ??
        0,

      "DRAW correct":
        drawPerformance
          ?.correctCount ??
        0,

      "DRAW recall":
        drawRecall,

      "DRAW precision":
        drawPerformance
          ?.precisionPercentage ??
        null,

      "Balanced score":
        balancedScore,
    });
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ALL EXPERIMENTS",
  );

  console.log(
    "==============================================",
  );

  console.table(
    experimentRows,
  );

  const ranked =
    [...experimentRows]
      .sort(
        (
          first,
          second,
        ) =>
          Number(
            second
              .balancedScore,
          ) -
          Number(
            first
              .balancedScore,
          ),
      );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "BALANCED RANKING",
  );

  console.log(
    "==============================================",
  );

  console.table(
    ranked.map(
      (
        row,
        index,
      ) => ({
        rank:
          index +
          1,

        experiment:
          row.experiment,

        mode:
          row.mode,

        features:
          row.features,

        drawWeight:
          row.drawWeight,

        accuracy:
          row.validationAccuracy,

        predictedDraw:
          row.predictedDraw,

        drawRecall:
          row.drawRecall,

        drawPrecision:
          row.drawPrecision,

        homeRecall:
          row.homeRecall,

        awayRecall:
          row.awayRecall,

        brier:
          row.brier,

        logLoss:
          row.logLoss,

        score:
          row.balancedScore,
      }),
    ),
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRACTICAL CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  const practicalCandidates =
    ranked.filter(
      (
        row,
      ) => {
        const accuracy =
          Number(
            row
              .validationAccuracy,
          );

        const drawRecall =
          Number(
            row.drawRecall,
          );

        const drawPrecision =
          Number(
            row.drawPrecision,
          );

        const brier =
          Number(
            row.brier,
          );

        return (
          accuracy >=
            48 &&
          drawRecall >=
            10 &&
          drawPrecision >=
            30 &&
          brier <=
            0.66
        );
      },
    );

  if (
    practicalCandidates.length ===
    0
  ) {
    console.log(
      "Henüz production adayı yok.",
    );

    console.log(
      [
        "DRAW tahmini iyileştiyse bile",
        "accuracy / recall / precision",
        "dengesi yeterli seviyeye ulaşmadı.",
      ].join(
        " ",
      ),
    );
  } else {
    console.table(
      practicalCandidates.map(
        (
          row,
          index,
        ) => ({
          rank:
            index +
            1,

          experiment:
            row.experiment,

          accuracy:
            row.validationAccuracy,

          drawRecall:
            row.drawRecall,

          drawPrecision:
            row.drawPrecision,

          predictedDraw:
            row.predictedDraw,

          brier:
            row.brier,

          logLoss:
            row.logLoss,

          score:
            row.balancedScore,
        }),
      ),
    );
  }

  console.log("");
  console.log(
    "DRAW MODEL V2.1 TESTİ TAMAMLANDI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "DRAW Model V2.1 testi başarısız.",
      );

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
      /*
       * Bu script doğrudan Prisma
       * kullanmadığı için disconnect
       * gerekmiyor.
       */
    },
  );