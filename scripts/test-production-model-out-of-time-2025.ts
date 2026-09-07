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

const TRAIN_SEASON_YEAR = 2024;
const TEST_SEASON_YEAR = 2025;
const CURRENT_ML_WEIGHT = 0.2;
const MIN_PROBABILITY = 1e-15;
const MINIMUM_TEST_MATCHES = 100;
const MAXIMUM_ACCEPTABLE_ECE = 0.08;

const CORE_FEATURES = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

const OUTCOMES: MatchOutcome[] = ["HOME", "DRAW", "AWAY"];

type TrainingMatrix = ReturnType<typeof buildTrainingMatrix>;
type TrainingRows = Awaited<
  ReturnType<typeof collectTrainingData>
>["rows"];

type ComponentPredictionRow = {
  matchId: number;
  leagueName: string;
  kickoffAt: Date;
  actualOutcome: MatchOutcome;
  ml: OutcomeProbabilities;
  poisson: OutcomeProbabilities;
};

type PredictionRow = {
  matchId: number;
  leagueName: string;
  kickoffAt: Date;
  actualOutcome: MatchOutcome;
  probabilities: OutcomeProbabilities;
};

type Metrics = {
  matches: number;
  accuracy: number;
  brier: number;
  homeBrier: number;
  drawBrier: number;
  awayBrier: number;
  logLoss: number;
  ece: number;
  actualHome: number;
  actualDraw: number;
  actualAway: number;
  predictedHome: number;
  predictedDraw: number;
  predictedAway: number;
};

type CompetitionCollectionResult = {
  leagueApiId: number;
  trainingRows: number;
  testRows: number;
  trainingStatus: string;
  testStatus: string;
};

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatDate(value: Date): string {
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) ? value.toISOString() : "INVALID DATE";
}

function getNumericField(value: unknown, field: string): number {
  if (
    typeof value === "object" &&
    value !== null &&
    field in value
  ) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  throw new Error(`${field} alani bulunamadi veya sayisal degil.`);
}

