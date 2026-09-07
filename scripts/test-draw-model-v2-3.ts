import "dotenv/config";

import { ACTIVE_COMPETITIONS } from "@/config/competitions";
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

const SEASON_YEAR = 2024;

/*
 * V2.2 coverage auditinde bu feature'larin tamami en az %89.89 kapsama sahipti.
 * %21-%23 kapsamadaki last_10, draw_rate, btts_rate, over_2_5_rate,
 * clean_sheet_rate, win/loss_rate ve fixture_congestion feature'lari bu testten
 * bilerek cikarildi.
 */
const SAFE_FEATURE_KEYS = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
  "rest_days",
] as const;

const DERIVED_DRAW_FEATURE_NAMES = [
  "strength_gap_last5",
  "goal_difference_gap",
  "attack_gap",
  "defence_gap",
  "goal_environment",
  "venue_strength_gap_last5",
] as const;

type ExperimentConfig = {
  name: string;
  classWeights: SimpleLearningClassWeights;
  useDrawDerivedFeatures: boolean;
};

type ExperimentRow = {
  experiment: string;
  featureCount: number;
  drawWeight: number;
  trainingRows: number;
  validationRows: number;
  trainAccuracy: number;
  validationAccuracy: number;
  brier: number;
  logLoss: number;
  actualHome: number;
  predictedHome: number;
  actualDraw: number;
  predictedDraw: number;
  actualAway: number;
  predictedAway: number;
  drawCorrect: number;
  drawRecall: number;
  drawPrecision: number;
  homeRecall: number;
  awayRecall: number;
  balancedScore: number;
  gate: "BASELINE" | "PASS" | "REJECT";
};

const EXPERIMENTS: ExperimentConfig[] = [
  {
    name: "BASELINE_SAFE",
    classWeights: { HOME: 1, DRAW: 1, AWAY: 1 },
    useDrawDerivedFeatures: false,
  },
  {
    name: "DRAW_SAFE_W1_00",
    classWeights: { HOME: 1, DRAW: 1, AWAY: 1 },
    useDrawDerivedFeatures: true,
  },
  {
    name: "DRAW_SAFE_W1_05",
    classWeights: { HOME: 1, DRAW: 1.05, AWAY: 1 },
    useDrawDerivedFeatures: true,
  },
  {
    name: "DRAW_SAFE_W1_10",
    classWeights: { HOME: 1, DRAW: 1.1, AWAY: 1 },
    useDrawDerivedFeatures: true,
  },
  {
    name: "DRAW_SAFE_W1_15",
    classWeights: { HOME: 1, DRAW: 1.15, AWAY: 1 },
    useDrawDerivedFeatures: true,
  },
];

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isNumericValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function calculateOutcomeDistribution(values: MatchOutcome[]): {
  home: number;
  draw: number;
  away: number;
} {
  return {
    home: values.filter((value) => value === "HOME").length,
    draw: values.filter((value) => value === "DRAW").length,
    away: values.filter((value) => value === "AWAY").length,
  };
}

