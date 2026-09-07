import "dotenv/config";

import { ACTIVE_COMPETITIONS } from "@/config/competitions";

import {
  buildTrainingMatrix,
  collectTrainingData,
  trainSimpleLearningModel,
} from "@/modules/learning-engine";

import { calculateGoalProbabilities } from "@/modules/goal-probability-engine";

import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

const SEASON_YEAR = 2024;
const CURRENT_ML_WEIGHT = 0.2;
const FINAL_TRAIN_RATIO = 0.8;
const MIN_PROBABILITY = 1e-15;

const CORE_FEATURES = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

const DEVELOPMENT_FOLDS = [
  { name: "FOLD 1", trainRatio: 0.5, testEndRatio: 0.6 },
  { name: "FOLD 2", trainRatio: 0.6, testEndRatio: 0.7 },
  { name: "FOLD 3", trainRatio: 0.7, testEndRatio: 0.8 },
] as const;

const ML_WEIGHTS = Array.from(
  { length: 11 },
  (_, index) => index / 10,
);

const OUTCOMES: MatchOutcome[] = ["HOME", "DRAW", "AWAY"];

type TrainingMatrix = ReturnType<typeof buildTrainingMatrix>;

type ComponentPredictionRow = {
  matchId: number;
  actualOutcome: MatchOutcome;
  ml: OutcomeProbabilities;
  poisson: OutcomeProbabilities;
};

type PredictionRow = {
  actualOutcome: MatchOutcome;
  probabilities: OutcomeProbabilities;
};

type Metrics = {
  matches: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  ece: number;
  predictedHome: number;
  predictedDraw: number;
  predictedAway: number;
};

type FoldResult = {
  name: string;
  trainMatches: number;
  testMatches: number;
  trainFirst: string;
  trainLast: string;
  testFirst: string;
  testLast: string;
  rows: ComponentPredictionRow[];
};

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatDate(value: Date): string {
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) ? value.toISOString() : "INVALID DATE";
}

