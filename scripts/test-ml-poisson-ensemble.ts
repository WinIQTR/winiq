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

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

type Outcome =
  | "HOME"
  | "DRAW"
  | "AWAY";

type ProbabilitySet = {
  home: number;
  draw: number;
  away: number;
};

type EnsembleRow = {
  matchId: number;

  actualOutcome: Outcome;

  ml:
    ProbabilitySet;

  poisson:
    ProbabilitySet;
};

type EnsembleResult = {
  mlWeight: number;
  poissonWeight: number;

  matches: number;

  accuracy: number;

  brier: number;
  logLoss: number;

  averageConfidence: number;

  homeActual: number;
  homePredicted: number;
  homeCorrect: number;
  homeRecall: number;
  homePrecision: number | null;

  drawActual: number;
  drawPredicted: number;
  drawCorrect: number;
  drawRecall: number;
  drawPrecision: number | null;

  awayActual: number;
  awayPredicted: number;
  awayCorrect: number;
  awayRecall: number;
  awayPrecision: number | null;
};

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

/*
 * ML ağırlığı.
 *
 * Poisson ağırlığı otomatik olarak:
 *
 * 1 - ML weight
 *
 * olur.
 */
const ML_WEIGHTS = [
  0,
  0.1,
  0.2,
  0.3,
  0.4,
  0.5,
  0.6,
  0.7,
  0.8,
  0.9,
  1,
] as const;

const MINIMUM_PROBABILITY =
  1e-15;

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

function normalizeProbabilities(
  probabilities:
    ProbabilitySet,
): ProbabilitySet {
  const total =
    probabilities.home +
    probabilities.draw +
    probabilities.away;

  if (
    !Number.isFinite(
      total,
    ) ||
    total <= 0
  ) {
    return {
      home:
        1 / 3,

      draw:
        1 / 3,

      away:
        1 / 3,
    };
  }

  return {
    home:
      probabilities.home /
      total,

    draw:
      probabilities.draw /
      total,

    away:
      probabilities.away /
      total,
  };
}

function blendProbabilities(
  options: {
    ml:
      ProbabilitySet;

    poisson:
      ProbabilitySet;

    mlWeight:
      number;
  },
): ProbabilitySet {
  const poissonWeight =
    1 -
    options.mlWeight;

  return normalizeProbabilities({
    home:
      options.ml.home *
        options.mlWeight +
      options.poisson.home *
        poissonWeight,

    draw:
      options.ml.draw *
        options.mlWeight +
      options.poisson.draw *
        poissonWeight,

    away:
      options.ml.away *
        options.mlWeight +
      options.poisson.away *
        poissonWeight,
  });
}

function determinePrediction(
  probabilities:
    ProbabilitySet,
): Outcome {
  if (
    probabilities.home >=
      probabilities.draw &&
    probabilities.home >=
      probabilities.away
  ) {
    return "HOME";
  }

  if (
    probabilities.draw >=
      probabilities.home &&
    probabilities.draw >=
      probabilities.away
  ) {
    return "DRAW";
  }

  return "AWAY";
}

function getActualProbability(
  actualOutcome:
    Outcome,

  probabilities:
    ProbabilitySet,
): number {
  switch (
    actualOutcome
  ) {
    case "HOME":
      return probabilities.home;

    case "DRAW":
      return probabilities.draw;

    case "AWAY":
      return probabilities.away;
  }
}

function calculateBrierScore(
  actualOutcome:
    Outcome,

  probabilities:
    ProbabilitySet,
): number {
  const actualHome =
    actualOutcome ===
    "HOME"
      ? 1
      : 0;

  const actualDraw =
    actualOutcome ===
    "DRAW"
      ? 1
      : 0;

  const actualAway =
    actualOutcome ===
    "AWAY"
      ? 1
      : 0;

  return (
    (
      probabilities.home -
      actualHome
    ) **
      2 +
    (
      probabilities.draw -
      actualDraw
    ) **
      2 +
    (
      probabilities.away -
      actualAway
    ) **
      2
  );
}

function safePercentage(
  numerator:
    number,

  denominator:
    number,
): number | null {
  if (
    denominator <=
    0
  ) {
    return null;
  }

  return round(
    (
      numerator /
      denominator
    ) *
      100,
    2,
  );
}