function collectMatrixFeatureNames(rows: TrainingMatchRow[]): string[] {
  const names = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row.features)) {
      if (
        key.startsWith("home_") ||
        key.startsWith("away_") ||
        key.startsWith("diff_")
      ) {
        names.add(key);
      }
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function calculateFeatureCoverage(rows: TrainingMatchRow[]): Array<
  Record<string, unknown>
> {
  const featureNames = collectMatrixFeatureNames(rows);

  return featureNames.map((featureName) => {
    const available = rows.filter((row) =>
      isNumericValue(row.features[featureName]),
    ).length;
    const missing = rows.length - available;
    const coverage = rows.length > 0 ? (available / rows.length) * 100 : 0;

    return {
      feature: featureName,
      available,
      missing,
      coverage: round(coverage, 2),
      status:
        coverage >= 90
          ? "EXCELLENT"
          : coverage >= 75
            ? "GOOD"
            : coverage >= 50
              ? "WEAK"
              : "CRITICAL",
    };
  });
}

function findFeatureIndex(
  matrix: TrainingMatrix,
  featureName: string,
): number | null {
  const index = matrix.featureNames.indexOf(featureName);
  return index >= 0 ? index : null;
}

function readValue(row: number[], index: number | null): number {
  if (index === null) {
    return 0;
  }

  const value = row[index];
  return Number.isFinite(value) ? value : 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function addSafeDrawDerivedFeatures(matrix: TrainingMatrix): TrainingMatrix {
  const indexes = {
    homeLast5: findFeatureIndex(matrix, "home_last_5_points_per_game"),
    awayLast5: findFeatureIndex(matrix, "away_last_5_points_per_game"),
    homeGoalsScored: findFeatureIndex(
      matrix,
      "home_goals_scored_per_game",
    ),
    awayGoalsScored: findFeatureIndex(
      matrix,
      "away_goals_scored_per_game",
    ),
    homeGoalsConceded: findFeatureIndex(
      matrix,
      "home_goals_conceded_per_game",
    ),
    awayGoalsConceded: findFeatureIndex(
      matrix,
      "away_goals_conceded_per_game",
    ),
    homeVenueLast5: findFeatureIndex(
      matrix,
      "home_venue_last_5_points_per_game",
    ),
    awayVenueLast5: findFeatureIndex(
      matrix,
      "away_venue_last_5_points_per_game",
    ),
  };

  const derivedRows = matrix.X.map((row) => {
    const homeLast5 = readValue(row, indexes.homeLast5);
    const awayLast5 = readValue(row, indexes.awayLast5);
    const homeGoalsScored = readValue(row, indexes.homeGoalsScored);
    const awayGoalsScored = readValue(row, indexes.awayGoalsScored);
    const homeGoalsConceded = readValue(row, indexes.homeGoalsConceded);
    const awayGoalsConceded = readValue(row, indexes.awayGoalsConceded);
    const homeVenueLast5 = readValue(row, indexes.homeVenueLast5);
    const awayVenueLast5 = readValue(row, indexes.awayVenueLast5);

    const homeGoalDifference = homeGoalsScored - homeGoalsConceded;
    const awayGoalDifference = awayGoalsScored - awayGoalsConceded;

    return [
      Math.abs(homeLast5 - awayLast5),
      Math.abs(homeGoalDifference - awayGoalDifference),
      Math.abs(homeGoalsScored - awayGoalsScored),
      Math.abs(homeGoalsConceded - awayGoalsConceded),
      (homeGoalsScored +
        homeGoalsConceded +
        awayGoalsScored +
        awayGoalsConceded) /
        2,
      Math.abs(homeVenueLast5 - awayVenueLast5),
    ];
  });

  const columnMeans = { ...matrix.columnMeans };

  for (
    let featureIndex = 0;
    featureIndex < DERIVED_DRAW_FEATURE_NAMES.length;
    featureIndex += 1
  ) {
    columnMeans[DERIVED_DRAW_FEATURE_NAMES[featureIndex]] = average(
      derivedRows.map((row) => row[featureIndex]),
    );
  }

  return {
    ...matrix,
    featureNames: [...matrix.featureNames, ...DERIVED_DRAW_FEATURE_NAMES],
    X: matrix.X.map((row, rowIndex) => [...row, ...derivedRows[rowIndex]]),
    columnCount: matrix.columnCount + DERIVED_DRAW_FEATURE_NAMES.length,
    columnMeans,
    warnings: [
      ...matrix.warnings,
      `${DERIVED_DRAW_FEATURE_NAMES.length} coverage-safe DRAW derived feature eklendi.`,
    ],
  };
}

function calculateBalancedScore(options: {
  accuracy: number;
  drawRecall: number;
  drawPrecision: number;
  homeRecall: number;
  awayRecall: number;
  brier: number;
  logLoss: number;
}): number {
  return round(
    options.accuracy * 0.45 +
      options.drawRecall * 0.15 +
      options.drawPrecision * 0.15 +
      options.homeRecall * 0.075 +
      options.awayRecall * 0.075 -
      options.brier * 5 -
      options.logLoss * 3,
    4,
  );
}

function passesQualityGate(
  candidate: ExperimentRow,
  baseline: ExperimentRow,
): boolean {
  return (
    candidate.validationAccuracy >= baseline.validationAccuracy &&
    candidate.brier <= baseline.brier &&
    candidate.logLoss <= baseline.logLoss &&
    candidate.drawRecall > baseline.drawRecall
  );
}

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("DRAW MODEL V2.3 - COVERAGE SAFE + ZERO MISSING");
  console.log("==============================================");
  console.table({
    Sezon: SEASON_YEAR,
    Organizasyon: ACTIVE_COMPETITIONS.length,
    "Requested feature": SAFE_FEATURE_KEYS.length,
    "Derived feature": DERIVED_DRAW_FEATURE_NAMES.length,
    Deney: EXPERIMENTS.length,
    "Missing strategy": "ZERO",
    "Chronological split": "70% / 30%",
  });

  const allRows: TrainingMatchRow[] = [];
  const collectionRows: Array<Record<string, unknown>> = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    console.log(`\nCollecting ${competition.name}...`);

    const result = await collectTrainingData({
      leagueApiId: competition.apiId,
      seasonYear: SEASON_YEAR,
      featureKeys: [...SAFE_FEATURE_KEYS],
      minimumDataQualityScore: 0,
      strictPreMatchOnly: true,
    });

    allRows.push(...result.rows);
    collectionRows.push({
      apiId: competition.apiId,
      competition: competition.name,
      finished: result.totalFinishedMatches,
      collected: result.collectedMatchCount,
      skipped: result.skippedMatchCount,
    });
  }

  console.log("\n==============================================");
  console.log("DATA COLLECTION");
  console.log("==============================================");
  console.table(collectionRows);
  console.table({ "Toplam training row": allRows.length });

  const coverageRows = calculateFeatureCoverage(allRows);
  console.log("\n==============================================");
  console.log("SAFE FEATURE COVERAGE - WORST FIRST");
  console.log("==============================================");
  console.table(
    [...coverageRows].sort(
      (first, second) => Number(first.coverage) - Number(second.coverage),
    ),
  );

  /*
   * ZERO stratejisi validation sezonu/bolumu ortalamalarinin training'e
   * sizmasini engeller. V2.2'deki COLUMN_MEAN bu nedenle kullanilmiyor.
   */
  const baseMatrix = buildTrainingMatrix(allRows, {
    includeSideFeatures: true,
    includeDifferenceFeatures: true,
    missingValueStrategy: "ZERO",
    maximumMissingRatio: 0.5,
  });
  const drawMatrix = addSafeDrawDerivedFeatures(baseMatrix);

  console.log("\n==============================================");
  console.log("MODEL MATRIX");
  console.log("==============================================");
  console.table({
    "Collected rows": allRows.length,
    "Matrix rows": baseMatrix.rowCount,
    "Skipped rows": baseMatrix.skippedRowCount,
    "Retained %": round((baseMatrix.rowCount / allRows.length) * 100, 2),
    "Base columns": baseMatrix.columnCount,
    "DRAW columns": drawMatrix.columnCount,
    "Derived features": DERIVED_DRAW_FEATURE_NAMES.length,
    "Zero-filled values": baseMatrix.imputedValueCount,
  });

  console.log("\n==============================================");
  console.log("DRAW DERIVED FEATURES");
  console.log("==============================================");
  console.table(
    DERIVED_DRAW_FEATURE_NAMES.map((featureName) => ({
      feature: featureName,
      mean: round(drawMatrix.columnMeans[featureName] ?? 0, 4),
    })),
  );

  const experimentRows: ExperimentRow[] = [];

  for (const [experimentIndex, experiment] of EXPERIMENTS.entries()) {
    console.log("\n==============================================");
    console.log(`[${experimentIndex + 1}/${EXPERIMENTS.length}] ${experiment.name}`);
    console.log("==============================================");

    const matrix = experiment.useDrawDerivedFeatures ? drawMatrix : baseMatrix;
    const split = splitTrainingValidationChronologically(matrix, {
      trainingPercentage: 70,
      minimumTrainingRows: 300,
      minimumValidationRows: 100,
    });
    const result = trainSimpleLearningModel(split, {
      featureNames: [...matrix.featureNames],
      learningRate: 0.01,
      maximumEpochs: 1500,
      l2Regularization: 0.05,
      convergenceTolerance: 0.0000001,
      classWeights: experiment.classWeights,
    });

    const homePerformance = result.validationMetrics.outcomePerformance.find(
      (performance) => performance.outcome === "HOME",
    );
    const drawPerformance = result.validationMetrics.outcomePerformance.find(
      (performance) => performance.outcome === "DRAW",
    );
    const awayPerformance = result.validationMetrics.outcomePerformance.find(
      (performance) => performance.outcome === "AWAY",
    );
    const actualDistribution = calculateOutcomeDistribution(
      result.validationPredictions.map((prediction) => prediction.actualOutcome),
    );
    const predictedDistribution = calculateOutcomeDistribution(
      result.validationPredictions.map(
        (prediction) => prediction.predictedOutcome,
      ),
    );

    const accuracy = result.validationMetrics.accuracyPercentage;
    const drawRecall = drawPerformance?.recallPercentage ?? 0;
    const drawPrecision = drawPerformance?.precisionPercentage ?? 0;
    const homeRecall = homePerformance?.recallPercentage ?? 0;
    const awayRecall = awayPerformance?.recallPercentage ?? 0;
    const balancedScore = calculateBalancedScore({
      accuracy,
      drawRecall,
      drawPrecision,
      homeRecall,
      awayRecall,
      brier: result.validationMetrics.brierScore,
      logLoss: result.validationMetrics.logLoss,
    });

    const row: ExperimentRow = {
      experiment: experiment.name,
      featureCount: matrix.columnCount,
      drawWeight: experiment.classWeights.DRAW,
      trainingRows: split.training.rowCount,
      validationRows: split.validation.rowCount,
      trainAccuracy: result.trainingMetrics.accuracyPercentage,
      validationAccuracy: accuracy,
      brier: result.validationMetrics.brierScore,
      logLoss: result.validationMetrics.logLoss,
      actualHome: actualDistribution.home,
      predictedHome: predictedDistribution.home,
      actualDraw: actualDistribution.draw,
      predictedDraw: predictedDistribution.draw,
      actualAway: actualDistribution.away,
      predictedAway: predictedDistribution.away,
      drawCorrect: drawPerformance?.correctCount ?? 0,
      drawRecall,
      drawPrecision,
      homeRecall,
      awayRecall,
      balancedScore,
      gate: experimentIndex === 0 ? "BASELINE" : "REJECT",
    };

    experimentRows.push(row);
    console.table({
      "Training rows": row.trainingRows,
      "Validation rows": row.validationRows,
      "Validation accuracy": row.validationAccuracy,
      Brier: row.brier,
      "Log Loss": row.logLoss,
      "DRAW actual": row.actualDraw,
      "DRAW predicted": row.predictedDraw,
      "DRAW correct": row.drawCorrect,
      "DRAW recall": row.drawRecall,
      "DRAW precision": row.drawPrecision,
      "HOME recall": row.homeRecall,
      "AWAY recall": row.awayRecall,
      "Balanced score": row.balancedScore,
    });
  }

  const baseline = experimentRows[0];
  for (let index = 1; index < experimentRows.length; index += 1) {
    experimentRows[index].gate = passesQualityGate(
      experimentRows[index],
      baseline,
    )
      ? "PASS"
      : "REJECT";
  }

  console.log("\n==============================================");
  console.log("EXPERIMENT COMPARISON");
  console.log("==============================================");
  console.table(experimentRows);

  const passed = experimentRows
    .filter((row) => row.gate === "PASS")
    .sort((first, second) => second.balancedScore - first.balancedScore);

  console.log("\n==============================================");
  console.log("QUALITY GATE");
  console.log("==============================================");
  console.table(
    experimentRows.map((row) => ({
      experiment: row.experiment,
      gate: row.gate,
      accuracy: row.validationAccuracy,
      drawRecall: row.drawRecall,
      drawPrecision: row.drawPrecision,
      brier: row.brier,
      logLoss: row.logLoss,
      score: row.balancedScore,
    })),
  );

  console.log("");
  if (passed.length === 0) {
    console.log(
      "DECISION: REJECT - Sinif agirligi / derived-feature yolu production'a alinmayacak.",
    );
    console.log(
      "NEXT: Production %20 ML / %80 Poisson uzerinde validation-only DRAW override testi.",
    );
  } else {
    console.log(`DECISION: VALIDATION PASS - ${passed[0].experiment}`);
    console.log(
      "Bu sonuc production onayi degildir; 2025/2026 Out-of-Time dogrulamasi gerekir.",
    );
  }

  console.log("\nDRAW MODEL V2.3 TESTI TAMAMLANDI.");
}

main().catch((error: unknown) => {
  console.error("\nDRAW Model V2.3 testi basarisiz.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
