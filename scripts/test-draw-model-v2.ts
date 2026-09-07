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

type ExperimentConfig = {
  name: string;

  classWeights:
    SimpleLearningClassWeights;

  useAbsoluteDifferenceFeatures:
    boolean;
};

const EXPERIMENTS:
  ExperimentConfig[] = [
  {
    name:
      "BASELINE",

    classWeights: {
      HOME: 1,
      DRAW: 1,
      AWAY: 1,
    },

    useAbsoluteDifferenceFeatures:
      false,
  },

  {
    name:
      "DRAW_WEIGHT_1_20",

    classWeights: {
      HOME: 1,
      DRAW: 1.2,
      AWAY: 1,
    },

    useAbsoluteDifferenceFeatures:
      false,
  },

  {
    name:
      "DRAW_WEIGHT_1_35",

    classWeights: {
      HOME: 1,
      DRAW: 1.35,
      AWAY: 1,
    },

    useAbsoluteDifferenceFeatures:
      false,
  },

  {
    name:
      "ABS_DIFF",

    classWeights: {
      HOME: 1,
      DRAW: 1,
      AWAY: 1,
    },

    useAbsoluteDifferenceFeatures:
      true,
  },

  {
    name:
      "ABS_DIFF_DRAW_1_20",

    classWeights: {
      HOME: 1,
      DRAW: 1.2,
      AWAY: 1,
    },

    useAbsoluteDifferenceFeatures:
      true,
  },

  {
    name:
      "ABS_DIFF_DRAW_1_35",

    classWeights: {
      HOME: 1,
      DRAW: 1.35,
      AWAY: 1,
    },

    useAbsoluteDifferenceFeatures:
      true,
  },
];

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

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
          item.featureName
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
      ) => {
        const absoluteValues =
          diffFeatureIndexes.map(
            (
              item,
            ) =>
              Math.abs(
                row[
                  item.index
                ],
              ),
          );

        return [
          ...row,
          ...absoluteValues,
        ];
      },
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
    const featureName =
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
      values.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      ) /
      values.length;

    newColumnMeans[
      featureName
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

      `${absoluteFeatureNames.length} adet absolute difference feature deneysel olarak eklendi.`,
    ],
  };
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW MODEL V2 EXPERIMENT",
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
        result.totalFinishedMatches,

      collected:
        result.collectedMatchCount,

      skipped:
        result.skippedMatchCount,
    });
  }

  console.log("");
  console.log(
    "DATA COLLECTION",
  );

  console.table(
    collectionRows,
  );

  if (
    allRows.length <
    1000
  ) {
    console.warn(
      `Training datası beklenenden düşük: ${allRows.length}`,
    );
  }

  const baseMatrix =
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

  const experimentRows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const experiment
    of EXPERIMENTS
  ) {
    console.log("");
    console.log(
      "==============================================",
    );

    console.log(
      experiment.name,
    );

    console.log(
      "==============================================",
    );

    const matrix =
      experiment
        .useAbsoluteDifferenceFeatures
        ? addAbsoluteDifferenceFeatures(
            baseMatrix,
          )
        : baseMatrix;

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

    const featureNames =
      experiment
        .useAbsoluteDifferenceFeatures
        ? matrix.featureNames
        : [
            ...matrix.featureNames,
          ];

    const result =
      trainSimpleLearningModel(
        split,
        {
          featureNames,

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
            item,
          ) =>
            item.outcome ===
            "DRAW",
        );

    const homePerformance =
      result
        .validationMetrics
        .outcomePerformance
        .find(
          (
            item,
          ) =>
            item.outcome ===
            "HOME",
        );

    const awayPerformance =
      result
        .validationMetrics
        .outcomePerformance
        .find(
          (
            item,
          ) =>
            item.outcome ===
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
              prediction
                .actualOutcome,
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
              prediction
                .predictedOutcome,
          ),
      );

    experimentRows.push({
      experiment:
        experiment.name,

      features:
        result
          .model
          .featureNames
          .length,

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

      drawRecall:
        drawPerformance
          ?.recallPercentage ??
        null,

      drawPrecision:
        drawPerformance
          ?.precisionPercentage ??
        null,

      homeRecall:
        homePerformance
          ?.recallPercentage ??
        null,

      awayRecall:
        awayPerformance
          ?.recallPercentage ??
        null,
    });

    console.table({
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
        drawPerformance
          ?.recallPercentage ??
        null,

      "DRAW precision":
        drawPerformance
          ?.precisionPercentage ??
        null,
    });
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "EXPERIMENT COMPARISON",
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
        ) => {
          const firstAccuracy =
            Number(
              first
                .validationAccuracy ??
              0,
            );

          const secondAccuracy =
            Number(
              second
                .validationAccuracy ??
              0,
            );

          const firstDrawRecall =
            Number(
              first
                .drawRecall ??
              0,
            );

          const secondDrawRecall =
            Number(
              second
                .drawRecall ??
              0,
            );

          const firstScore =
            firstAccuracy *
              0.65 +
            firstDrawRecall *
              0.35;

          const secondScore =
            secondAccuracy *
              0.65 +
            secondDrawRecall *
              0.35;

          return (
            secondScore -
            firstScore
          );
        },
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
      }),
    ),
  );

  console.log("");
  console.log(
    "DRAW MODEL V2 TESTİ TAMAMLANDI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "DRAW Model V2 testi başarısız.",
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  );