function evaluateEnsemble(
  rows:
    EnsembleRow[],

  mlWeight:
    number,
): EnsembleResult {
  let correct =
    0;

  let totalBrier =
    0;

  let totalLogLoss =
    0;

  let totalConfidence =
    0;

  let homeActual =
    0;

  let homePredicted =
    0;

  let homeCorrect =
    0;

  let drawActual =
    0;

  let drawPredicted =
    0;

  let drawCorrect =
    0;

  let awayActual =
    0;

  let awayPredicted =
    0;

  let awayCorrect =
    0;

  for (
    const row
    of rows
  ) {
    const probabilities =
      blendProbabilities({
        ml:
          row.ml,

        poisson:
          row.poisson,

        mlWeight,
      });

    const predictedOutcome =
      determinePrediction(
        probabilities,
      );

    if (
      predictedOutcome ===
      row.actualOutcome
    ) {
      correct +=
        1;
    }

    if (
      row.actualOutcome ===
      "HOME"
    ) {
      homeActual +=
        1;
    }

    if (
      row.actualOutcome ===
      "DRAW"
    ) {
      drawActual +=
        1;
    }

    if (
      row.actualOutcome ===
      "AWAY"
    ) {
      awayActual +=
        1;
    }

    if (
      predictedOutcome ===
      "HOME"
    ) {
      homePredicted +=
        1;
    }

    if (
      predictedOutcome ===
      "DRAW"
    ) {
      drawPredicted +=
        1;
    }

    if (
      predictedOutcome ===
      "AWAY"
    ) {
      awayPredicted +=
        1;
    }

    if (
      row.actualOutcome ===
        "HOME" &&
      predictedOutcome ===
        "HOME"
    ) {
      homeCorrect +=
        1;
    }

    if (
      row.actualOutcome ===
        "DRAW" &&
      predictedOutcome ===
        "DRAW"
    ) {
      drawCorrect +=
        1;
    }

    if (
      row.actualOutcome ===
        "AWAY" &&
      predictedOutcome ===
        "AWAY"
    ) {
      awayCorrect +=
        1;
    }

    totalBrier +=
      calculateBrierScore(
        row.actualOutcome,
        probabilities,
      );

    const actualProbability =
      getActualProbability(
        row.actualOutcome,
        probabilities,
      );

    totalLogLoss +=
      -Math.log(
        Math.max(
          actualProbability,
          MINIMUM_PROBABILITY,
        ),
      );

    totalConfidence +=
      Math.max(
        probabilities.home,
        probabilities.draw,
        probabilities.away,
      );
  }

  const matches =
    rows.length;

  return {
    mlWeight:
      round(
        mlWeight,
        2,
      ),

    poissonWeight:
      round(
        1 -
          mlWeight,
        2,
      ),

    matches,

    accuracy:
      round(
        (
          correct /
          matches
        ) *
          100,
        2,
      ),

    brier:
      round(
        totalBrier /
          matches,
        6,
      ),

    logLoss:
      round(
        totalLogLoss /
          matches,
        6,
      ),

    averageConfidence:
      round(
        (
          totalConfidence /
          matches
        ) *
          100,
        2,
      ),

    homeActual,

    homePredicted,

    homeCorrect,

    homeRecall:
      safePercentage(
        homeCorrect,
        homeActual,
      ) ??
      0,

    homePrecision:
      safePercentage(
        homeCorrect,
        homePredicted,
      ),

    drawActual,

    drawPredicted,

    drawCorrect,

    drawRecall:
      safePercentage(
        drawCorrect,
        drawActual,
      ) ??
      0,

    drawPrecision:
      safePercentage(
        drawCorrect,
        drawPredicted,
      ),

    awayActual,

    awayPredicted,

    awayCorrect,

    awayRecall:
      safePercentage(
        awayCorrect,
        awayActual,
      ) ??
      0,

    awayPrecision:
      safePercentage(
        awayCorrect,
        awayPredicted,
      ),
  };
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "V1 ML + POISSON ENSEMBLE TEST",
  );

  console.log(
    "========================================",
  );

  console.log("");

  /*
   * ============================================================
   * 1. TRAINING DATA
   * ============================================================
   */

  const allRows:
    Awaited<
      ReturnType<
        typeof collectTrainingData
      >
    >["rows"] = [];

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

    console.log(
      `  collected ${result.collectedMatchCount}`,
    );

    allRows.push(
      ...result.rows,
    );
  }

  /*
   * ============================================================
   * 2. MATRIX
   * ============================================================
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
   * 3. CHRONOLOGICAL SPLIT
   * ============================================================
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
   * 4. ML MODEL
   * ============================================================
   */

  const mlResult =
    trainSimpleLearningModel(
      split,
      {
        classWeights: {
          HOME:
            1,

          DRAW:
            1,

          AWAY:
            1,
        },
      },
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
    "Collected rows":
      allRows.length,

    "Matrix rows":
      matrix.rowCount,

    "Matrix columns":
      matrix.columnCount,

    Training:
      split.training.rowCount,

    Validation:
      split.validation.rowCount,

    "ML Accuracy":
      mlResult
        .validationMetrics
        .accuracyPercentage,

    "ML Brier":
      mlResult
        .validationMetrics
        .brierScore,

    "ML Log Loss":
      mlResult
        .validationMetrics
        .logLoss,
  });

  /*
   * ============================================================
   * 5. POISSON PREDICTIONS FOR SAME VALIDATION MATCHES
   * ============================================================
   */

  console.log("");
  console.log(
    "Poisson validation tahminleri hazırlanıyor...",
  );

  const rows:
    EnsembleRow[] = [];

  const validationPredictions =
    mlResult
      .validationPredictions;

  for (
    let index = 0;
    index <
    validationPredictions.length;
    index += 1
  ) {
    const mlPrediction =
      validationPredictions[
        index
      ];

    const poissonResult =
      await calculateGoalProbabilities(
        mlPrediction.matchId,
      );

    const mlProbabilities =
      normalizeProbabilities({
        home:
          mlPrediction
            .homeProbability /
          100,

        draw:
          mlPrediction
            .drawProbability /
          100,

        away:
          mlPrediction
            .awayProbability /
          100,
      });

    const poissonProbabilities =
      normalizeProbabilities({
        home:
          poissonResult
            .outcomeProbabilities
            .home /
          100,

        draw:
          poissonResult
            .outcomeProbabilities
            .draw /
          100,

        away:
          poissonResult
            .outcomeProbabilities
            .away /
          100,
      });

    rows.push({
      matchId:
        mlPrediction.matchId,

      actualOutcome:
        mlPrediction
          .actualOutcome,

      ml:
        mlProbabilities,

      poisson:
        poissonProbabilities,
    });

    if (
      (
        index +
        1
      ) %
        100 ===
      0
    ) {
      console.log(
        `[${index + 1}/${validationPredictions.length}] hazır`,
      );
    }
  }

  /*
   * ============================================================
   * 6. ENSEMBLE GRID
   * ============================================================
   */

  const results:
    EnsembleResult[] =
      ML_WEIGHTS.map(
        (
          mlWeight,
        ) =>
          evaluateEnsemble(
            rows,
            mlWeight,
          ),
      );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "ENSEMBLE RESULTS",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    results.map(
      (
        result,
      ) => ({
        ml:
          result.mlWeight,

        poisson:
          result.poissonWeight,

        accuracy:
          result.accuracy,

        brier:
          result.brier,

        logLoss:
          result.logLoss,

        confidence:
          result.averageConfidence,

        homeRecall:
          result.homeRecall,

        drawRecall:
          result.drawRecall,

        awayRecall:
          result.awayRecall,

        drawPredicted:
          result.drawPredicted,
      }),
    ),
  );

  /*
   * ============================================================
   * 7. RANKING
   * ============================================================
   *
   * Probability sistemi için önce:
   *
   * Brier düşük
   *
   * sonra:
   *
   * Log Loss düşük
   *
   * sonra:
   *
   * Accuracy yüksek
   *
   * sıralaması kullanılıyor.
   */

  const ranking =
    [
      ...results,
    ].sort(
      (
        left,
        right,
      ) => {
        const brierDifference =
          left.brier -
          right.brier;

        if (
          Math.abs(
            brierDifference,
          ) >
          0.000001
        ) {
          return brierDifference;
        }

        const logLossDifference =
          left.logLoss -
          right.logLoss;

        if (
          Math.abs(
            logLossDifference,
          ) >
          0.000001
        ) {
          return logLossDifference;
        }

        return (
          right.accuracy -
          left.accuracy
        );
      },
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TOP 5 BY BRIER",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    ranking
      .slice(
        0,
        5,
      )
      .map(
        (
          result,
          index,
        ) => ({
          rank:
            index + 1,

          ml:
            result.mlWeight,

          poisson:
            result.poissonWeight,

          accuracy:
            result.accuracy,

          brier:
            result.brier,

          logLoss:
            result.logLoss,

          homeRecall:
            result.homeRecall,

          drawRecall:
            result.drawRecall,

          awayRecall:
            result.awayRecall,
        }),
      ),
  );

  /*
   * ============================================================
   * 8. BEST ENSEMBLE
   * ============================================================
   */

  const best =
    ranking[
      0
    ];

  if (
    !best
  ) {
    throw new Error(
      "Ensemble sonucu üretilemedi.",
    );
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "BEST ENSEMBLE",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    "ML Weight":
      best.mlWeight,

    "Poisson Weight":
      best.poissonWeight,

    Matches:
      best.matches,

    Accuracy:
      best.accuracy,

    Brier:
      best.brier,

    "Log Loss":
      best.logLoss,

    Confidence:
      best.averageConfidence,

    "HOME Actual":
      best.homeActual,

    "HOME Predicted":
      best.homePredicted,

    "HOME Recall":
      best.homeRecall,

    "HOME Precision":
      best.homePrecision,

    "DRAW Actual":
      best.drawActual,

    "DRAW Predicted":
      best.drawPredicted,

    "DRAW Recall":
      best.drawRecall,

    "DRAW Precision":
      best.drawPrecision,

    "AWAY Actual":
      best.awayActual,

    "AWAY Predicted":
      best.awayPredicted,

    "AWAY Recall":
      best.awayRecall,

    "AWAY Precision":
      best.awayPrecision,
  });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "ENSEMBLE TEST COMPLETE",
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