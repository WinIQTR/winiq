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

const TRAIN_RATIO = 0.7;
const SELECTION_RATIO = 0.1;
const CURRENT_ML_WEIGHT = 0.2;
const MIN_PROBABILITY = 1e-15;

const OUTCOMES: MatchOutcome[] = [
  "HOME",
  "DRAW",
  "AWAY",
];

const ML_WEIGHTS = Array.from(
  { length: 11 },
  (_, index) => index / 10,
);

type ComponentPredictionRow = {
  matchId: number;
  actualOutcome: MatchOutcome;
  ml: OutcomeProbabilities;
  poisson: OutcomeProbabilities;
};

type PredictionRow = {
  matchId: number;
  actualOutcome: MatchOutcome;
  probabilities: OutcomeProbabilities;
};

type ConfusionMatrix = Record<
  MatchOutcome,
  Record<MatchOutcome, number>
>;

type OutcomeAudit = {
  outcome: MatchOutcome;
  actual: number;
  predicted: number;
  truePositive: number;
  precision: number;
  recall: number;
  averageProbability: number;
  brier: number;
};

type EvaluationResult = {
  matches: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  ece: number;
  actualHome: number;
  actualDraw: number;
  actualAway: number;
  predictedHome: number;
  predictedDraw: number;
  predictedAway: number;
  homeBrier: number;
  drawBrier: number;
  awayBrier: number;
  confusionMatrix: ConfusionMatrix;
  outcomeAudit: OutcomeAudit[];
};

type WeightAuditRow = {
  configuration: string;
  mlWeight: number;
  poissonWeight: number;
  matches: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  ece: number;
  predictedHome: number;
  predictedDraw: number;
  predictedAway: number;
};