function getStringField(
  value: unknown,
  field: string,
  fallback: string,
): string {
  if (
    typeof value === "object" &&
    value !== null &&
    field in value
  ) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return fallback;
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

function classIndexToOutcome(classIndex: number): MatchOutcome {
  const outcome = OUTCOMES[classIndex];

  if (!outcome) {
    throw new Error(
      `Gecersiz sonuc sinifi: ${classIndex}. Beklenen deger 0, 1 veya 2.`,
    );
  }

  return outcome;
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

function evaluate(rows: PredictionRow[]): Metrics {
  if (rows.length === 0) {
    throw new Error("Degerlendirme icin mac bulunamadi.");
  }

  let correct = 0;
  let brier = 0;
  let logLoss = 0;

  const classBrier: Record<MatchOutcome, number> = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
  };

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

  for (const row of rows) {
    const predicted = predictedOutcome(row.probabilities);
    predictedCounts[predicted] += 1;
    actualCounts[row.actualOutcome] += 1;

    if (predicted === row.actualOutcome) correct += 1;

    for (const outcome of OUTCOMES) {
      const probability = probabilityFor(row.probabilities, outcome) / 100;
      const actual = row.actualOutcome === outcome ? 1 : 0;
      const squaredError = (probability - actual) ** 2;

      brier += squaredError;
      classBrier[outcome] += squaredError;
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
    homeBrier: round(classBrier.HOME / rows.length),
    drawBrier: round(classBrier.DRAW / rows.length),
    awayBrier: round(classBrier.AWAY / rows.length),
    logLoss: round(logLoss / rows.length),
    ece: round(calculateClasswiseEce(rows)),
    actualHome: actualCounts.HOME,
    actualDraw: actualCounts.DRAW,
    actualAway: actualCounts.AWAY,
    predictedHome: predictedCounts.HOME,
    predictedDraw: predictedCounts.DRAW,
    predictedAway: predictedCounts.AWAY,
  };
}

function fixedPredictionRows(
  sourceRows: PredictionRow[],
  probabilities: OutcomeProbabilities,
): PredictionRow[] {
  const normalized = normalize(probabilities);

  return sourceRows.map((row) => ({
    ...row,
    probabilities: normalized,
  }));
}

function matrixActualPrior(
  matrix: TrainingMatrix,
  indices: number[],
): OutcomeProbabilities {
  const counts: Record<MatchOutcome, number> = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
  };

  for (const index of indices) {
    counts[classIndexToOutcome(matrix.y[index])] += 1;
  }

  return normalize({
    home: counts.HOME,
    draw: counts.DRAW,
    away: counts.AWAY,
  });
}

function chronologicalIndices(
  matrix: TrainingMatrix,
  indices: number[],
): number[] {
  return [...indices].sort((left, right) => {
    const timeDifference =
      matrix.metadata[left].kickoffAt.getTime() -
      matrix.metadata[right].kickoffAt.getTime();

    return timeDifference || left - right;
  });
}

function buildPartition(
  matrix: TrainingMatrix,
  indices: number[],
) {
  if (indices.length === 0) {
    throw new Error("Bos training/validation partition olusturulamaz.");
  }

  const sorted = chronologicalIndices(matrix, indices);

  return {
    featureNames: matrix.featureNames,
    X: sorted.map((index) => matrix.X[index]),
    y: sorted.map((index) => matrix.yOneHot[index]),
    yClass: sorted.map((index) => matrix.y[index]),
    metadata: sorted.map((index) => matrix.metadata[index]),
    rowCount: sorted.length,
    startedAt: matrix.metadata[sorted[0]].kickoffAt,
    endedAt: matrix.metadata[sorted[sorted.length - 1]].kickoffAt,
  };
}

function toPredictionRows(
  componentRows: ComponentPredictionRow[],
  source: "ML" | "POISSON" | "CURRENT",
): PredictionRow[] {
  return componentRows.map((row) => ({
    matchId: row.matchId,
    leagueName: row.leagueName,
    kickoffAt: row.kickoffAt,
    actualOutcome: row.actualOutcome,
    probabilities:
      source === "ML"
        ? row.ml
        : source === "POISSON"
        ? row.poisson
        : blend(row.ml, row.poisson, CURRENT_ML_WEIGHT),
  }));
}

function confusionMatrix(rows: PredictionRow[]) {
  const matrix: Record<MatchOutcome, Record<MatchOutcome, number>> = {
    HOME: { HOME: 0, DRAW: 0, AWAY: 0 },
    DRAW: { HOME: 0, DRAW: 0, AWAY: 0 },
    AWAY: { HOME: 0, DRAW: 0, AWAY: 0 },
  };

  for (const row of rows) {
    matrix[row.actualOutcome][predictedOutcome(row.probabilities)] += 1;
  }

  return OUTCOMES.map((actual) => ({
    actual,
    predictedHome: matrix[actual].HOME,
    predictedDraw: matrix[actual].DRAW,
    predictedAway: matrix[actual].AWAY,
    total: OUTCOMES.reduce(
      (sum, predicted) => sum + matrix[actual][predicted],
      0,
    ),
  }));
}

function confidenceBuckets(rows: PredictionRow[]) {
  const buckets = [
    { minimum: 0, maximum: 40 },
    { minimum: 40, maximum: 45 },
    { minimum: 45, maximum: 50 },
    { minimum: 50, maximum: 55 },
    { minimum: 55, maximum: 60 },
    { minimum: 60, maximum: 65 },
    { minimum: 65, maximum: 70 },
    { minimum: 70, maximum: 75 },
    { minimum: 75, maximum: 80 },
    { minimum: 80, maximum: 101 },
  ];

  return buckets.map(({ minimum, maximum }) => {
    const observations = rows.filter((row) => {
      const maximumProbability = Math.max(
        row.probabilities.home,
        row.probabilities.draw,
        row.probabilities.away,
      );

      return maximumProbability >= minimum && maximumProbability < maximum;
    });

    const correct = observations.filter(
      (row) => predictedOutcome(row.probabilities) === row.actualOutcome,
    ).length;

    const averageConfidence = observations.length > 0
      ? observations.reduce(
        (sum, row) =>
          sum + Math.max(
            row.probabilities.home,
            row.probabilities.draw,
            row.probabilities.away,
          ),
        0,
      ) / observations.length
      : 0;

    return {
      probabilityRange:
        maximum === 101 ? "80-100%" : `${minimum}-${maximum}%`,
      matches: observations.length,
      correct,
      wrong: observations.length - correct,
      accuracy: observations.length > 0
        ? round(correct / observations.length * 100, 2)
        : 0,
      averageConfidence: round(averageConfidence, 2),
      calibrationGap: observations.length > 0
        ? round(correct / observations.length * 100 - averageConfidence, 2)
        : 0,
    };
  });
}

function leagueBreakdown(rows: PredictionRow[]) {
  const leagues = new Map<string, PredictionRow[]>();

  for (const row of rows) {
    const current = leagues.get(row.leagueName) ?? [];
    current.push(row);
    leagues.set(row.leagueName, current);
  }

  return [...leagues.entries()]
    .map(([leagueName, leagueRows]) => {
      const metrics = evaluate(leagueRows);
      return {
        league: leagueName,
        matches: metrics.matches,
        accuracy: metrics.accuracy,
        brier: metrics.brier,
        logLoss: metrics.logLoss,
        ece: metrics.ece,
        actualDraw: metrics.actualDraw,
        predictedDraw: metrics.predictedDraw,
      };
    })
    .sort((left, right) => right.matches - left.matches);
}

async function collectSeasonRows(
  seasonYear: number,
  competitionApiId: number,
): Promise<TrainingRows> {
  const result = await collectTrainingData({
    leagueApiId: competitionApiId,
    seasonYear,
    featureKeys: [...CORE_FEATURES],
    minimumDataQualityScore: 0,
    strictPreMatchOnly: true,
  });

  return result.rows;
}

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION MODEL - 2025/2026 OUT-OF-TIME TEST");
  console.log("==============================================");

  console.table({
    "Training season": TRAIN_SEASON_YEAR,
    "Untouched test season": `${TEST_SEASON_YEAR} (2025/2026)`,
    "Production model": "20% ML / 80% Poisson",
    "Weight selection on test": "DISABLED",
    "Calibration": "DISABLED",
    "Missing values": "ZERO (prevents test-season mean leakage)",
  });

  const trainingRows: TrainingRows = [];
  const testRows: TrainingRows = [];
  const collectionResults: CompetitionCollectionResult[] = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    let leagueTrainingRows: TrainingRows = [];
    let leagueTestRows: TrainingRows = [];
    let trainingStatus = "OK";
    let testStatus = "OK";

    try {
      leagueTrainingRows = await collectSeasonRows(
        TRAIN_SEASON_YEAR,
        competition.apiId,
      );
      trainingRows.push(...leagueTrainingRows);

      if (leagueTrainingRows.length === 0) {
        trainingStatus = "NO ELIGIBLE ROWS";
      }
    } catch (error: unknown) {
      trainingStatus = error instanceof Error
        ? `SKIPPED: ${error.message}`
        : "SKIPPED: UNKNOWN ERROR";
    }

    try {
      leagueTestRows = await collectSeasonRows(
        TEST_SEASON_YEAR,
        competition.apiId,
      );
      testRows.push(...leagueTestRows);

      if (leagueTestRows.length === 0) {
        testStatus = "NO ELIGIBLE ROWS";
      }
    } catch (error: unknown) {
      testStatus = error instanceof Error
        ? `SKIPPED: ${error.message}`
        : "SKIPPED: UNKNOWN ERROR";
    }

    collectionResults.push({
      leagueApiId: competition.apiId,
      trainingRows: leagueTrainingRows.length,
      testRows: leagueTestRows.length,
      trainingStatus,
      testStatus,
    });
  }

  console.log("");
  console.log("==============================================");
  console.log("DATA COLLECTION BY COMPETITION");
  console.log("==============================================");
  console.table(collectionResults);

  if (trainingRows.length === 0) {
    throw new Error("2024 egitim verisi bulunamadi.");
  }

  if (testRows.length === 0) {
    throw new Error(
      "seasonYear=2025 icin uygun out-of-time test satiri bulunamadi. " +
      "Once 2025 sezonu maclarinin ve pre-match feature snapshot'larinin " +
      "veritabaninda bulundugunu dogrulayin/olusturun.",
    );
  }

  const trainingMatchIds = new Set(
    trainingRows.map((row) => getNumericField(row, "matchId")),
  );
  const testMatchIds = new Set(
    testRows.map((row) => getNumericField(row, "matchId")),
  );

  const overlappingMatchIds = [...testMatchIds].filter(
    (matchId) => trainingMatchIds.has(matchId),
  );

  if (overlappingMatchIds.length > 0) {
    throw new Error(
      `${overlappingMatchIds.length} mac hem egitim hem test sezonunda bulundu.`,
    );
  }

  const matrix = buildTrainingMatrix(
    [...trainingRows, ...testRows],
    {
      includeSideFeatures: false,
      includeDifferenceFeatures: true,
      missingValueStrategy: "ZERO",
      maximumMissingRatio: 0.5,
    },
  );

  const trainingIndices: number[] = [];
  const testIndices: number[] = [];
  const unknownIndices: number[] = [];

  for (let index = 0; index < matrix.rowCount; index += 1) {
    const matchId = getNumericField(matrix.metadata[index], "matchId");

    if (trainingMatchIds.has(matchId)) {
      trainingIndices.push(index);
    } else if (testMatchIds.has(matchId)) {
      testIndices.push(index);
    } else {
      unknownIndices.push(index);
    }
  }

  if (unknownIndices.length > 0) {
    throw new Error(
      `${unknownIndices.length} matrix satiri sezona eslestirilemedi.`,
    );
  }

  const training = buildPartition(matrix, trainingIndices);
  const validation = buildPartition(matrix, testIndices);

  const temporalSeparation =
    training.endedAt.getTime() < validation.startedAt.getTime();

  if (!temporalSeparation) {
    throw new Error(
      "Out-of-time tarih ayrimi gecersiz: egitim ve test donemleri cakisti.",
    );
  }

  if (validation.rowCount < MINIMUM_TEST_MATCHES) {
    throw new Error(
      `Out-of-time test verisi yetersiz: ${validation.rowCount} mac. ` +
      `Minimum ${MINIMUM_TEST_MATCHES} mac gerekli.`,
    );
  }

  console.log("");
  console.log("==============================================");
  console.log("STRICT SEASON BOUNDARIES");
  console.log("==============================================");
  console.table([
    {
      partition: "TRAIN ONLY",
      seasonYear: TRAIN_SEASON_YEAR,
      matches: training.rowCount,
      firstMatch: formatDate(training.startedAt),
      lastMatch: formatDate(training.endedAt),
    },
    {
      partition: "UNTOUCHED TEST ONLY",
      seasonYear: TEST_SEASON_YEAR,
      matches: validation.rowCount,
      firstMatch: formatDate(validation.startedAt),
      lastMatch: formatDate(validation.endedAt),
    },
  ]);

  console.table({
    "Overlapping match IDs": overlappingMatchIds.length,
    "Unknown matrix rows": unknownIndices.length,
    "Temporal separation": temporalSeparation ? "PASS" : "FAIL",
    "Test sample gate": validation.rowCount >= MINIMUM_TEST_MATCHES
      ? "PASS"
      : "FAIL",
  });

  const split = {
    training,
    validation,
    trainingPercentage:
      training.rowCount / (training.rowCount + validation.rowCount) * 100,
    validationPercentage:
      validation.rowCount / (training.rowCount + validation.rowCount) * 100,
    splitIndex: training.rowCount,
    splitDate: validation.startedAt,
    totalRowCount: training.rowCount + validation.rowCount,
    warnings: [],
  };

  const mlResult = trainSimpleLearningModel(split);
  const metadataByMatchId = new Map(
    validation.metadata.map((metadata) => [
      getNumericField(metadata, "matchId"),
      metadata,
    ]),
  );

  const componentRows: ComponentPredictionRow[] = [];

  for (
    let index = 0;
    index < mlResult.validationPredictions.length;
    index += 1
  ) {
    const ml = mlResult.validationPredictions[index];
    const poisson = await calculateGoalProbabilities(ml.matchId);
    const metadata = metadataByMatchId.get(ml.matchId);

    if (!metadata) {
      throw new Error(
        `Validation metadata bulunamadi. matchId=${ml.matchId}`,
      );
    }

    componentRows.push({
      matchId: ml.matchId,
      leagueName: getStringField(
        metadata,
        "leagueName",
        `League ${getNumericField(metadata, "leagueApiId")}`,
      ),
      kickoffAt: metadata.kickoffAt,
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
        `OUT-OF-TIME ANALYSIS ${index + 1}/${mlResult.validationPredictions.length}`,
      );
    }
  }

  const currentRows = toPredictionRows(componentRows, "CURRENT");
  const poissonRows = toPredictionRows(componentRows, "POISSON");
  const mlRows = toPredictionRows(componentRows, "ML");

  const trainingPrior = matrixActualPrior(matrix, trainingIndices);
  const uniformRows = fixedPredictionRows(currentRows, {
    home: 1,
    draw: 1,
    away: 1,
  });
  const trainingPriorRows = fixedPredictionRows(currentRows, trainingPrior);

  const uniformMetrics = evaluate(uniformRows);
  const priorMetrics = evaluate(trainingPriorRows);
  const poissonMetrics = evaluate(poissonRows);
  const currentMetrics = evaluate(currentRows);
  const mlMetrics = evaluate(mlRows);

  console.log("");
  console.log("==============================================");
  console.log("2025/2026 OUT-OF-TIME MODEL COMPARISON");
  console.log("==============================================");
  console.table([
    { model: "UNIFORM 33/33/33", ...uniformMetrics },
    { model: "2024 TRAINING CLASS PRIOR", ...priorMetrics },
    { model: "PURE POISSON", ...poissonMetrics },
    {
      model: "PRODUCTION 20% ML / 80% POISSON",
      ...currentMetrics,
    },
    { model: "PURE ML", ...mlMetrics },
  ]);

  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION MODEL - CONFUSION MATRIX");
  console.log("==============================================");
  console.table(confusionMatrix(currentRows));

  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION MODEL - CONFIDENCE BUCKETS");
  console.log("==============================================");
  console.table(confidenceBuckets(currentRows));

  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION MODEL - LEAGUE BREAKDOWN");
  console.log("==============================================");
  console.table(leagueBreakdown(currentRows));

  const brierBeatsUniform = currentMetrics.brier < uniformMetrics.brier;
  const logLossBeatsUniform =
    currentMetrics.logLoss < uniformMetrics.logLoss;
  const brierBeatsPrior = currentMetrics.brier < priorMetrics.brier;
  const logLossBeatsPrior = currentMetrics.logLoss < priorMetrics.logLoss;
  const accuracyBeatsPrior =
    currentMetrics.accuracy >= priorMetrics.accuracy;
  const eceAcceptable = currentMetrics.ece <= MAXIMUM_ACCEPTABLE_ECE;

  const pass =
    temporalSeparation &&
    validation.rowCount >= MINIMUM_TEST_MATCHES &&
    brierBeatsUniform &&
    logLossBeatsUniform &&
    brierBeatsPrior &&
    logLossBeatsPrior &&
    accuracyBeatsPrior &&
    eceAcceptable;

  console.log("");
  console.log("==============================================");
  console.log("OUT-OF-TIME VALIDATION DECISION");
  console.log("==============================================");
  console.table({
    "Temporal separation": temporalSeparation ? "PASS" : "FAIL",
    "Minimum test sample":
      validation.rowCount >= MINIMUM_TEST_MATCHES ? "PASS" : "FAIL",
    "Brier beats uniform": brierBeatsUniform ? "YES" : "NO",
    "Log Loss beats uniform": logLossBeatsUniform ? "YES" : "NO",
    "Brier beats 2024 prior": brierBeatsPrior ? "YES" : "NO",
    "Log Loss beats 2024 prior": logLossBeatsPrior ? "YES" : "NO",
    "Accuracy beats 2024 prior": accuracyBeatsPrior ? "YES" : "NO",
    [`ECE <= ${MAXIMUM_ACCEPTABLE_ECE}`]: eceAcceptable ? "YES" : "NO",
    Decision: pass
      ? "PASS - KEEP CURRENT 20/80 AS OUT-OF-TIME VALIDATED"
      : "FAIL - DO NOT CHANGE PRODUCTION; INVESTIGATE",
  });

  console.log("");
  console.log(
    "Not: Bu test test sezonunda agirlik secmez, calibration uygulamaz " +
    "ve production ayarini otomatik degistirmez.",
  );

  console.log("");
  console.log("==============================================");
  console.log("2025/2026 OUT-OF-TIME TEST COMPLETED");
  console.log("==============================================");
}

main().catch((error: unknown) => {
  console.error("");
  console.error("2025/2026 out-of-time test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
