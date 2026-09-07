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
  TrainingMatchRow,
  TrainingMatrix,
} from "@/modules/learning-engine";

const SEASON_YEAR =
  2024;

const DRAW_MODEL_FEATURE_KEYS = [
  "last_5_points_per_game",
  "last_10_points_per_game",

  "goals_scored_per_game",
  "goals_conceded_per_game",
  "goal_difference_per_game",

  "draw_rate",
  "win_rate",
  "loss_rate",

  "clean_sheet_rate",
  "btts_rate",
  "over_2_5_rate",

  "venue_last_5_points_per_game",
  "venue_last_10_points_per_game",

  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",

  "rest_days",
  "fixture_congestion_14_days",
] as const;

const DERIVED_DRAW_FEATURE_NAMES = [
  "draw_combined_rate",
  "draw_rate_gap",

  "strength_gap_last5",
  "strength_gap_last10",

  "goal_difference_gap",

  "attack_gap",
  "defence_gap",

  "goal_environment",

  "low_scoring_tendency",

  "combined_btts_rate",

  "combined_clean_sheet_rate",

  "venue_strength_gap_last5",
  "venue_strength_gap_last10",
] as const;

type ExperimentConfig = {
  name:
    string;

  classWeights:
    SimpleLearningClassWeights;

  useDrawDerivedFeatures:
    boolean;
};

const EXPERIMENTS:
  ExperimentConfig[] = [
  {
    name:
      "BASELINE_CORE",

    classWeights: {
      HOME:
        1,

      DRAW:
        1,

      AWAY:
        1,
    },

    useDrawDerivedFeatures:
      false,
  },

  {
    name:
      "DRAW_FEATURES_W1_00",

    classWeights: {
      HOME:
        1,

      DRAW:
        1,

      AWAY:
        1,
    },

    useDrawDerivedFeatures:
      true,
  },

  {
    name:
      "DRAW_FEATURES_W1_20",

    classWeights: {
      HOME:
        1,

      DRAW:
        1.2,

      AWAY:
        1,
    },

    useDrawDerivedFeatures:
      true,
  },

  {
    name:
      "DRAW_FEATURES_W1_35",

    classWeights: {
      HOME:
        1,

      DRAW:
        1.35,

      AWAY:
        1,
    },

    useDrawDerivedFeatures:
      true,
  },

  {
    name:
      "DRAW_FEATURES_W1_50",

    classWeights: {
      HOME:
        1,

      DRAW:
        1.5,

      AWAY:
        1,
    },

    useDrawDerivedFeatures:
      true,
  },
];