function round(
  value: number,
  decimals = 6,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
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
  mlWeight: number,
): OutcomeProbabilities {
  const poissonWeight = 1 - mlWeight;

  return normalize({
    home:
      ml.home * mlWeight +
      poisson.home * poissonWeight,
    draw:
      ml.draw * mlWeight +
      poisson.draw * poissonWeight,
    away:
      ml.away * mlWeight +
      poisson.away * poissonWeight,
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

  throw new Error(`Bilinmeyen sonuc sinifi: ${String(outcome)}`);
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

function createConfusionMatrix(): ConfusionMatrix {
  return {
    HOME: { HOME: 0, DRAW: 0, AWAY: 0 },
    DRAW: { HOME: 0, DRAW: 0, AWAY: 0 },
    AWAY: { HOME: 0, DRAW: 0, AWAY: 0 },
  };
}

function calculateClasswiseEce(
  rows: PredictionRow[],
): number {
  let weightedError = 0;
  let observationCount = 0;

  for (const outcome of OUTCOMES) {
    for (let minimum = 0; minimum < 100; minimum += 10) {
      const maximum = minimum + 10;

      const observations = rows.filter((row) => {
        const probability = getProbability(
          row.probabilities,
          outcome,
        );

        return probability >= minimum &&
          (
            maximum === 100
              ? probability <= maximum
              : probability < maximum
          );
      });

      if (observations.length === 0) {
        continue;
      }

      const averageProbability =
        observations.reduce(
          (total, row) =>
            total + getProbability(row.probabilities, outcome),
          0,
        ) / observations.length / 100;

      const occurrenceRate =
        observations.filter(
          (row) => row.actualOutcome === outcome,
        ).length / observations.length;

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

function evaluate(
  rows: PredictionRow[],
): EvaluationResult {
  if (rows.length === 0) {
    throw new Error("Degerlendirme icin mac bulunamadi.");
  }

  let correct = 0;
  let brier = 0;
  let logLoss = 0;

  const actualCounts: Record<MatchOutcome, number> = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
  };

  const predictedCounts: Record<MatchOutcome, number> = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
  };

  const classBrierTotals: Record<MatchOutcome, number> = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
  };

  const probabilityTotals: Record<MatchOutcome, number> = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
  };

  const confusionMatrix = createConfusionMatrix();

  for (const row of rows) {
    const predicted = predictedOutcome(row.probabilities);

    actualCounts[row.actualOutcome] += 1;
    predictedCounts[predicted] += 1;
    confusionMatrix[row.actualOutcome][predicted] += 1;

    if (predicted === row.actualOutcome) {
      correct += 1;
    }

    for (const outcome of OUTCOMES) {
      const probability =
        getProbability(row.probabilities, outcome) / 100;
      const actual = row.actualOutcome === outcome ? 1 : 0;
      const error = (probability - actual) ** 2;

      classBrierTotals[outcome] += error;
      probabilityTotals[outcome] += probability;
      brier += error;
    }

    logLoss += -Math.log(
      Math.max(
        getProbability(
          row.probabilities,
          row.actualOutcome,
        ) / 100,
        MIN_PROBABILITY,
      ),
    );
  }

  const count = rows.length;

  const outcomeAudit = OUTCOMES.map((outcome) => {
    const truePositive = confusionMatrix[outcome][outcome];
    const predicted = predictedCounts[outcome];
    const actual = actualCounts[outcome];

    return {
      outcome,
      actual,
      predicted,
      truePositive,
      precision: round(
        predicted > 0 ? truePositive / predicted * 100 : 0,
        2,
      ),
      recall: round(
        actual > 0 ? truePositive / actual * 100 : 0,
        2,
      ),
      averageProbability: round(
        probabilityTotals[outcome] / count * 100,
        4,
      ),
      brier: round(classBrierTotals[outcome] / count),
    };
  });

  return {
    matches: count,
    accuracy: round(correct / count * 100, 2),
    brier: round(brier / count),
    logLoss: round(logLoss / count),
    ece: round(calculateClasswiseEce(rows)),
    actualHome: actualCounts.HOME,
    actualDraw: actualCounts.DRAW,
    actualAway: actualCounts.AWAY,
    predictedHome: predictedCounts.HOME,
    predictedDraw: predictedCounts.DRAW,
    predictedAway: predictedCounts.AWAY,
    homeBrier: round(classBrierTotals.HOME / count),
    drawBrier: round(classBrierTotals.DRAW / count),
    awayBrier: round(classBrierTotals.AWAY / count),
    confusionMatrix,
    outcomeAudit,
  };
}

function buildRows(
  rows: ComponentPredictionRow[],
  mlWeight: number,
): PredictionRow[] {
  return rows.map((row) => ({
    matchId: row.matchId,
    actualOutcome: row.actualOutcome,
    probabilities: blend(
      row.ml,
      row.poisson,
      mlWeight,
    ),
  }));
}

function configurationName(
  mlWeight: number,
): string {
  const ml = Math.round(mlWeight * 100);
  const poisson = 100 - ml;

  if (mlWeight === 0) {
    return "PURE POISSON";
  }

  if (mlWeight === 1) {
    return "PURE ML";
  }

  if (mlWeight === CURRENT_ML_WEIGHT) {
    return `ML ${ml}% / POISSON ${poisson}% (CURRENT)`;
  }

  return `ML ${ml}% / POISSON ${poisson}%`;
}

function weightAudit(
  rows: ComponentPredictionRow[],
): WeightAuditRow[] {
  return ML_WEIGHTS.map((mlWeight) => {
    const result = evaluate(buildRows(rows, mlWeight));

    return {
      configuration: configurationName(mlWeight),
      mlWeight: Math.round(mlWeight * 100),
      poissonWeight: Math.round((1 - mlWeight) * 100),
      matches: result.matches,
      accuracy: result.accuracy,
      brier: result.brier,
      logLoss: result.logLoss,
      ece: result.ece,
      predictedHome: result.predictedHome,
      predictedDraw: result.predictedDraw,
      predictedAway: result.predictedAway,
    };
  }).sort((left, right) => {
    const brierDifference = left.brier - right.brier;

    if (Math.abs(brierDifference) > 1e-9) {
      return brierDifference;
    }

    const logLossDifference = left.logLoss - right.logLoss;

    if (Math.abs(logLossDifference) > 1e-9) {
      return logLossDifference;
    }

    return Math.abs(left.mlWeight - 20) -
      Math.abs(right.mlWeight - 20);
  });
}

function comparisonTable(
  current: EvaluationResult,
  selected: EvaluationResult,
) {
  return [
    {
      metric: "Accuracy (%)",
      better: "HIGHER",
      current: current.accuracy,
      selected: selected.accuracy,
      change: round(selected.accuracy - current.accuracy, 4),
    },
    {
      metric: "Brier Score",
      better: "LOWER",
      current: current.brier,
      selected: selected.brier,
      change: round(selected.brier - current.brier),
    },
    {
      metric: "Home Brier",
      better: "LOWER",
      current: current.homeBrier,
      selected: selected.homeBrier,
      change: round(selected.homeBrier - current.homeBrier),
    },
    {
      metric: "Draw Brier",
      better: "LOWER",
      current: current.drawBrier,
      selected: selected.drawBrier,
      change: round(selected.drawBrier - current.drawBrier),
    },
    {
      metric: "Away Brier",
      better: "LOWER",
      current: current.awayBrier,
      selected: selected.awayBrier,
      change: round(selected.awayBrier - current.awayBrier),
    },
    {
      metric: "Log Loss",
      better: "LOWER",
      current: current.logLoss,
      selected: selected.logLoss,
      change: round(selected.logLoss - current.logLoss),
    },
    {
      metric: "ECE",
      better: "LOWER",
      current: current.ece,
      selected: selected.ece,
      change: round(selected.ece - current.ece),
    },
    {
      metric: "Predicted HOME",
      better: "INFO",
      current: current.predictedHome,
      selected: selected.predictedHome,
      change: selected.predictedHome - current.predictedHome,
    },
    {
      metric: "Predicted DRAW",
      better: "INFO",
      current: current.predictedDraw,
      selected: selected.predictedDraw,
      change: selected.predictedDraw - current.predictedDraw,
    },
    {
      metric: "Predicted AWAY",
      better: "INFO",
      current: current.predictedAway,
      selected: selected.predictedAway,
      change: selected.predictedAway - current.predictedAway,
    },
  ];
}

function confusionTable(
  result: EvaluationResult,
) {
  return OUTCOMES.map((actual) => ({
    actual,
    predictedHOME: result.confusionMatrix[actual].HOME,
    predictedDRAW: result.confusionMatrix[actual].DRAW,
    predictedAWAY: result.confusionMatrix[actual].AWAY,
    total:
      result.confusionMatrix[actual].HOME +
      result.confusionMatrix[actual].DRAW +
      result.confusionMatrix[actual].AWAY,
  }));
}

function distributionTable(
  label: string,
  result: EvaluationResult,
) {
  return [
    {
      model: label,
      actualHOME: result.actualHome,
      actualDRAW: result.actualDraw,
      actualAWAY: result.actualAway,
      predictedHOME: result.predictedHome,
      predictedDRAW: result.predictedDraw,
      predictedAWAY: result.predictedAway,
    },
  ];
}

type TrainingMatrix = ReturnType<typeof buildTrainingMatrix>;

function formatDate(value: Date): string {
  const timestamp = value.getTime();

  if (!Number.isFinite(timestamp)) {
    return "INVALID DATE";
  }

  return value.toISOString();
}

function toChronologicalMatrix(
  matrix: TrainingMatrix,
): TrainingMatrix {
  const order = matrix.metadata
    .map((metadata, index) => ({
      index,
      timestamp: metadata.kickoffAt.getTime(),
    }))
    .sort(
      (left, right) =>
        left.timestamp - right.timestamp ||
        left.index - right.index,
    )
    .map((item) => item.index);

  const invalidDateCount = matrix.metadata.filter(
    (metadata) =>
      !Number.isFinite(metadata.kickoffAt.getTime()),
  ).length;

  if (invalidDateCount > 0) {
    throw new Error(
      `Training matrix ${invalidDateCount} gecersiz kickoffAt tarihi iceriyor.`,
    );
  }

  const chronologicalMatrix = {
    ...matrix,
    X: order.map((index) => matrix.X[index]),
    yOneHot: order.map((index) => matrix.yOneHot[index]),
    y: order.map((index) => matrix.y[index]),
    metadata: order.map((index) => matrix.metadata[index]),
  };

  for (
    let index = 1;
    index < chronologicalMatrix.metadata.length;
    index += 1
  ) {
    const previous =
      chronologicalMatrix.metadata[index - 1].kickoffAt;
    const current =
      chronologicalMatrix.metadata[index].kickoffAt;

    if (previous.getTime() > current.getTime()) {
      throw new Error(
        "Kronolojik siralama dogrulanamadi: " +
        `${formatDate(previous)} > ${formatDate(current)}`,
      );
    }
  }

  return chronologicalMatrix;
}

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("ENSEMBLE WEIGHT & 1X2 BIAS AUDIT");
  console.log("==============================================");

  console.table({
    Season: SEASON_YEAR,
    "Base model train": `${round(TRAIN_RATIO * 100, 2)}%`,
    "Weight selection": `${round(SELECTION_RATIO * 100, 2)}%`,
    "Final unseen test":
      `${round((1 - TRAIN_RATIO - SELECTION_RATIO) * 100, 2)}%`,
    "Current ML / Poisson":
      `${CURRENT_ML_WEIGHT * 100}% / ${(1 - CURRENT_ML_WEIGHT) * 100}%`,
    "Weights under test": "0% to 100% ML, steps of 10%",
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

  const matrix = toChronologicalMatrix(
    buildTrainingMatrix(
      allRows,
      {
        includeSideFeatures: false,
        includeDifferenceFeatures: true,
        missingValueStrategy: "COLUMN_MEAN",
        maximumMissingRatio: 0.5,
      },
    ),
  );

  const total = matrix.rowCount;
  const trainEnd = Math.floor(total * TRAIN_RATIO);
  const selectionEnd = Math.floor(
    total * (TRAIN_RATIO + SELECTION_RATIO),
  );

  if (
    trainEnd <= 0 ||
    selectionEnd <= trainEnd ||
    selectionEnd >= total
  ) {
    throw new Error(
      "Dataset ensemble weight audit bolumleri icin yetersiz.",
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
  const futureRows: ComponentPredictionRow[] = [];

  console.log("");
  console.log(
    `Component predictions: ${mlResult.validationPredictions.length}`,
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
      ml: normalize({
        home: ml.homeProbability,
        draw: ml.drawProbability,
        away: ml.awayProbability,
      }),
      poisson: normalize(poisson.outcomeProbabilities),
    });

    if ((index + 1) % 100 === 0) {
      console.log(
        `ANALYSIS ${index + 1}/${mlResult.validationPredictions.length}`,
      );
    }
  }

  const selectionCount = selectionEnd - trainEnd;
  const selectionRows = futureRows.slice(0, selectionCount);
  const finalTestRows = futureRows.slice(selectionCount);

  console.log("");
  console.log("==============================================");
  console.log("DATASET SUMMARY");
  console.log("==============================================");

  console.table({
    Total: total,
    TRAIN: trainEnd,
    SELECTION: selectionRows.length,
    "FINAL TEST": finalTestRows.length,
    "First match": formatDate(matrix.metadata[0].kickoffAt),
    "Last match": formatDate(matrix.metadata[total - 1].kickoffAt),
    "Invalid dates": 0,
    "Chronological order": "PASS",
  });

  console.log("");
  console.log("==============================================");
  console.log("CHRONOLOGICAL PARTITION BOUNDARIES");
  console.log("==============================================");

  console.table([
    {
      partition: "TRAIN",
      matches: trainEnd,
      firstMatch: formatDate(matrix.metadata[0].kickoffAt),
      lastMatch: formatDate(
        matrix.metadata[trainEnd - 1].kickoffAt,
      ),
    },
    {
      partition: "SELECTION",
      matches: selectionRows.length,
      firstMatch: formatDate(
        matrix.metadata[trainEnd].kickoffAt,
      ),
      lastMatch: formatDate(
        matrix.metadata[selectionEnd - 1].kickoffAt,
      ),
    },
    {
      partition: "FINAL TEST",
      matches: finalTestRows.length,
      firstMatch: formatDate(
        matrix.metadata[selectionEnd].kickoffAt,
      ),
      lastMatch: formatDate(
        matrix.metadata[total - 1].kickoffAt,
      ),
    },
  ]);

  const selectionAudit = weightAudit(selectionRows);
  const selectedMlWeight = selectionAudit[0].mlWeight / 100;

  console.log("");
  console.log("==============================================");
  console.log("WEIGHT SELECTION - VALIDATION ONLY");
  console.log("==============================================");
  console.table(selectionAudit);

  console.log("");
  console.table({
    "Selected configuration":
      configurationName(selectedMlWeight),
    "Selected ML weight": `${selectedMlWeight * 100}%`,
    "Selected Poisson weight":
      `${(1 - selectedMlWeight) * 100}%`,
    "Selection Brier": selectionAudit[0].brier,
    "Selection Log Loss": selectionAudit[0].logLoss,
  });

  const purePoissonFinal = evaluate(
    buildRows(finalTestRows, 0),
  );
  const currentFinal = evaluate(
    buildRows(finalTestRows, CURRENT_ML_WEIGHT),
  );
  const selectedFinal = evaluate(
    buildRows(finalTestRows, selectedMlWeight),
  );
  const pureMlFinal = evaluate(
    buildRows(finalTestRows, 1),
  );

  console.log("");
  console.log("==============================================");
  console.log("FINAL UNSEEN TEST - COMPONENT SUMMARY");
  console.log("==============================================");

  console.table([
    {
      model: "PURE POISSON",
      accuracy: purePoissonFinal.accuracy,
      brier: purePoissonFinal.brier,
      logLoss: purePoissonFinal.logLoss,
      ece: purePoissonFinal.ece,
      predictedHome: purePoissonFinal.predictedHome,
      predictedDraw: purePoissonFinal.predictedDraw,
      predictedAway: purePoissonFinal.predictedAway,
    },
    {
      model: "CURRENT 20% ML / 80% POISSON",
      accuracy: currentFinal.accuracy,
      brier: currentFinal.brier,
      logLoss: currentFinal.logLoss,
      ece: currentFinal.ece,
      predictedHome: currentFinal.predictedHome,
      predictedDraw: currentFinal.predictedDraw,
      predictedAway: currentFinal.predictedAway,
    },
    {
      model: `SELECTED ${selectedMlWeight * 100}% ML / ${(1 - selectedMlWeight) * 100}% POISSON`,
      accuracy: selectedFinal.accuracy,
      brier: selectedFinal.brier,
      logLoss: selectedFinal.logLoss,
      ece: selectedFinal.ece,
      predictedHome: selectedFinal.predictedHome,
      predictedDraw: selectedFinal.predictedDraw,
      predictedAway: selectedFinal.predictedAway,
    },
    {
      model: "PURE ML",
      accuracy: pureMlFinal.accuracy,
      brier: pureMlFinal.brier,
      logLoss: pureMlFinal.logLoss,
      ece: pureMlFinal.ece,
      predictedHome: pureMlFinal.predictedHome,
      predictedDraw: pureMlFinal.predictedDraw,
      predictedAway: pureMlFinal.predictedAway,
    },
  ]);

  console.log("");
  console.log("==============================================");
  console.log("CURRENT VS SELECTED - FINAL UNSEEN TEST");
  console.log("==============================================");
  console.table(comparisonTable(currentFinal, selectedFinal));

  const detailedModels = [
    {
      label: "PURE POISSON",
      result: purePoissonFinal,
    },
    {
      label: "CURRENT 20/80",
      result: currentFinal,
    },
    {
      label: `SELECTED ${selectedMlWeight * 100}/${(1 - selectedMlWeight) * 100}`,
      result: selectedFinal,
    },
    {
      label: "PURE ML",
      result: pureMlFinal,
    },
  ];

  console.log("");
  console.log("==============================================");
  console.log("ACTUAL / PREDICTED 1X2 DISTRIBUTION");
  console.log("==============================================");
  console.table(
    detailedModels.flatMap((item) =>
      distributionTable(item.label, item.result),
    ),
  );

  for (const item of detailedModels) {
    console.log("");
    console.log("==============================================");
    console.log(`${item.label} - CONFUSION MATRIX`);
    console.log("Rows = actual, columns = predicted");
    console.log("==============================================");
    console.table(confusionTable(item.result));

    console.log("");
    console.log(`${item.label} - OUTCOME AUDIT`);
    console.table(item.result.outcomeAudit);
  }

  const differentWeight =
    selectedMlWeight !== CURRENT_ML_WEIGHT;
  const brierImproved =
    selectedFinal.brier < currentFinal.brier;
  const logLossImproved =
    selectedFinal.logLoss < currentFinal.logLoss;
  const eceImproved =
    selectedFinal.ece < currentFinal.ece;
  const accuracyAcceptable =
    selectedFinal.accuracy >= currentFinal.accuracy - 0.5;

  const pass =
    differentWeight &&
    brierImproved &&
    logLossImproved &&
    eceImproved &&
    accuracyAcceptable;

  const sameWeight =
    selectedMlWeight === CURRENT_ML_WEIGHT;

  console.log("");
  console.log("==============================================");
  console.log("MODEL DECISION");
  console.log("==============================================");

  console.table({
    "Different weight selected": differentWeight ? "YES" : "NO",
    "Brier improved": brierImproved ? "YES" : "NO",
    "Log Loss improved": logLossImproved ? "YES" : "NO",
    "ECE improved": eceImproved ? "YES" : "NO",
    "Accuracy acceptable": accuracyAcceptable ? "YES" : "NO",
    Decision: sameWeight
      ? "KEEP CURRENT 20/80 - VALIDATION SELECTED SAME WEIGHT"
      : pass
        ? "PASS - CANDIDATE FOR OUT-OF-TIME TEST"
        : "REJECT NEW WEIGHT - KEEP CURRENT 20/80",
  });

  console.log("");
  console.log(
    "Not: PASS dogrudan production onayi degildir. " +
    "Yeni sezon/out-of-time dogrulamasi gerekir.",
  );

  console.log("");
  console.log("==============================================");
  console.log("ENSEMBLE WEIGHT & 1X2 BIAS AUDIT COMPLETED");
  console.log("==============================================");
}

main().catch((error: unknown) => {
  console.error("");
  console.error("Ensemble weight & 1X2 bias audit failed.");
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