function normalize(
  probabilities: OutcomeProbabilities,
): OutcomeProbabilities {
  const total =
    probabilities.home + probabilities.draw + probabilities.away;

  if (!Number.isFinite(total) || total <= 0) {
    return { home: 33.33, draw: 33.34, away: 33.33 };
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
  mlWeight: number,
): OutcomeProbabilities {
  const poissonWeight = 1 - mlWeight;

  return normalize({
    home: ml.home * mlWeight + poisson.home * poissonWeight,
    draw: ml.draw * mlWeight + poisson.draw * poissonWeight,
    away: ml.away * mlWeight + poisson.away * poissonWeight,
  });
}

function probabilityFor(
  probabilities: OutcomeProbabilities,
  outcome: MatchOutcome,
): number {
  if (outcome === "HOME") return probabilities.home;
  if (outcome === "DRAW") return probabilities.draw;
  return probabilities.away;
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

function calculateClasswiseEce(rows: PredictionRow[]): number {
  let weightedError = 0;
  let observationsCount = 0;

  for (const outcome of OUTCOMES) {
    for (let minimum = 0; minimum < 100; minimum += 10) {
      const maximum = minimum + 10;
      const observations = rows.filter((row) => {
        const probability = probabilityFor(row.probabilities, outcome);
        return probability >= minimum &&
          (maximum === 100
            ? probability <= maximum
            : probability < maximum);
      });

      if (observations.length === 0) continue;

      const averageProbability = observations.reduce(
        (total, row) =>
          total + probabilityFor(row.probabilities, outcome) / 100,
        0,
      ) / observations.length;

      const occurrenceRate = observations.filter(
        (row) => row.actualOutcome === outcome,
      ).length / observations.length;

      weightedError +=
        Math.abs(averageProbability - occurrenceRate) * observations.length;
      observationsCount += observations.length;
    }
  }

  return observationsCount > 0
    ? weightedError / observationsCount
    : 0;
}

function evaluate(
  componentRows: ComponentPredictionRow[],
  mlWeight: number,
): Metrics {
  const rows: PredictionRow[] = componentRows.map((row) => ({
    actualOutcome: row.actualOutcome,
    probabilities: blend(row.ml, row.poisson, mlWeight),
  }));

  if (rows.length === 0) {
    throw new Error("Degerlendirme icin mac bulunamadi.");
  }

  let correct = 0;
  let brier = 0;
  let logLoss = 0;

  const predictedCounts: Record<MatchOutcome, number> = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
  };

  for (const row of rows) {
    const predicted = predictedOutcome(row.probabilities);
    predictedCounts[predicted] += 1;

    if (predicted === row.actualOutcome) correct += 1;

    for (const outcome of OUTCOMES) {
      const probability = probabilityFor(row.probabilities, outcome) / 100;
      const actual = row.actualOutcome === outcome ? 1 : 0;
      brier += (probability - actual) ** 2;
    }

    logLoss += -Math.log(
      Math.max(
        probabilityFor(row.probabilities, row.actualOutcome) / 100,
        MIN_PROBABILITY,
      ),
    );
  }

  return {
    matches: rows.length,
    accuracy: round(correct / rows.length * 100, 2),
    brier: round(brier / rows.length),
    logLoss: round(logLoss / rows.length),
    ece: round(calculateClasswiseEce(rows)),
    predictedHome: predictedCounts.HOME,
    predictedDraw: predictedCounts.DRAW,
    predictedAway: predictedCounts.AWAY,
  };
}

function configurationName(mlWeight: number): string {
  const ml = Math.round(mlWeight * 100);
  const poisson = 100 - ml;

  if (mlWeight === 0) return "PURE POISSON";
  if (mlWeight === 1) return "PURE ML";
  if (mlWeight === CURRENT_ML_WEIGHT) {
    return `ML ${ml}% / POISSON ${poisson}% (CURRENT)`;
  }

  return `ML ${ml}% / POISSON ${poisson}%`;
}

function toChronologicalMatrix(matrix: TrainingMatrix): TrainingMatrix {
  const invalidDateCount = matrix.metadata.filter(
    (metadata) => !Number.isFinite(metadata.kickoffAt.getTime()),
  ).length;

  if (invalidDateCount > 0) {
    throw new Error(
      `Training matrix ${invalidDateCount} gecersiz kickoffAt tarihi iceriyor.`,
    );
  }

  const order = matrix.metadata
    .map((metadata, index) => ({
      index,
      timestamp: metadata.kickoffAt.getTime(),
    }))
    .sort(
      (left, right) =>
        left.timestamp - right.timestamp || left.index - right.index,
    )
    .map((item) => item.index);

  const result = {
    ...matrix,
    X: order.map((index) => matrix.X[index]),
    yOneHot: order.map((index) => matrix.yOneHot[index]),
    y: order.map((index) => matrix.y[index]),
    metadata: order.map((index) => matrix.metadata[index]),
  };

  for (let index = 1; index < result.metadata.length; index += 1) {
    if (
      result.metadata[index - 1].kickoffAt.getTime() >
      result.metadata[index].kickoffAt.getTime()
    ) {
      throw new Error("Kronolojik siralama dogrulanamadi.");
    }
  }

  return result;
}

function buildPartition(
  matrix: TrainingMatrix,
  start: number,
  end: number,
) {
  return {
    featureNames: matrix.featureNames,
    X: matrix.X.slice(start, end),
    y: matrix.yOneHot.slice(start, end),
    yClass: matrix.y.slice(start, end),
    metadata: matrix.metadata.slice(start, end),
    rowCount: end - start,
    startedAt: matrix.metadata[start].kickoffAt,
    endedAt: matrix.metadata[end - 1].kickoffAt,
  };
}

async function runFold(
  matrix: TrainingMatrix,
  name: string,
  trainEnd: number,
  testEnd: number,
): Promise<FoldResult> {
  const training = buildPartition(matrix, 0, trainEnd);
  const validation = buildPartition(matrix, trainEnd, testEnd);

  const split = {
    training,
    validation,
    trainingPercentage: trainEnd / testEnd * 100,
    validationPercentage: (testEnd - trainEnd) / testEnd * 100,
    splitIndex: trainEnd,
    splitDate: validation.startedAt,
    totalRowCount: testEnd,
    warnings: [],
  };

  const mlResult = trainSimpleLearningModel(split);
  const rows: ComponentPredictionRow[] = [];

  console.log("");
  console.log(
    `${name}: ${training.rowCount} train, ${validation.rowCount} test`,
  );

  for (
    let index = 0;
    index < mlResult.validationPredictions.length;
    index += 1
  ) {
    const ml = mlResult.validationPredictions[index];
    const poisson = await calculateGoalProbabilities(ml.matchId);

    rows.push({
      matchId: ml.matchId,
      actualOutcome: ml.actualOutcome,
      ml: normalize({
        home: ml.homeProbability,
        draw: ml.drawProbability,
        away: ml.awayProbability,
      }),
      poisson: normalize(poisson.outcomeProbabilities),
    });

    if ((index + 1) % 100 === 0) {
      console.log(
        `${name} ANALYSIS ${index + 1}/${mlResult.validationPredictions.length}`,
      );
    }
  }

  return {
    name,
    trainMatches: training.rowCount,
    testMatches: validation.rowCount,
    trainFirst: formatDate(training.startedAt),
    trainLast: formatDate(training.endedAt),
    testFirst: formatDate(validation.startedAt),
    testLast: formatDate(validation.endedAt),
    rows,
  };
}

function aggregateSelectionTable(folds: FoldResult[]) {
  const combinedRows = folds.flatMap((fold) => fold.rows);

  return ML_WEIGHTS.map((mlWeight) => {
    const aggregate = evaluate(combinedRows, mlWeight);
    const foldMetrics = folds.map((fold) => evaluate(fold.rows, mlWeight));

    return {
      configuration: configurationName(mlWeight),
      mlWeight: Math.round(mlWeight * 100),
      poissonWeight: Math.round((1 - mlWeight) * 100),
      matches: aggregate.matches,
      foldsWonVsCurrent: foldMetrics.filter((metrics, index) => {
        const current = evaluate(
          folds[index].rows,
          CURRENT_ML_WEIGHT,
        );
        return metrics.brier < current.brier;
      }).length,
      accuracy: aggregate.accuracy,
      brier: aggregate.brier,
      logLoss: aggregate.logLoss,
      ece: aggregate.ece,
      predictedHome: aggregate.predictedHome,
      predictedDraw: aggregate.predictedDraw,
      predictedAway: aggregate.predictedAway,
    };
  }).sort((left, right) => {
    const brierDifference = left.brier - right.brier;
    if (Math.abs(brierDifference) > 1e-9) return brierDifference;

    const logLossDifference = left.logLoss - right.logLoss;
    if (Math.abs(logLossDifference) > 1e-9) return logLossDifference;

    return Math.abs(left.mlWeight - 20) - Math.abs(right.mlWeight - 20);
  });
}

function comparisonTable(
  current: Metrics,
  candidate: Metrics,
) {
  return [
    {
      metric: "Accuracy (%)",
      better: "HIGHER",
      current: current.accuracy,
      candidate: candidate.accuracy,
      change: round(candidate.accuracy - current.accuracy, 4),
    },
    {
      metric: "Brier Score",
      better: "LOWER",
      current: current.brier,
      candidate: candidate.brier,
      change: round(candidate.brier - current.brier),
    },
    {
      metric: "Log Loss",
      better: "LOWER",
      current: current.logLoss,
      candidate: candidate.logLoss,
      change: round(candidate.logLoss - current.logLoss),
    },
    {
      metric: "ECE",
      better: "LOWER",
      current: current.ece,
      candidate: candidate.ece,
      change: round(candidate.ece - current.ece),
    },
    {
      metric: "Predicted HOME",
      better: "INFO",
      current: current.predictedHome,
      candidate: candidate.predictedHome,
      change: candidate.predictedHome - current.predictedHome,
    },
    {
      metric: "Predicted DRAW",
      better: "INFO",
      current: current.predictedDraw,
      candidate: candidate.predictedDraw,
      change: candidate.predictedDraw - current.predictedDraw,
    },
    {
      metric: "Predicted AWAY",
      better: "INFO",
      current: current.predictedAway,
      candidate: candidate.predictedAway,
      change: candidate.predictedAway - current.predictedAway,
    },
  ];
}

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("ENSEMBLE WEIGHT - ROLLING WALK-FORWARD TEST");
  console.log("==============================================");

  console.table({
    Season: SEASON_YEAR,
    "Development folds": "50-60%, 60-70%, 70-80%",
    "Final unseen test": "Train 0-80%, test 80-100%",
    "Current ML / Poisson": "20% / 80%",
    "Weights under test": "0% to 100% ML, steps of 10%",
  });

  const allRows:
    Awaited<ReturnType<typeof collectTrainingData>>["rows"] = [];

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

  const matrix = toChronologicalMatrix(
    buildTrainingMatrix(allRows, {
      includeSideFeatures: false,
      includeDifferenceFeatures: true,
      missingValueStrategy: "COLUMN_MEAN",
      maximumMissingRatio: 0.5,
    }),
  );

  if (matrix.rowCount < 100) {
    throw new Error("Walk-forward testi icin veri yetersiz.");
  }

  console.log("");
  console.table({
    Total: matrix.rowCount,
    "First match": formatDate(matrix.metadata[0].kickoffAt),
    "Last match": formatDate(
      matrix.metadata[matrix.rowCount - 1].kickoffAt,
    ),
    "Invalid dates": 0,
    "Chronological order": "PASS",
  });

  const developmentFolds: FoldResult[] = [];

  for (const fold of DEVELOPMENT_FOLDS) {
    const trainEnd = Math.floor(matrix.rowCount * fold.trainRatio);
    const testEnd = Math.floor(matrix.rowCount * fold.testEndRatio);

    developmentFolds.push(
      await runFold(matrix, fold.name, trainEnd, testEnd),
    );
  }

  console.log("");
  console.log("==============================================");
  console.log("DEVELOPMENT FOLD BOUNDARIES");
  console.log("==============================================");
  console.table(
    developmentFolds.map((fold) => ({
      fold: fold.name,
      trainMatches: fold.trainMatches,
      testMatches: fold.testMatches,
      trainFirst: fold.trainFirst,
      trainLast: fold.trainLast,
      testFirst: fold.testFirst,
      testLast: fold.testLast,
    })),
  );

  const selectionTable = aggregateSelectionTable(developmentFolds);
  const selectedMlWeight = selectionTable[0].mlWeight / 100;

  console.log("");
  console.log("==============================================");
  console.log("AGGREGATE WEIGHT SELECTION - DEVELOPMENT ONLY");
  console.log("==============================================");
  console.table(selectionTable);

  console.log("");
  console.table({
    "Selected configuration": configurationName(selectedMlWeight),
    "Selected ML weight": `${selectedMlWeight * 100}%`,
    "Selected Poisson weight": `${(1 - selectedMlWeight) * 100}%`,
    "Development Brier": selectionTable[0].brier,
    "Development Log Loss": selectionTable[0].logLoss,
  });

  console.log("");
  console.log("==============================================");
  console.log("PURE POISSON VS CURRENT 20/80 - EACH DEV FOLD");
  console.log("==============================================");
  console.table(
    developmentFolds.map((fold) => {
      const poisson = evaluate(fold.rows, 0);
      const current = evaluate(fold.rows, CURRENT_ML_WEIGHT);

      return {
        fold: fold.name,
        matches: fold.testMatches,
        poissonAccuracy: poisson.accuracy,
        currentAccuracy: current.accuracy,
        poissonBrier: poisson.brier,
        currentBrier: current.brier,
        brierWinner:
          poisson.brier < current.brier ? "POISSON" : "CURRENT 20/80",
        poissonLogLoss: poisson.logLoss,
        currentLogLoss: current.logLoss,
      };
    }),
  );

  const finalTrainEnd = Math.floor(
    matrix.rowCount * FINAL_TRAIN_RATIO,
  );
  const finalFold = await runFold(
    matrix,
    "FINAL TEST",
    finalTrainEnd,
    matrix.rowCount,
  );

  const currentFinal = evaluate(finalFold.rows, CURRENT_ML_WEIGHT);
  const selectedFinal = evaluate(finalFold.rows, selectedMlWeight);
  const purePoissonFinal = evaluate(finalFold.rows, 0);
  const pureMlFinal = evaluate(finalFold.rows, 1);

  console.log("");
  console.log("==============================================");
  console.log("FINAL UNSEEN TEST BOUNDARY");
  console.log("==============================================");
  console.table({
    "Train matches": finalFold.trainMatches,
    "Test matches": finalFold.testMatches,
    "Train first": finalFold.trainFirst,
    "Train last": finalFold.trainLast,
    "Test first": finalFold.testFirst,
    "Test last": finalFold.testLast,
  });

  console.log("");
  console.log("==============================================");
  console.log("FINAL UNSEEN TEST - MODEL SUMMARY");
  console.log("==============================================");
  console.table([
    {
      model: "PURE POISSON",
      ...purePoissonFinal,
    },
    {
      model: "CURRENT 20% ML / 80% POISSON",
      ...currentFinal,
    },
    {
      model: `SELECTED ${selectedMlWeight * 100}% ML / ${(1 - selectedMlWeight) * 100}% POISSON`,
      ...selectedFinal,
    },
    {
      model: "PURE ML",
      ...pureMlFinal,
    },
  ]);

  console.log("");
  console.log("==============================================");
  console.log("CURRENT VS DEVELOPMENT-SELECTED - FINAL TEST");
  console.log("==============================================");
  console.table(comparisonTable(currentFinal, selectedFinal));

  const differentWeight = selectedMlWeight !== CURRENT_ML_WEIGHT;
  const brierImproved = selectedFinal.brier < currentFinal.brier;
  const logLossImproved = selectedFinal.logLoss < currentFinal.logLoss;
  const eceImproved = selectedFinal.ece < currentFinal.ece;
  const accuracyAcceptable =
    selectedFinal.accuracy >= currentFinal.accuracy - 0.5;

  const pass =
    differentWeight &&
    brierImproved &&
    logLossImproved &&
    eceImproved &&
    accuracyAcceptable;

  console.log("");
  console.log("==============================================");
  console.log("MODEL DECISION");
  console.log("==============================================");
  console.table({
    "Development selected different weight":
      differentWeight ? "YES" : "NO",
    "Final Brier improved": brierImproved ? "YES" : "NO",
    "Final Log Loss improved": logLossImproved ? "YES" : "NO",
    "Final ECE improved": eceImproved ? "YES" : "NO",
    "Final accuracy acceptable": accuracyAcceptable ? "YES" : "NO",
    Decision: pass
      ? "PASS - CANDIDATE FOR NEW-SEASON OUT-OF-TIME TEST"
      : "REJECT CANDIDATE - KEEP CURRENT 20/80",
  });

  console.log("");
  console.log(
    "Not: PASS production onayi degildir. " +
    "Ayni aday yeni sezonda test edilmelidir.",
  );

  console.log("");
  console.log("==============================================");
  console.log("ROLLING WALK-FORWARD TEST COMPLETED");
  console.log("==============================================");
}

main().catch((error: unknown) => {
  console.error("");
  console.error("Rolling walk-forward test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
