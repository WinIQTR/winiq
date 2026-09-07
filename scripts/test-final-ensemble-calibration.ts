import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  buildTrainingMatrix,
  collectTrainingData,
  trainSimpleLearningModel,
} from "@/modules/learning-engine";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  applyCalibration,
  buildCalibrationProfileFromPredictions,
} from "@/modules/calibration-engine";

import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

const SEASON_YEAR = 2024;

const CORE_FEATURES = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

const ML_WEIGHT = 0.2;
const POISSON_WEIGHT = 0.8;

const MIN_PROBABILITY = 1e-15;

type EvaluationRow = {
  matchId: number;
  actualOutcome: MatchOutcome;

  raw:
    OutcomeProbabilities;

  calibrated?:
    OutcomeProbabilities;
};

function round(
  value: number,
  decimals = 6,
): number {
  const factor = 10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function normalize(
  probabilities: OutcomeProbabilities,
): OutcomeProbabilities {
  const total =
    probabilities.home +
    probabilities.draw +
    probabilities.away;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return {
      home: 33.33,
      draw: 33.34,
      away: 33.33,
    };
  }

  const home =
    probabilities.home /
    total *
    100;

  const draw =
    probabilities.draw /
    total *
    100;

  const away =
    probabilities.away /
    total *
    100;

  return {
    home,
    draw,
    away,
  };
}

function blend(
  ml: OutcomeProbabilities,
  poisson: OutcomeProbabilities,
): OutcomeProbabilities {
  return normalize({
    home:
      ml.home *
        ML_WEIGHT +
      poisson.home *
        POISSON_WEIGHT,

    draw:
      ml.draw *
        ML_WEIGHT +
      poisson.draw *
        POISSON_WEIGHT,

    away:
      ml.away *
        ML_WEIGHT +
      poisson.away *
        POISSON_WEIGHT,
  });
}

function predictedOutcome(
  probabilities: OutcomeProbabilities,
): MatchOutcome {
  if (
    probabilities.home >= probabilities.draw &&
    probabilities.home >= probabilities.away
  ) {
    return "HOME";
  }

  if (
    probabilities.draw >= probabilities.home &&
    probabilities.draw >= probabilities.away
  ) {
    return "DRAW";
  }

  return "AWAY";
}

function getActualProbability(
  actualOutcome: MatchOutcome,
  probabilities: OutcomeProbabilities,
): number {
  switch (actualOutcome) {
    case "HOME":
      return probabilities.home / 100;

    case "DRAW":
      return probabilities.draw / 100;

    case "AWAY":
      return probabilities.away / 100;
  }
}

function calculateBrier(
  actualOutcome: MatchOutcome,
  probabilities: OutcomeProbabilities,
): number {
  const home =
    probabilities.home / 100;

  const draw =
    probabilities.draw / 100;

  const away =
    probabilities.away / 100;

  const actualHome =
    actualOutcome === "HOME"
      ? 1
      : 0;

  const actualDraw =
    actualOutcome === "DRAW"
      ? 1
      : 0;

  const actualAway =
    actualOutcome === "AWAY"
      ? 1
      : 0;

  return (
    (home - actualHome) ** 2 +
    (draw - actualDraw) ** 2 +
    (away - actualAway) ** 2
  );
}

