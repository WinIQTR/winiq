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
  buildCalibrationProfileFromPredictions,
} from "@/modules/calibration-engine";

import type {
  CalibrationProfile,
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

const TRAIN_RATIO = 0.55;
const PROFILE_RATIO = 0.15;
const SELECTION_RATIO = 0.1;

const MIN_PROBABILITY = 1e-15;

const OUTCOMES: MatchOutcome[] = [
  "HOME",
  "DRAW",
  "AWAY",
];

type CalibrationConfiguration = {
  name: string;
  strength: number;
  maximumChange: number;
};

type CalibrationBucket =
  CalibrationProfile["outcomes"][MatchOutcome]["buckets"][number];

type PredictionRow = {
  matchId: number;
  actualOutcome: MatchOutcome;
  raw: OutcomeProbabilities;
};

type EvaluationResult = {
  matches: number;
  accuracy: number;
  brier: number;
  drawBrier: number;
  logLoss: number;
  ece: number;
  predictedHome: number;
  predictedDraw: number;
  predictedAway: number;
};

const CONFIGURATIONS: CalibrationConfiguration[] = [
  {
    name: "RAW / NO CALIBRATION",
    strength: 0,
    maximumChange: 0,
  },
  ...[0.25, 0.5, 0.75].flatMap(
    (strength) =>
      [2, 4, 6].map(
        (maximumChange) => ({
          name:
            `V2 S=${strength} CAP=${maximumChange}`,
          strength,
          maximumChange,
        }),
      ),
  ),
];

function round(
  value: number,
  decimals = 6,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function normalize(
  probabilities: OutcomeProbabilities,
): OutcomeProbabilities {
  const total =
    probabilities.home +
    probabilities.draw +
    probabilities.away;

  if (!Number.isFinite(total) || total <= 0) {
    return {
      home: 33.33,
      draw: 33.34,
      away: 33.33,
    };
  }

  return {
    home: probabilities.home / total * 100,
    draw: probabilities.draw / total * 100,
    away: probabilities.away / total * 100,
  };
}

function blend(
  ml: OutcomeProbabilities,
  poisson: OutcomeProbabilities,
): OutcomeProbabilities {
  return normalize({
    home:
      ml.home * ML_WEIGHT +
      poisson.home * POISSON_WEIGHT,
    draw:
      ml.draw * ML_WEIGHT +
      poisson.draw * POISSON_WEIGHT,
    away:
      ml.away * ML_WEIGHT +
      poisson.away * POISSON_WEIGHT,
  });
}

function getProbability(
  probabilities: OutcomeProbabilities,
  outcome: MatchOutcome,
): number {
  switch (outcome) {
    case "HOME":
      return probabilities.home;
    case "DRAW":
      return probabilities.draw;
    case "AWAY":
      return probabilities.away;
  }
}

function toProbabilities(
  values: Record<MatchOutcome, number>,
): OutcomeProbabilities {
  return normalize({
    home: values.HOME,
    draw: values.DRAW,
    away: values.AWAY,
  });
}

function findBucket(
  buckets: CalibrationBucket[],
  probability: number,
): CalibrationBucket | null {
  return (
    buckets.find((bucket) => {
      const isLastBucket =
        bucket.maximumProbability === 100;

      return (
        probability >= bucket.minimumProbability &&
        (
          isLastBucket
            ? probability <= bucket.maximumProbability
            : probability < bucket.maximumProbability
        )
      );
    }) ?? null
  );
}

/*
 * Calibration V1, bucket'in tarihsel oranını ham tahminin
 * yerine tamamen koyuyordu. V2 yalnızca farkın güvenilirlik
 * ağırlıklı bir bölümünü uygular ve değişimi sınırlar.
 */
function applyCalibrationV2(options: {
  probabilities: OutcomeProbabilities;
  profile: CalibrationProfile;
  configuration: CalibrationConfiguration;
}): OutcomeProbabilities {
  if (options.configuration.strength <= 0) {
    return options.probabilities;
  }

  const adjusted =
    {} as Record<MatchOutcome, number>;

  for (const outcome of OUTCOMES) {
    const raw = getProbability(
      options.probabilities,
      outcome,
    );

    const bucket = findBucket(
      options.profile.outcomes[outcome].buckets,
      raw,
    );

    if (!bucket) {
      adjusted[outcome] = raw;
      continue;
    }

    const reliabilityWeight =
      clamp(bucket.reliabilityScore / 100, 0, 1);

    const requestedChange =
      (
        bucket.smoothedOccurrencePercentage -
        raw
      ) *
      options.configuration.strength *
      reliabilityWeight;

    const limitedChange = clamp(
      requestedChange,
      -options.configuration.maximumChange,
      options.configuration.maximumChange,
    );

    adjusted[outcome] = clamp(
      raw + limitedChange,
      0.01,
      99.98,
    );
  }

  return toProbabilities(adjusted);
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

function calculateBrier(
  actualOutcome: MatchOutcome,
  probabilities: OutcomeProbabilities,
): number {
  return OUTCOMES.reduce(
    (total, outcome) => {
      const predicted =
        getProbability(probabilities, outcome) / 100;

      const actual =
        actualOutcome === outcome ? 1 : 0;

      return total + (predicted - actual) ** 2;
    },
    0,
  );
}

function calculateDrawBrier(
  actualOutcome: MatchOutcome,
  probabilities: OutcomeProbabilities,
): number {
  const predicted = probabilities.draw / 100;
  const actual = actualOutcome === "DRAW" ? 1 : 0;

  return (predicted - actual) ** 2;
}

function calculateEce(
  rows: PredictionRow[],
  configuration: CalibrationConfiguration,
  profile: CalibrationProfile,
): number {
  let weightedError = 0;
  let observationCount = 0;

  for (const outcome of OUTCOMES) {
    for (let minimum = 0; minimum < 100; minimum += 10) {
      const maximum = minimum + 10;

      const observations = rows
        .map((row) => ({
          actual: row.actualOutcome === outcome ? 1 : 0,
          probability: getProbability(
            applyCalibrationV2({
              probabilities: row.raw,
              profile,
              configuration,
            }),
            outcome,
          ),
        }))
        .filter((item) =>
          item.probability >= minimum &&
          (
            maximum === 100
              ? item.probability <= maximum
              : item.probability < maximum
          ),
        );

      if (observations.length === 0) {
        continue;
      }

      const averageProbability =
        observations.reduce(
          (total, item) => total + item.probability,
          0,
        ) / observations.length / 100;

      const occurrenceRate =
        observations.reduce(
          (total, item) => total + item.actual,
          0,
        ) / observations.length;

      weightedError +=
        Math.abs(averageProbability - occurrenceRate) *
        observations.length;

      observationCount += observations.length;
    }
  }

  return observationCount > 0
    ? weightedError / observationCount
    : 0;
}

function evaluate(options: {
  rows: PredictionRow[];
  profile: CalibrationProfile;
  configuration: CalibrationConfiguration;
}): EvaluationResult {
  let correct = 0;
  let brier = 0;
  let drawBrier = 0;
  let logLoss = 0;
  let predictedHome = 0;
  let predictedDraw = 0;
  let predictedAway = 0;

  for (const row of options.rows) {
    const probabilities = applyCalibrationV2({
      probabilities: row.raw,
      profile: options.profile,
      configuration: options.configuration,
    });

    const predicted = predictedOutcome(probabilities);

    if (predicted === row.actualOutcome) {
      correct += 1;
    }

    if (predicted === "HOME") predictedHome += 1;
    if (predicted === "DRAW") predictedDraw += 1;
    if (predicted === "AWAY") predictedAway += 1;

    brier += calculateBrier(
      row.actualOutcome,
      probabilities,
    );

    drawBrier += calculateDrawBrier(
      row.actualOutcome,
      probabilities,
    );

    logLoss += -Math.log(
      Math.max(
        getProbability(
          probabilities,
          row.actualOutcome,
        ) / 100,
        MIN_PROBABILITY,
      ),
    );
  }

  const count = options.rows.length;

  return {
    matches: count,
    accuracy: round(correct / count * 100, 2),
    brier: round(brier / count),
    drawBrier: round(drawBrier / count),
    logLoss: round(logLoss / count),
    ece: round(
      calculateEce(
        options.rows,
        options.configuration,
        options.profile,
      ),
    ),
    predictedHome,
    predictedDraw,
    predictedAway,
  };
}

function chooseConfiguration(options: {
  rows: PredictionRow[];
  profile: CalibrationProfile;
}): {
  configuration: CalibrationConfiguration;
  result: EvaluationResult;
  audit: Array<
    EvaluationResult & {
      configuration: string;
      strength: number;
      cap: number;
    }
  >;
} {
  const evaluated = CONFIGURATIONS.map(
    (configuration) => ({
      configuration,
      result: evaluate({
        rows: options.rows,
        profile: options.profile,
        configuration,
      }),
    }),
  );

  evaluated.sort((left, right) => {
    const brierDifference =
      left.result.brier - right.result.brier;

    if (Math.abs(brierDifference) > 1e-9) {
      return brierDifference;
    }

    const logLossDifference =
      left.result.logLoss - right.result.logLoss;

    if (Math.abs(logLossDifference) > 1e-9) {
      return logLossDifference;
    }

    return left.configuration.strength -
      right.configuration.strength;
  });

  const best = evaluated[0];

  return {
    configuration: best.configuration,
    result: best.result,
    audit: evaluated.map((item) => ({
      configuration: item.configuration.name,
      strength: item.configuration.strength,
      cap: item.configuration.maximumChange,
      ...item.result,
    })),
  };
}

function comparisonTable(
  raw: EvaluationResult,
  calibrated: EvaluationResult,
) {
  return [
    {
      metric: "Accuracy (%)",
      better: "HIGHER",
      raw: raw.accuracy,
      calibrated: calibrated.accuracy,
      change: round(calibrated.accuracy - raw.accuracy, 4),
    },
    {
      metric: "Brier Score",
      better: "LOWER",
      raw: raw.brier,
      calibrated: calibrated.brier,
      change: round(calibrated.brier - raw.brier),
    },
    {
      metric: "Draw Brier Score",
      better: "LOWER",
      raw: raw.drawBrier,
      calibrated: calibrated.drawBrier,
      change: round(calibrated.drawBrier - raw.drawBrier),
    },
    {
      metric: "Log Loss",
      better: "LOWER",
      raw: raw.logLoss,
      calibrated: calibrated.logLoss,
      change: round(calibrated.logLoss - raw.logLoss),
    },
    {
      metric: "ECE",
      better: "LOWER",
      raw: raw.ece,
      calibrated: calibrated.ece,
      change: round(calibrated.ece - raw.ece),
    },
    {
      metric: "Predicted HOME",
      better: "INFO",
      raw: raw.predictedHome,
      calibrated: calibrated.predictedHome,
      change: calibrated.predictedHome - raw.predictedHome,
    },
    {
      metric: "Predicted DRAW",
      better: "INFO",
      raw: raw.predictedDraw,
      calibrated: calibrated.predictedDraw,
      change: calibrated.predictedDraw - raw.predictedDraw,
    },
    {
      metric: "Predicted AWAY",
      better: "INFO",
      raw: raw.predictedAway,
      calibrated: calibrated.predictedAway,
      change: calibrated.predictedAway - raw.predictedAway,
    },
  ];
}

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("CALIBRATION V2 - NESTED OUT-OF-SAMPLE TEST");
  console.log("==============================================");

  console.table({
    Season: SEASON_YEAR,
    "Base model train": `${TRAIN_RATIO * 100}%`,
    "Profile build": `${PROFILE_RATIO * 100}%`,
    "Parameter selection": `${SELECTION_RATIO * 100}%`,
    "Final unseen test":
      `${round((1 - TRAIN_RATIO - PROFILE_RATIO - SELECTION_RATIO) * 100, 2)}%`,
    "ML / Poisson": `${ML_WEIGHT * 100}% / ${POISSON_WEIGHT * 100}%`,
  });

  const allRows:
    Awaited<
      ReturnType<typeof collectTrainingData>
    >["rows"] = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    const result = await collectTrainingData({
      leagueApiId: competition.apiId,
      seasonYear: SEASON_YEAR,
      featureKeys: [...CORE_FEATURES],
      minimumDataQualityScore: 0,
      strictPreMatchOnly: true,
    });

    allRows.push(...result.rows);
  }

  const matrix = buildTrainingMatrix(
    allRows,
    {
      includeSideFeatures: false,
      includeDifferenceFeatures: true,
      missingValueStrategy: "COLUMN_MEAN",
      maximumMissingRatio: 0.5,
    },
  );

  const total = matrix.rowCount;
  const trainEnd = Math.floor(total * TRAIN_RATIO);
  const profileEnd = Math.floor(
    total * (TRAIN_RATIO + PROFILE_RATIO),
  );
  const selectionEnd = Math.floor(
    total *
      (
        TRAIN_RATIO +
        PROFILE_RATIO +
        SELECTION_RATIO
      ),
  );

  if (
    trainEnd <= 0 ||
    profileEnd <= trainEnd ||
    selectionEnd <= profileEnd ||
    selectionEnd >= total
  ) {
    throw new Error(
      "Dataset Calibration V2 bölümleri için yetersiz.",
    );
  }

  const trainingPartition = {
    featureNames: matrix.featureNames,
    X: matrix.X.slice(0, trainEnd),
    y: matrix.yOneHot.slice(0, trainEnd),
    yClass: matrix.y.slice(0, trainEnd),
    metadata: matrix.metadata.slice(0, trainEnd),
    rowCount: trainEnd,
    startedAt: matrix.metadata[0].kickoffAt,
    endedAt: matrix.metadata[trainEnd - 1].kickoffAt,
  };

  const futurePartition = {
    featureNames: matrix.featureNames,
    X: matrix.X.slice(trainEnd),
    y: matrix.yOneHot.slice(trainEnd),
    yClass: matrix.y.slice(trainEnd),
    metadata: matrix.metadata.slice(trainEnd),
    rowCount: total - trainEnd,
    startedAt: matrix.metadata[trainEnd].kickoffAt,
    endedAt: matrix.metadata[total - 1].kickoffAt,
  };

  const split = {
    training: trainingPartition,
    validation: futurePartition,
    trainingPercentage: TRAIN_RATIO * 100,
    validationPercentage: (1 - TRAIN_RATIO) * 100,
    splitIndex: trainEnd,
    splitDate: futurePartition.startedAt,
    totalRowCount: total,
    warnings: [],
  };

  const mlResult = trainSimpleLearningModel(split);
  const futureRows: PredictionRow[] = [];

  console.log("");
  console.log(
    `Raw ensemble predictions: ${mlResult.validationPredictions.length}`,
  );

  for (
    let index = 0;
    index < mlResult.validationPredictions.length;
    index += 1
  ) {
    const ml = mlResult.validationPredictions[index];
    const poisson = await calculateGoalProbabilities(ml.matchId);

    futureRows.push({
      matchId: ml.matchId,
      actualOutcome: ml.actualOutcome,
      raw: blend(
        {
          home: ml.homeProbability,
          draw: ml.drawProbability,
          away: ml.awayProbability,
        },
        poisson.outcomeProbabilities,
      ),
    });

    if ((index + 1) % 100 === 0) {
      console.log(
        `ANALYSIS ${index + 1}/${mlResult.validationPredictions.length}`,
      );
    }
  }

  const profileCount = profileEnd - trainEnd;
  const selectionCount = selectionEnd - profileEnd;

  const profileRows = futureRows.slice(0, profileCount);
  const selectionRows = futureRows.slice(
    profileCount,
    profileCount + selectionCount,
  );
  const finalTestRows = futureRows.slice(
    profileCount + selectionCount,
  );

  const profile = buildCalibrationProfileFromPredictions({
    rows: profileRows.map((row) => ({
      actualOutcome: row.actualOutcome,
      probabilities: row.raw,
    })),
    seasonYear: SEASON_YEAR,
    sourceModelName: "ml-poisson-ensemble",
    sourceModelVersion: "v2-calibration-research-20-80",
    priorStrength: 30,
    minimumReliableSampleSize: 50,
    bucketSize: 10,
  });

  console.log("");
  console.log("==============================================");
  console.log("DATASET SUMMARY");
  console.log("==============================================");

  console.table({
    Total: total,
    TRAIN: trainEnd,
    PROFILE: profileRows.length,
    SELECTION: selectionRows.length,
    "FINAL TEST": finalTestRows.length,
    "Profile version": profile.version,
  });

  const selection = chooseConfiguration({
    rows: selectionRows,
    profile,
  });

  console.log("");
  console.log("==============================================");
  console.log("PARAMETER SELECTION - VALIDATION ONLY");
  console.log("==============================================");
  console.table(selection.audit);

  console.log("");
  console.table({
    "Selected configuration": selection.configuration.name,
    Strength: selection.configuration.strength,
    "Maximum change":
      `${selection.configuration.maximumChange} percentage points`,
    "Selection Brier": selection.result.brier,
    "Selection Log Loss": selection.result.logLoss,
  });

  const rawConfiguration = CONFIGURATIONS[0];

  const rawFinal = evaluate({
    rows: finalTestRows,
    profile,
    configuration: rawConfiguration,
  });

  const calibratedFinal = evaluate({
    rows: finalTestRows,
    profile,
    configuration: selection.configuration,
  });

  console.log("");
  console.log("==============================================");
  console.log("FINAL UNSEEN TEST - MODEL COMPARISON");
  console.log("==============================================");
  console.table(
    comparisonTable(rawFinal, calibratedFinal),
  );

  const calibrationSelected =
    selection.configuration.strength > 0;
  const brierImproved =
    calibratedFinal.brier < rawFinal.brier;
  const logLossImproved =
    calibratedFinal.logLoss < rawFinal.logLoss;
  const eceImproved =
    calibratedFinal.ece < rawFinal.ece;
  const accuracyAcceptable =
    calibratedFinal.accuracy >= rawFinal.accuracy - 0.5;

  const pass =
    calibrationSelected &&
    brierImproved &&
    logLossImproved &&
    eceImproved &&
    accuracyAcceptable;

  console.log("");
  console.log("==============================================");
  console.log("MODEL DECISION");
  console.log("==============================================");

  console.table({
    "Calibration selected": calibrationSelected ? "YES" : "NO",
    "Brier improved": brierImproved ? "YES" : "NO",
    "Log Loss improved": logLossImproved ? "YES" : "NO",
    "ECE improved": eceImproved ? "YES" : "NO",
    "Accuracy acceptable": accuracyAcceptable ? "YES" : "NO",
    Decision: pass
      ? "PASS - CANDIDATE FOR OUT-OF-TIME TEST"
      : "REJECT - DO NOT ADD TO PRODUCTION",
  });

  console.log("");
  console.log(
    "Not: PASS doğrudan production onayı değildir. " +
    "Yeni sezon/out-of-time doğrulaması gerekir.",
  );

  console.log("");
  console.log("==============================================");
  console.log("CALIBRATION V2 TEST COMPLETED");
  console.log("==============================================");
}

main().catch((error: unknown) => {
  console.error("");
  console.error("Calibration V2 test failed.");
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