function round(
  value: number,
  decimals = 4,
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

function isNumericValue(
  value:
    unknown,
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
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

function collectMatrixFeatureNames(
  rows:
    TrainingMatchRow[],
): string[] {
  const names =
    new Set<string>();

  for (
    const row
    of rows
  ) {
    for (
      const key
      of Object.keys(
        row.features,
      )
    ) {
      if (
        key.startsWith(
          "home_",
        ) ||
        key.startsWith(
          "away_",
        ) ||
        key.startsWith(
          "diff_",
        )
      ) {
        names.add(
          key,
        );
      }
    }
  }

  return [
    ...names,
  ].sort(
    (
      left,
      right,
    ) =>
      left.localeCompare(
        right,
      ),
  );
}

function calculateFeatureCoverage(
  rows:
    TrainingMatchRow[],
): Array<
  Record<
    string,
    unknown
  >
> {
  const featureNames =
    collectMatrixFeatureNames(
      rows,
    );

  return featureNames.map(
    (
      featureName,
    ) => {
      let available =
        0;

      let missing =
        0;

      for (
        const row
        of rows
      ) {
        const value =
          row
            .features[
              featureName
            ];

        if (
          isNumericValue(
            value,
          )
        ) {
          available +=
            1;
        } else {
          missing +=
            1;
        }
      }

      const coverage =
        rows.length >
        0
          ? (
              available /
              rows.length
            ) *
            100
          : 0;

      return {
        feature:
          featureName,

        available,

        missing,

        coverage:
          round(
            coverage,
            2,
          ),

        status:
          coverage >=
            90
            ? "EXCELLENT"
            : coverage >=
                75
              ? "GOOD"
              : coverage >=
                  50
                ? "WEAK"
                : "CRITICAL",
      };
    },
  );
}

function calculateRowMissingDistribution(
  rows:
    TrainingMatchRow[],
): Array<
  Record<
    string,
    unknown
  >
> {
  const featureNames =
    collectMatrixFeatureNames(
      rows,
    );

  const buckets = {
    "0-10%":
      0,

    "10-25%":
      0,

    "25-50%":
      0,

    "50-70%":
      0,

    "70-90%":
      0,

    "90-100%":
      0,
  };

  for (
    const row
    of rows
  ) {
    let missing =
      0;

    for (
      const featureName
      of featureNames
    ) {
      const value =
        row
          .features[
            featureName
          ];

      if (
        !isNumericValue(
          value,
        )
      ) {
        missing +=
          1;
      }
    }

    const ratio =
      featureNames.length >
      0
        ? (
            missing /
            featureNames.length
          ) *
          100
        : 0;

    if (
      ratio <=
      10
    ) {
      buckets[
        "0-10%"
      ] +=
        1;
    } else if (
      ratio <=
      25
    ) {
      buckets[
        "10-25%"
      ] +=
        1;
    } else if (
      ratio <=
      50
    ) {
      buckets[
        "25-50%"
      ] +=
        1;
    } else if (
      ratio <=
      70
    ) {
      buckets[
        "50-70%"
      ] +=
        1;
    } else if (
      ratio <=
      90
    ) {
      buckets[
        "70-90%"
      ] +=
        1;
    } else {
      buckets[
        "90-100%"
      ] +=
        1;
    }
  }

  return Object.entries(
    buckets,
  ).map(
    (
      [
        range,
        count,
      ],
    ) => ({
      missingRange:
        range,

      matches:
        count,

      percentage:
        round(
          (
            count /
            rows.length
          ) *
            100,
          2,
        ),
    }),
  );
}

function buildDiagnosticMatrix(
  rows:
    TrainingMatchRow[],

  maximumMissingRatio:
    number,
): TrainingMatrix {
  return buildTrainingMatrix(
    rows,
    {
      includeSideFeatures:
        true,

      includeDifferenceFeatures:
        true,

      missingValueStrategy:
        "COLUMN_MEAN",

      maximumMissingRatio,
    },
  );
}

function findFeatureIndex(
  matrix:
    TrainingMatrix,

  featureName:
    string,
): number | null {
  const index =
    matrix
      .featureNames
      .indexOf(
        featureName,
      );

  return index >=
    0
    ? index
    : null;
}

function readValue(
  row:
    number[],

  index:
    number | null,
): number {
  if (
    index ===
    null
  ) {
    return 0;
  }

  const value =
    row[
      index
    ];

  return Number.isFinite(
    value,
  )
    ? value
    : 0;
}

function average(
  values:
    number[],
): number {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    ) /
    values.length
  );
}