function evaluate(
  rows: EvaluationRow[],
  field: "raw" | "calibrated",
) {
  let correct = 0;

  let totalBrier = 0;
  let totalLogLoss = 0;

  let homeActual = 0;
  let drawActual = 0;
  let awayActual = 0;

  let homeCorrect = 0;
  let drawCorrect = 0;
  let awayCorrect = 0;

  let homePredicted = 0;
  let drawPredicted = 0;
  let awayPredicted = 0;

  for (
    const row
    of rows
  ) {
    const probabilities =
      field === "raw"
        ? row.raw
        : row.calibrated;

    if (!probabilities) {
      continue;
    }

    const predicted =
      predictedOutcome(
        probabilities,
      );

    if (
      predicted ===
      row.actualOutcome
    ) {
      correct += 1;
    }

    if (
      row.actualOutcome ===
      "HOME"
    ) {
      homeActual += 1;

      if (
        predicted ===
        "HOME"
      ) {
        homeCorrect += 1;
      }
    }

    if (
      row.actualOutcome ===
      "DRAW"
    ) {
      drawActual += 1;

      if (
        predicted ===
        "DRAW"
      ) {
        drawCorrect += 1;
      }
    }

    if (
      row.actualOutcome ===
      "AWAY"
    ) {
      awayActual += 1;

      if (
        predicted ===
        "AWAY"
      ) {
        awayCorrect += 1;
      }
    }

    if (
      predicted ===
      "HOME"
    ) {
      homePredicted += 1;
    }

    if (
      predicted ===
      "DRAW"
    ) {
      drawPredicted += 1;
    }

    if (
      predicted ===
      "AWAY"
    ) {
      awayPredicted += 1;
    }

    totalBrier +=
      calculateBrier(
        row.actualOutcome,
        probabilities,
      );

    totalLogLoss +=
      -Math.log(
        Math.max(
          getActualProbability(
            row.actualOutcome,
            probabilities,
          ),
          MIN_PROBABILITY,
        ),
      );
  }

  const count =
    rows.length;

  return {
    matches:
      count,

    accuracy:
      round(
        correct /
          count *
          100,
        2,
      ),

    brier:
      round(
        totalBrier /
          count,
      ),

    logLoss:
      round(
        totalLogLoss /
          count,
      ),

    homeRecall:
      homeActual > 0
        ? round(
            homeCorrect /
              homeActual *
              100,
            2,
          )
        : 0,

    drawRecall:
      drawActual > 0
        ? round(
            drawCorrect /
              drawActual *
              100,
            2,
          )
        : 0,

    awayRecall:
      awayActual > 0
        ? round(
            awayCorrect /
              awayActual *
              100,
            2,
          )
        : 0,

    homePredicted,
    drawPredicted,
    awayPredicted,
  };
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "FINAL ENSEMBLE CALIBRATION TEST",
  );

  console.log(
    "========================================",
  );

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
    const result =
      await collectTrainingData({
        leagueApiId:
          competition.apiId,

        seasonYear:
          SEASON_YEAR,

        featureKeys: [
          ...CORE_FEATURES,
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

  /*
   * Kronolojik sıralama matrix metadata'da zaten var.
   *
   * %60 TRAIN
   * %20 CALIBRATION
   * %20 FINAL TEST
   */
  const total =
    matrix.rowCount;

  const trainEnd =
    Math.floor(
      total *
        0.6,
    );

  const calibrationEnd =
    Math.floor(
      total *
        0.8,
    );

  const trainingPartition = {
    featureNames:
      matrix.featureNames,

    X:
      matrix.X.slice(
        0,
        trainEnd,
      ),

    y:
      matrix.yOneHot.slice(
        0,
        trainEnd,
      ),

    yClass:
      matrix.y.slice(
        0,
        trainEnd,
      ),

    metadata:
      matrix.metadata.slice(
        0,
        trainEnd,
      ),

    rowCount:
      trainEnd,

    startedAt:
      matrix.metadata[
        0
      ].kickoffAt,

    endedAt:
      matrix.metadata[
        trainEnd - 1
      ].kickoffAt,
  };

  const calibrationPartition = {
    featureNames:
      matrix.featureNames,

    X:
      matrix.X.slice(
        trainEnd,
        calibrationEnd,
      ),

    y:
      matrix.yOneHot.slice(
        trainEnd,
        calibrationEnd,
      ),

    yClass:
      matrix.y.slice(
        trainEnd,
        calibrationEnd,
      ),

    metadata:
      matrix.metadata.slice(
        trainEnd,
        calibrationEnd,
      ),

    rowCount:
      calibrationEnd -
      trainEnd,

    startedAt:
      matrix.metadata[
        trainEnd
      ].kickoffAt,

    endedAt:
      matrix.metadata[
        calibrationEnd - 1
      ].kickoffAt,
  };

  const finalTestPartition = {
    featureNames:
      matrix.featureNames,

    X:
      matrix.X.slice(
        calibrationEnd,
      ),

    y:
      matrix.yOneHot.slice(
        calibrationEnd,
      ),

    yClass:
      matrix.y.slice(
        calibrationEnd,
      ),

    metadata:
      matrix.metadata.slice(
        calibrationEnd,
      ),

    rowCount:
      total -
      calibrationEnd,

    startedAt:
      matrix.metadata[
        calibrationEnd
      ].kickoffAt,

    endedAt:
      matrix.metadata[
        total - 1
      ].kickoffAt,
  };

  /*
   * trainSimpleLearningModel mevcut olarak
   * train + validation split bekliyor.
   *
   * Calibration tahminlerini almak için
   * önce TRAIN → CALIBRATION modeli.
   */
  const calibrationSplit = {
    training:
      trainingPartition,

    validation:
      calibrationPartition,

    trainingPercentage:
      75,

    validationPercentage:
      25,

    splitIndex:
      trainEnd,

    splitDate:
      calibrationPartition
        .startedAt,

    totalRowCount:
      trainingPartition.rowCount +
      calibrationPartition.rowCount,

    warnings:
      [],
  };

  const calibrationMl =
    trainSimpleLearningModel(
      calibrationSplit,
    );

  const calibrationRows:
    Array<{
      actualOutcome:
        MatchOutcome;

      probabilities:
        OutcomeProbabilities;
    }> = [];

  console.log("");
  console.log(
    `Calibration maçları: ${calibrationMl.validationPredictions.length}`,
  );

  for (
    let index = 0;
    index <
    calibrationMl
      .validationPredictions
      .length;
    index += 1
  ) {
    const ml =
      calibrationMl
        .validationPredictions[
        index
      ];

    const poisson =
      await calculateGoalProbabilities(
        ml.matchId,
      );

    calibrationRows.push({
      actualOutcome:
        ml.actualOutcome,

      probabilities:
        blend(
          {
            home:
              ml.homeProbability,

            draw:
              ml.drawProbability,

            away:
              ml.awayProbability,
          },

          poisson
            .outcomeProbabilities,
        ),
    });
  }

  const profile =
    buildCalibrationProfileFromPredictions({
      rows:
        calibrationRows,

      seasonYear:
        SEASON_YEAR,

      sourceModelName:
        "ml-poisson-ensemble",

      sourceModelVersion:
        "v1.0-20-80",

      priorStrength:
        20,

      minimumReliableSampleSize:
        40,

      bucketSize:
        10,
    });

  /*
   * Final test model:
   *
   * TRAIN + CALIBRATION geçmişi kullanılır,
   * FINAL TEST tamamen görülmemiş kalır.
   */
  const finalTrainingPartition = {
    featureNames:
      matrix.featureNames,

    X:
      matrix.X.slice(
        0,
        calibrationEnd,
      ),

    y:
      matrix.yOneHot.slice(
        0,
        calibrationEnd,
      ),

    yClass:
      matrix.y.slice(
        0,
        calibrationEnd,
      ),

    metadata:
      matrix.metadata.slice(
        0,
        calibrationEnd,
      ),

    rowCount:
      calibrationEnd,

    startedAt:
      matrix.metadata[
        0
      ].kickoffAt,

    endedAt:
      matrix.metadata[
        calibrationEnd - 1
      ].kickoffAt,
  };

  const finalSplit = {
    training:
      finalTrainingPartition,

    validation:
      finalTestPartition,

    trainingPercentage:
      80,

    validationPercentage:
      20,

    splitIndex:
      calibrationEnd,

    splitDate:
      finalTestPartition
        .startedAt,

    totalRowCount:
      matrix.rowCount,

    warnings:
      [],
  };

  const finalMl =
    trainSimpleLearningModel(
      finalSplit,
    );

  const evaluationRows:
    EvaluationRow[] =
      [];

  console.log("");
  console.log(
    `Final unseen test: ${finalMl.validationPredictions.length}`,
  );

  for (
    let index = 0;
    index <
    finalMl
      .validationPredictions
      .length;
    index += 1
  ) {
    const ml =
      finalMl
        .validationPredictions[
        index
      ];

    const poisson =
      await calculateGoalProbabilities(
        ml.matchId,
      );

    const raw =
      blend(
        {
          home:
            ml.homeProbability,

          draw:
            ml.drawProbability,

          away:
            ml.awayProbability,
        },

        poisson
          .outcomeProbabilities,
      );

    const calibration =
      applyCalibration({
        probabilities:
          raw,

        profile,
      });

    evaluationRows.push({
      matchId:
        ml.matchId,

      actualOutcome:
        ml.actualOutcome,

      raw,

      calibrated:
        calibration
          .calibratedProbabilities,
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
        `[${index + 1}/${finalMl.validationPredictions.length}]`,
      );
    }
  }

  const rawResult =
    evaluate(
      evaluationRows,
      "raw",
    );

  const calibratedResult =
    evaluate(
      evaluationRows,
      "calibrated",
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "FINAL UNSEEN TEST",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table([
    {
      model:
        "RAW ENSEMBLE",

      ...rawResult,
    },

    {
      model:
        "CALIBRATED",

      ...calibratedResult,
    },
  ]);

  console.log("");
  console.log(
    "CALIBRATION PROFILE",
  );

  console.table({
    version:
      profile.version,

    calibrationMatches:
      calibrationRows.length,

    priorStrength:
      profile.priorStrength,

    minimumReliableSample:
      profile
        .minimumReliableSampleSize,

    homeBuckets:
      profile
        .outcomes
        .HOME
        .buckets
        .length,

    drawBuckets:
      profile
        .outcomes
        .DRAW
        .buckets
        .length,

    awayBuckets:
      profile
        .outcomes
        .AWAY
        .buckets
        .length,
  });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "CALIBRATION TEST COMPLETE",
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