function addDrawDerivedFeatures(
  matrix:
    TrainingMatrix,
): TrainingMatrix {
  const indexes = {
    homeDrawRate:
      findFeatureIndex(
        matrix,
        "home_draw_rate",
      ),

    awayDrawRate:
      findFeatureIndex(
        matrix,
        "away_draw_rate",
      ),

    homeLast5:
      findFeatureIndex(
        matrix,
        "home_last_5_points_per_game",
      ),

    awayLast5:
      findFeatureIndex(
        matrix,
        "away_last_5_points_per_game",
      ),

    homeLast10:
      findFeatureIndex(
        matrix,
        "home_last_10_points_per_game",
      ),

    awayLast10:
      findFeatureIndex(
        matrix,
        "away_last_10_points_per_game",
      ),

    homeGoalsScored:
      findFeatureIndex(
        matrix,
        "home_goals_scored_per_game",
      ),

    awayGoalsScored:
      findFeatureIndex(
        matrix,
        "away_goals_scored_per_game",
      ),

    homeGoalsConceded:
      findFeatureIndex(
        matrix,
        "home_goals_conceded_per_game",
      ),

    awayGoalsConceded:
      findFeatureIndex(
        matrix,
        "away_goals_conceded_per_game",
      ),

    homeGoalDifference:
      findFeatureIndex(
        matrix,
        "home_goal_difference_per_game",
      ),

    awayGoalDifference:
      findFeatureIndex(
        matrix,
        "away_goal_difference_per_game",
      ),

    homeOver25:
      findFeatureIndex(
        matrix,
        "home_over_2_5_rate",
      ),

    awayOver25:
      findFeatureIndex(
        matrix,
        "away_over_2_5_rate",
      ),

    homeBtts:
      findFeatureIndex(
        matrix,
        "home_btts_rate",
      ),

    awayBtts:
      findFeatureIndex(
        matrix,
        "away_btts_rate",
      ),

    homeCleanSheet:
      findFeatureIndex(
        matrix,
        "home_clean_sheet_rate",
      ),

    awayCleanSheet:
      findFeatureIndex(
        matrix,
        "away_clean_sheet_rate",
      ),

    homeVenueLast5:
      findFeatureIndex(
        matrix,
        "home_venue_last_5_points_per_game",
      ),

    awayVenueLast5:
      findFeatureIndex(
        matrix,
        "away_venue_last_5_points_per_game",
      ),

    homeVenueLast10:
      findFeatureIndex(
        matrix,
        "home_venue_last_10_points_per_game",
      ),

    awayVenueLast10:
      findFeatureIndex(
        matrix,
        "away_venue_last_10_points_per_game",
      ),
  };

  const derivedRows =
    matrix.X.map(
      (
        row,
      ) => {
        const homeDrawRate =
          readValue(
            row,
            indexes.homeDrawRate,
          );

        const awayDrawRate =
          readValue(
            row,
            indexes.awayDrawRate,
          );

        const homeLast5 =
          readValue(
            row,
            indexes.homeLast5,
          );

        const awayLast5 =
          readValue(
            row,
            indexes.awayLast5,
          );

        const homeLast10 =
          readValue(
            row,
            indexes.homeLast10,
          );

        const awayLast10 =
          readValue(
            row,
            indexes.awayLast10,
          );

        const homeGoalsScored =
          readValue(
            row,
            indexes.homeGoalsScored,
          );

        const awayGoalsScored =
          readValue(
            row,
            indexes.awayGoalsScored,
          );

        const homeGoalsConceded =
          readValue(
            row,
            indexes.homeGoalsConceded,
          );

        const awayGoalsConceded =
          readValue(
            row,
            indexes.awayGoalsConceded,
          );

        const homeGoalDifference =
          readValue(
            row,
            indexes.homeGoalDifference,
          );

        const awayGoalDifference =
          readValue(
            row,
            indexes.awayGoalDifference,
          );

        const homeOver25 =
          readValue(
            row,
            indexes.homeOver25,
          );

        const awayOver25 =
          readValue(
            row,
            indexes.awayOver25,
          );

        const homeBtts =
          readValue(
            row,
            indexes.homeBtts,
          );

        const awayBtts =
          readValue(
            row,
            indexes.awayBtts,
          );

        const homeCleanSheet =
          readValue(
            row,
            indexes.homeCleanSheet,
          );

        const awayCleanSheet =
          readValue(
            row,
            indexes.awayCleanSheet,
          );

        const homeVenueLast5 =
          readValue(
            row,
            indexes.homeVenueLast5,
          );

        const awayVenueLast5 =
          readValue(
            row,
            indexes.awayVenueLast5,
          );

        const homeVenueLast10 =
          readValue(
            row,
            indexes.homeVenueLast10,
          );

        const awayVenueLast10 =
          readValue(
            row,
            indexes.awayVenueLast10,
          );

        const drawCombinedRate =
          (
            homeDrawRate +
            awayDrawRate
          ) /
          2;

        const drawRateGap =
          Math.abs(
            homeDrawRate -
            awayDrawRate,
          );

        const strengthGapLast5 =
          Math.abs(
            homeLast5 -
            awayLast5,
          );

        const strengthGapLast10 =
          Math.abs(
            homeLast10 -
            awayLast10,
          );

        const goalDifferenceGap =
          Math.abs(
            homeGoalDifference -
            awayGoalDifference,
          );

        const attackGap =
          Math.abs(
            homeGoalsScored -
            awayGoalsScored,
          );

        const defenceGap =
          Math.abs(
            homeGoalsConceded -
            awayGoalsConceded,
          );

        const goalEnvironment =
          (
            homeGoalsScored +
            homeGoalsConceded +
            awayGoalsScored +
            awayGoalsConceded
          ) /
          2;

        const averageOver25 =
          (
            homeOver25 +
            awayOver25
          ) /
          2;

        const lowScoringTendency =
          Math.max(
            0,
            100 -
              averageOver25,
          );

        const combinedBttsRate =
          (
            homeBtts +
            awayBtts
          ) /
          2;

        const combinedCleanSheetRate =
          (
            homeCleanSheet +
            awayCleanSheet
          ) /
          2;

        const venueStrengthGapLast5 =
          Math.abs(
            homeVenueLast5 -
            awayVenueLast5,
          );

        const venueStrengthGapLast10 =
          Math.abs(
            homeVenueLast10 -
            awayVenueLast10,
          );

        return [
          drawCombinedRate,

          drawRateGap,

          strengthGapLast5,

          strengthGapLast10,

          goalDifferenceGap,

          attackGap,

          defenceGap,

          goalEnvironment,

          lowScoringTendency,

          combinedBttsRate,

          combinedCleanSheetRate,

          venueStrengthGapLast5,

          venueStrengthGapLast10,
        ];
      },
    );

  const newX =
    matrix.X.map(
      (
        row,
        rowIndex,
      ) => [
        ...row,

        ...derivedRows[
          rowIndex
        ],
      ],
    );

  const columnMeans = {
    ...matrix.columnMeans,
  };

  for (
    let featureIndex =
      0;

    featureIndex <
    DERIVED_DRAW_FEATURE_NAMES.length;

    featureIndex +=
      1
  ) {
    const values =
      derivedRows.map(
        (
          row,
        ) =>
          row[
            featureIndex
          ],
      );

    columnMeans[
      DERIVED_DRAW_FEATURE_NAMES[
        featureIndex
      ]
    ] =
      average(
        values,
      );
  }

  return {
    ...matrix,

    featureNames: [
      ...matrix.featureNames,

      ...DERIVED_DRAW_FEATURE_NAMES,
    ],

    X:
      newX,

    columnCount:
      matrix.columnCount +
      DERIVED_DRAW_FEATURE_NAMES.length,

    columnMeans,

    warnings: [
      ...matrix.warnings,

      `${DERIVED_DRAW_FEATURE_NAMES.length} DRAW-specific derived feature eklendi.`,
    ],
  };
}

function calculateBalancedScore(
  options: {
    accuracy:
      number;

    drawRecall:
      number;

    drawPrecision:
      number;

    homeRecall:
      number;

    awayRecall:
      number;

    brier:
      number;

    logLoss:
      number;
  },
): number {
  const accuracyScore =
    options.accuracy *
    0.45;

  const drawRecallScore =
    options.drawRecall *
    0.15;

  const drawPrecisionScore =
    options.drawPrecision *
    0.15;

  const homeRecallScore =
    options.homeRecall *
    0.075;

  const awayRecallScore =
    options.awayRecall *
    0.075;

  const brierPenalty =
    options.brier *
    5;

  const logLossPenalty =
    options.logLoss *
    3;

  return round(
    accuracyScore +
      drawRecallScore +
      drawPrecisionScore +
      homeRecallScore +
      awayRecallScore -
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
    "DRAW MODEL V2.2 + COVERAGE DIAGNOSTIC",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Sezon:
      SEASON_YEAR,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    "Requested feature":
      DRAW_MODEL_FEATURE_KEYS.length,

    Deney:
      EXPERIMENTS.length,
  });

  const allRows:
    TrainingMatchRow[] =
      [];

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
          ...DRAW_MODEL_FEATURE_KEYS,
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

  console.table({
    "Toplam training row":
      allRows.length,
  });

  /*
   * ==================================================
   * FEATURE COVERAGE
   * ==================================================
   */
  const coverageRows =
    calculateFeatureCoverage(
      allRows,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "FEATURE COVERAGE — WORST FIRST",
  );

  console.log(
    "==============================================",
  );

  console.table(
    [
      ...coverageRows,
    ].sort(
      (
        first,
        second,
      ) =>
        Number(
          first.coverage,
        ) -
        Number(
          second.coverage,
        ),
    ),
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "CRITICAL FEATURES",
  );

  console.log(
    "==============================================",
  );

  const criticalFeatures =
    coverageRows.filter(
      (
        row,
      ) =>
        Number(
          row.coverage,
        ) <
        75,
    );

  if (
    criticalFeatures.length ===
    0
  ) {
    console.log(
      "Coverage %75 altında feature yok.",
    );
  } else {
    console.table(
      criticalFeatures,
    );
  }

  /*
   * ==================================================
   * ROW MISSING DISTRIBUTION
   * ==================================================
   */
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ROW MISSING DISTRIBUTION",
  );

  console.log(
    "==============================================",
  );

  console.table(
    calculateRowMissingDistribution(
      allRows,
    ),
  );

  /*
   * ==================================================
   * DIFFERENT MISSING FILTERS
   * ==================================================
   */
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "MISSING RATIO COMPARISON",
  );

  console.log(
    "==============================================",
  );

  const matrix050 =
    buildDiagnosticMatrix(
      allRows,
      0.5,
    );

  const matrix070 =
    buildDiagnosticMatrix(
      allRows,
      0.7,
    );

  const matrix100 =
    buildDiagnosticMatrix(
      allRows,
      1,
    );

  console.table([
    {
      maximumMissingRatio:
        0.5,

      rows:
        matrix050.rowCount,

      skipped:
        matrix050.skippedRowCount,

      retained:
        round(
          (
            matrix050.rowCount /
            allRows.length
          ) *
            100,
          2,
        ),

      columns:
        matrix050.columnCount,

      imputed:
        matrix050.imputedValueCount,
    },

    {
      maximumMissingRatio:
        0.7,

      rows:
        matrix070.rowCount,

      skipped:
        matrix070.skippedRowCount,

      retained:
        round(
          (
            matrix070.rowCount /
            allRows.length
          ) *
            100,
          2,
        ),

      columns:
        matrix070.columnCount,

      imputed:
        matrix070.imputedValueCount,
    },

    {
      maximumMissingRatio:
        1,

      rows:
        matrix100.rowCount,

      skipped:
        matrix100.skippedRowCount,

      retained:
        round(
          (
            matrix100.rowCount /
            allRows.length
          ) *
            100,
          2,
        ),

      columns:
        matrix100.columnCount,

      imputed:
        matrix100.imputedValueCount,
    },
  ]);

  console.log("");
  console.log(
    "MATRIX 0.50 WARNINGS",
  );

  for (
    const warning
    of matrix050.warnings
  ) {
    console.log(
      `- ${warning}`,
    );
  }

  console.log("");
  console.log(
    "MATRIX 0.70 WARNINGS",
  );

  for (
    const warning
    of matrix070.warnings
  ) {
    console.log(
      `- ${warning}`,
    );
  }

  console.log("");
  console.log(
    "MATRIX 1.00 WARNINGS",
  );

  for (
    const warning
    of matrix100.warnings
  ) {
    console.log(
      `- ${warning}`,
    );
  }

  /*
   * Şimdilik gerçek model deneyinde eski
   * güvenli 0.50 filtresini koruyoruz.
   *
   * Coverage sonuçlarını gördükten sonra
   * hangi feature'ların çıkarılacağına
   * karar vereceğiz.
   */
  const baseMatrix =
    matrix050;

  const drawMatrix =
    addDrawDerivedFeatures(
      baseMatrix,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "MODEL MATRIX",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Collected rows":
      allRows.length,

    "Matrix rows":
      baseMatrix.rowCount,

    "Skipped rows":
      baseMatrix.skippedRowCount,

    "Base columns":
      baseMatrix.columnCount,

    "DRAW columns":
      drawMatrix.columnCount,

    "Derived features":
      DERIVED_DRAW_FEATURE_NAMES.length,

    "Imputed values":
      baseMatrix.imputedValueCount,
  });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW DERIVED FEATURES",
  );

  console.log(
    "==============================================",
  );

  console.table(
    DERIVED_DRAW_FEATURE_NAMES.map(
      (
        featureName,
      ) => ({
        feature:
          featureName,

        mean:
          round(
            drawMatrix
              .columnMeans[
                featureName
              ] ??
              0,
            4,
          ),
      }),
    ),
  );

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
      experiment
        .useDrawDerivedFeatures
        ? drawMatrix
        : baseMatrix;

    const split =
      splitTrainingValidationChronologically(
        matrix,
        {
          trainingPercentage:
            70,

          minimumTrainingRows:
            300,

          minimumValidationRows:
            100,
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
            experiment.classWeights,
        },
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

    const accuracy =
      result
        .validationMetrics
        .accuracyPercentage;

    const drawRecall =
      drawPerformance
        ?.recallPercentage ??
      0;

    const drawPrecision =
      drawPerformance
        ?.precisionPercentage ??
      0;

    const homeRecall =
      homePerformance
        ?.recallPercentage ??
      0;

    const awayRecall =
      awayPerformance
        ?.recallPercentage ??
      0;

    const balancedScore =
      calculateBalancedScore({
        accuracy,

        drawRecall,

        drawPrecision,

        homeRecall,

        awayRecall,

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

      featureCount:
        matrix.columnCount,

      drawWeight:
        experiment
          .classWeights
          .DRAW,

      trainingRows:
        split.training.rowCount,

      validationRows:
        split.validation.rowCount,

      trainAccuracy:
        result
          .trainingMetrics
          .accuracyPercentage,

      validationAccuracy:
        accuracy,

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

      drawRecall,

      drawPrecision,

      homeRecall,

      awayRecall,

      balancedScore,
    };

    experimentRows.push(
      row,
    );

    console.table({
      "Training rows":
        split.training.rowCount,

      "Validation rows":
        split.validation.rowCount,

      "Validation accuracy":
        accuracy,

      Brier:
        result
          .validationMetrics
          .brierScore,

      "Log Loss":
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

      "HOME recall":
        homeRecall,

      "AWAY recall":
        awayRecall,

      "Balanced score":
        balancedScore,
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
    [
      ...experimentRows,
    ].sort(
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
    "NEXT DECISION DATA",
  );

  console.log(
    "==============================================",
  );

  console.log(
    [
      "Önce FEATURE COVERAGE ve",
      "MISSING RATIO COMPARISON tabloları",
      "incelenmelidir.",
    ].join(
      " ",
    ),
  );

  console.log(
    [
      "Coverage düşük feature'lar",
      "belirlendikten sonra model matrisi",
      "yeniden optimize edilecektir.",
    ].join(
      " ",
    ),
  );

  console.log("");
  console.log(
    "DRAW MODEL V2.2 DIAGNOSTIC TAMAMLANDI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "DRAW Model V2.2 diagnostic başarısız.",
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