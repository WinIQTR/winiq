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

const DEVELOPMENT_SEASON = 2024;
const OUT_OF_TIME_SEASON = 2025;
const ML_WEIGHT = 0.2;
const POISSON_WEIGHT = 0.8;
const TRAIN_RATIO = 0.6;
const VALIDATION_RATIO = 0.2;
const MIN_PARTITION_MATCHES = 100;
const MIN_VALIDATION_OVERRIDES = 8;
const MIN_HOLDOUT_OVERRIDES = 5;
const MIN_DRAW_PRECISION = 0.25;
const EPSILON = 1e-12;

const CORE_FEATURES = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

const MIN_DRAW_PROBABILITIES = [
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
] as const;

const MAX_DRAW_GAPS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const;

const OUTCOMES: MatchOutcome[] = ["HOME", "DRAW", "AWAY"];

type TrainingRows = Awaited<ReturnType<typeof collectTrainingData>>["rows"];
type TrainingMatrix = ReturnType<typeof buildTrainingMatrix>;

type MatrixPartition = {
  featureNames: string[];
  X: number[][];
  y: number[][];
  yClass: number[];
  metadata: TrainingMatrix["metadata"];
  rowCount: number;
  startedAt: Date;
  endedAt: Date;
};

type ModelSplit = {
  training: MatrixPartition;
  validation: MatrixPartition;
  trainingPercentage: number;
  validationPercentage: number;
  splitIndex: number;
  splitDate: Date;
  totalRowCount: number;
  warnings: string[];
};

type PredictionRow = {
  matchId: number;
  leagueApiId: number;
  leagueName: string;
  kickoffAt: Date;
  actualOutcome: MatchOutcome;
  probabilities: OutcomeProbabilities;
};

type DrawRule = {
  minimumDrawProbability: number;
  maximumDrawGap: number;
};

type DecisionMetrics = {
  matches: number;
  correct: number;
  accuracy: number;
  actualDraws: number;
  predictedDraws: number;
  correctDraws: number;
  drawPrecision: number;
  drawRecall: number;
  drawF1: number;
  overrides: number;
  correctOverrides: number;
  wrongOverrides: number;
  overrideAccuracy: number;
};

type ProbabilityMetrics = {
  brier: number;
  logLoss: number;
  ece: number;
};

type CandidateResult = {
  rule: DrawRule;
  metrics: DecisionMetrics;
  accuracyDelta: number;
  drawRecallDelta: number;
  practical: boolean;
};

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatDate(value: Date): string {
  return Number.isFinite(value.getTime()) ? value.toISOString() : "INVALID";
}

function getNumericField(value: unknown, field: string): number {
  if (typeof value === "object" && value !== null && field in value) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  throw new Error(`${field} alani bulunamadi veya sayisal degil.`);
}

function getStringField(value: unknown, field: string, fallback: string): string {
  if (typeof value === "object" && value !== null && field in value) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return fallback;
}

function normalize(probabilities: OutcomeProbabilities): OutcomeProbabilities {
  const total = probabilities.home + probabilities.draw + probabilities.away;

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
): OutcomeProbabilities {
  return normalize({
    home: ml.home * ML_WEIGHT + poisson.home * POISSON_WEIGHT,
    draw: ml.draw * ML_WEIGHT + poisson.draw * POISSON_WEIGHT,
    away: ml.away * ML_WEIGHT + poisson.away * POISSON_WEIGHT,
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

function baselineOutcome(probabilities: OutcomeProbabilities): MatchOutcome {
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

function selectedOutcome(
  probabilities: OutcomeProbabilities,
  rule: DrawRule | null,
): MatchOutcome {
  const baseline = baselineOutcome(probabilities);
  if (!rule || baseline === "DRAW") return baseline;

  const leadingProbability = baseline === "HOME"
    ? probabilities.home
    : probabilities.away;
  const drawGap = leadingProbability - probabilities.draw;

  if (
    probabilities.draw >= rule.minimumDrawProbability &&
    drawGap <= rule.maximumDrawGap
  ) {
    return "DRAW";
  }

  return baseline;
}

function classIndexToOutcome(classIndex: number): MatchOutcome {
  const outcome = OUTCOMES[classIndex];
  if (!outcome) throw new Error(`Gecersiz sonuc sinifi: ${classIndex}`);
  return outcome;
}

function chronologicalIndices(
  matrix: TrainingMatrix,
  indices: number[],
): number[] {
  return [...indices].sort((left, right) => {
    const difference =
      matrix.metadata[left].kickoffAt.getTime() -
      matrix.metadata[right].kickoffAt.getTime();
    return difference || left - right;
  });
}

function moveBoundaryAfterKickoffGroup(
  matrix: TrainingMatrix,
  orderedIndices: number[],
  proposedIndex: number,
): number {
  if (proposedIndex <= 0 || proposedIndex >= orderedIndices.length) {
    return proposedIndex;
  }

  let boundary = proposedIndex;
  const previousKickoff =
    matrix.metadata[orderedIndices[boundary - 1]].kickoffAt.getTime();

  while (
    boundary < orderedIndices.length &&
    matrix.metadata[orderedIndices[boundary]].kickoffAt.getTime() ===
      previousKickoff
  ) {
    boundary += 1;
  }

  return boundary;
}

function buildPartition(
  matrix: TrainingMatrix,
  indices: number[],
): MatrixPartition {
  if (indices.length === 0) throw new Error("Bos partition olusturulamaz.");
  const sorted = chronologicalIndices(matrix, indices);

  return {
    featureNames: [...matrix.featureNames],
    X: sorted.map((index) => matrix.X[index]),
    y: sorted.map((index) => matrix.yOneHot[index]),
    yClass: sorted.map((index) => matrix.y[index]),
    metadata: sorted.map((index) => matrix.metadata[index]),
    rowCount: sorted.length,
    startedAt: matrix.metadata[sorted[0]].kickoffAt,
    endedAt: matrix.metadata[sorted[sorted.length - 1]].kickoffAt,
  };
}

function buildSplit(
  training: MatrixPartition,
  validation: MatrixPartition,
): ModelSplit {
  const total = training.rowCount + validation.rowCount;
  return {
    training,
    validation,
    trainingPercentage: training.rowCount / total * 100,
    validationPercentage: validation.rowCount / total * 100,
    splitIndex: training.rowCount,
    splitDate: validation.startedAt,
    totalRowCount: total,
    warnings: [],
  };
}

function evaluateDecision(
  rows: PredictionRow[],
  rule: DrawRule | null,
): DecisionMetrics {
  let correct = 0;
  let actualDraws = 0;
  let predictedDraws = 0;
  let correctDraws = 0;
  let overrides = 0;
  let correctOverrides = 0;

  for (const row of rows) {
    const baseline = baselineOutcome(row.probabilities);
    const selected = selectedOutcome(row.probabilities, rule);

    if (row.actualOutcome === "DRAW") actualDraws += 1;
    if (selected === "DRAW") predictedDraws += 1;
    if (selected === "DRAW" && row.actualOutcome === "DRAW") correctDraws += 1;
    if (selected === row.actualOutcome) correct += 1;

    if (selected !== baseline) {
      overrides += 1;
      if (selected === row.actualOutcome) correctOverrides += 1;
    }
  }

  const drawPrecision = predictedDraws > 0 ? correctDraws / predictedDraws : 0;
  const drawRecall = actualDraws > 0 ? correctDraws / actualDraws : 0;
  const drawF1 = drawPrecision + drawRecall > 0
    ? 2 * drawPrecision * drawRecall / (drawPrecision + drawRecall)
    : 0;

  return {
    matches: rows.length,
    correct,
    accuracy: correct / rows.length,
    actualDraws,
    predictedDraws,
    correctDraws,
    drawPrecision,
    drawRecall,
    drawF1,
    overrides,
    correctOverrides,
    wrongOverrides: overrides - correctOverrides,
    overrideAccuracy: overrides > 0 ? correctOverrides / overrides : 0,
  };
}

function calculateEce(rows: PredictionRow[]): number {
  let weightedError = 0;
  let observations = 0;

  for (const outcome of OUTCOMES) {
    for (let minimum = 0; minimum < 100; minimum += 10) {
      const bucket = rows.filter((row) => {
        const probability = probabilityFor(row.probabilities, outcome);
        return probability >= minimum && probability < minimum + 10;
      });

      if (bucket.length === 0) continue;

      const confidence = bucket.reduce(
        (sum, row) => sum + probabilityFor(row.probabilities, outcome) / 100,
        0,
      ) / bucket.length;
      const frequency = bucket.filter(
        (row) => row.actualOutcome === outcome,
      ).length / bucket.length;

      weightedError += Math.abs(confidence - frequency) * bucket.length;
      observations += bucket.length;
    }
  }

  return observations > 0 ? weightedError / observations : 0;
}

function evaluateProbabilities(rows: PredictionRow[]): ProbabilityMetrics {
  let brier = 0;
  let logLoss = 0;

  for (const row of rows) {
    for (const outcome of OUTCOMES) {
      const probability = probabilityFor(row.probabilities, outcome) / 100;
      const actual = row.actualOutcome === outcome ? 1 : 0;
      brier += (probability - actual) ** 2;
    }

    const actualProbability = Math.max(
      probabilityFor(row.probabilities, row.actualOutcome) / 100,
      EPSILON,
    );
    logLoss -= Math.log(actualProbability);
  }

  return {
    brier: brier / rows.length,
    logLoss: logLoss / rows.length,
    ece: calculateEce(rows),
  };
}

function metricRow(
  stage: string,
  label: string,
  decision: DecisionMetrics,
  probability: ProbabilityMetrics,
) {
  return {
    stage,
    model: label,
    matches: decision.matches,
    accuracy: round(decision.accuracy * 100, 2),
    predictedDraws: decision.predictedDraws,
    correctDraws: decision.correctDraws,
    drawPrecision: round(decision.drawPrecision * 100, 2),
    drawRecall: round(decision.drawRecall * 100, 2),
    drawF1: round(decision.drawF1 * 100, 2),
    overrides: decision.overrides,
    brier: round(probability.brier),
    logLoss: round(probability.logLoss),
    ece: round(probability.ece),
  };
}

async function collectSeasonRows(seasonYear: number): Promise<TrainingRows> {
  const rows: TrainingRows = [];
  const status: Array<Record<string, unknown>> = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    try {
      const result = await collectTrainingData({
        leagueApiId: competition.apiId,
        seasonYear,
        featureKeys: [...CORE_FEATURES],
        minimumDataQualityScore: 0,
        strictPreMatchOnly: true,
      });
      rows.push(...result.rows);
      status.push({
        season: seasonYear,
        leagueApiId: competition.apiId,
        competition: `League ${competition.apiId}`,
        rows: result.rows.length,
        status: result.rows.length > 0 ? "OK" : "NO ROWS",
      });
    } catch (error: unknown) {
      status.push({
        season: seasonYear,
        leagueApiId: competition.apiId,
        competition: `League ${competition.apiId}`,
        rows: 0,
        status: error instanceof Error ? error.message : "UNKNOWN ERROR",
      });
    }
  }

  console.table(status);
  return rows;
}

async function predictPartition(
  matrix: TrainingMatrix,
  trainingIndices: number[],
  validationIndices: number[],
  label: string,
): Promise<PredictionRow[]> {
  const training = buildPartition(matrix, trainingIndices);
  const validation = buildPartition(matrix, validationIndices);

  if (training.endedAt.getTime() >= validation.startedAt.getTime()) {
    throw new Error(`${label}: kronolojik ayrim gecersiz.`);
  }

  if (validation.rowCount < MIN_PARTITION_MATCHES) {
    throw new Error(
      `${label}: validation/holdout yetersiz (${validation.rowCount}).`,
    );
  }

  console.table([
    {
      stage: label,
      partition: "TRAIN",
      matches: training.rowCount,
      firstMatch: formatDate(training.startedAt),
      lastMatch: formatDate(training.endedAt),
    },
    {
      stage: label,
      partition: "EVALUATION",
      matches: validation.rowCount,
      firstMatch: formatDate(validation.startedAt),
      lastMatch: formatDate(validation.endedAt),
    },
  ]);

  const result = trainSimpleLearningModel(buildSplit(training, validation));
  const metadataByMatchId = new Map(
    validation.metadata.map((metadata) => [
      getNumericField(metadata, "matchId"),
      metadata,
    ]),
  );
  const rows: PredictionRow[] = [];

  for (let index = 0; index < result.validationPredictions.length; index += 1) {
    const prediction = result.validationPredictions[index];
    const metadata = metadataByMatchId.get(prediction.matchId);
    if (!metadata) {
      throw new Error(`${label}: metadata yok. matchId=${prediction.matchId}`);
    }

    const poisson = await calculateGoalProbabilities(prediction.matchId);
    const leagueApiId = getNumericField(metadata, "leagueApiId");

    rows.push({
      matchId: prediction.matchId,
      leagueApiId,
      leagueName: getStringField(
        metadata,
        "leagueName",
        `League ${leagueApiId}`,
      ),
      kickoffAt: metadata.kickoffAt,
      actualOutcome: prediction.actualOutcome,
      probabilities: blend(
        normalize({
          home: prediction.homeProbability,
          draw: prediction.drawProbability,
          away: prediction.awayProbability,
        }),
        normalize(poisson.outcomeProbabilities),
      ),
    });

    if ((index + 1) % 100 === 0) {
      console.log(`${label} ${index + 1}/${result.validationPredictions.length}`);
    }
  }

  return rows;
}

function chooseRule(validationRows: PredictionRow[]): {
  baseline: DecisionMetrics;
  candidates: CandidateResult[];
  selected: CandidateResult | null;
} {
  const baseline = evaluateDecision(validationRows, null);
  const candidates: CandidateResult[] = [];

  for (const minimumDrawProbability of MIN_DRAW_PROBABILITIES) {
    for (const maximumDrawGap of MAX_DRAW_GAPS) {
      const rule = { minimumDrawProbability, maximumDrawGap };
      const metrics = evaluateDecision(validationRows, rule);
      const accuracyDelta = metrics.accuracy - baseline.accuracy;
      const drawRecallDelta = metrics.drawRecall - baseline.drawRecall;
      const practical =
        metrics.overrides >= MIN_VALIDATION_OVERRIDES &&
        metrics.correctDraws > baseline.correctDraws &&
        metrics.drawPrecision >= MIN_DRAW_PRECISION &&
        accuracyDelta >= 0;

      candidates.push({
        rule,
        metrics,
        accuracyDelta,
        drawRecallDelta,
        practical,
      });
    }
  }

  const practicalCandidates = candidates.filter((candidate) => candidate.practical);
  practicalCandidates.sort((left, right) =>
    right.metrics.accuracy - left.metrics.accuracy ||
    right.metrics.drawF1 - left.metrics.drawF1 ||
    right.metrics.drawPrecision - left.metrics.drawPrecision ||
    left.metrics.overrides - right.metrics.overrides ||
    right.rule.minimumDrawProbability - left.rule.minimumDrawProbability ||
    left.rule.maximumDrawGap - right.rule.maximumDrawGap
  );

  return {
    baseline,
    candidates,
    selected: practicalCandidates[0] ?? null,
  };
}

function topCandidateRows(candidates: CandidateResult[]) {
  return [...candidates]
    .sort((left, right) =>
      Number(right.practical) - Number(left.practical) ||
      right.metrics.accuracy - left.metrics.accuracy ||
      right.metrics.drawF1 - left.metrics.drawF1
    )
    .slice(0, 20)
    .map((candidate) => ({
      minimumDrawProbability: candidate.rule.minimumDrawProbability,
      maximumDrawGap: candidate.rule.maximumDrawGap,
      practical: candidate.practical ? "YES" : "NO",
      accuracy: round(candidate.metrics.accuracy * 100, 2),
      accuracyDeltaPP: round(candidate.accuracyDelta * 100, 2),
      predictedDraws: candidate.metrics.predictedDraws,
      correctDraws: candidate.metrics.correctDraws,
      drawPrecision: round(candidate.metrics.drawPrecision * 100, 2),
      drawRecall: round(candidate.metrics.drawRecall * 100, 2),
      drawF1: round(candidate.metrics.drawF1 * 100, 2),
      overrides: candidate.metrics.overrides,
    }));
}

function stageGate(
  baseline: DecisionMetrics,
  candidate: DecisionMetrics,
  minimumOverrides: number,
): boolean {
  return (
    candidate.overrides >= minimumOverrides &&
    candidate.correctDraws > baseline.correctDraws &&
    candidate.drawPrecision >= MIN_DRAW_PRECISION &&
    candidate.accuracy >= baseline.accuracy
  );
}

async function main(): Promise<void> {
  console.log("\n====================================================");
  console.log("DRAW DECISION V3 - VALIDATION / HOLDOUT / OOT TEST");
  console.log("====================================================");
  console.table({
    "Development season": DEVELOPMENT_SEASON,
    "Untouched OOT season": `${OUT_OF_TIME_SEASON} (2025/2026)`,
    "Base probabilities": "20% ML / 80% Poisson",
    "Probability mutation": "DISABLED",
    "Rule selection": "2024 VALIDATION ONLY",
    "Fallback candidate": "DISABLED - REJECT IF NO PRACTICAL RULE",
    "Missing values": "ZERO",
  });

  console.log("\n2024 DATA COLLECTION");
  const developmentRows = await collectSeasonRows(DEVELOPMENT_SEASON);
  console.log("\n2025 DATA COLLECTION");
  const ootRows = await collectSeasonRows(OUT_OF_TIME_SEASON);

  if (developmentRows.length === 0 || ootRows.length === 0) {
    throw new Error("2024 veya 2025 sezon verisi bulunamadi.");
  }

  const developmentIds = new Set(
    developmentRows.map((row) => getNumericField(row, "matchId")),
  );
  const ootIds = new Set(
    ootRows.map((row) => getNumericField(row, "matchId")),
  );
  const overlap = [...ootIds].filter((matchId) => developmentIds.has(matchId));
  if (overlap.length > 0) {
    throw new Error(`${overlap.length} mac 2024 ve 2025 sezonlarinda cakisti.`);
  }

  const matrix = buildTrainingMatrix([...developmentRows, ...ootRows], {
    includeSideFeatures: false,
    includeDifferenceFeatures: true,
    missingValueStrategy: "ZERO",
    maximumMissingRatio: 0.5,
  });

  const developmentIndices: number[] = [];
  const ootIndices: number[] = [];
  for (let index = 0; index < matrix.rowCount; index += 1) {
    const matchId = getNumericField(matrix.metadata[index], "matchId");
    if (developmentIds.has(matchId)) developmentIndices.push(index);
    else if (ootIds.has(matchId)) ootIndices.push(index);
    else throw new Error(`Matrix satiri sezona eslesmedi. matchId=${matchId}`);
  }

  const orderedDevelopment = chronologicalIndices(matrix, developmentIndices);
  const requestedTrainEnd = Math.floor(
    orderedDevelopment.length * TRAIN_RATIO,
  );
  const trainEnd = moveBoundaryAfterKickoffGroup(
    matrix,
    orderedDevelopment,
    requestedTrainEnd,
  );
  const requestedValidationEnd = Math.floor(
    orderedDevelopment.length * (TRAIN_RATIO + VALIDATION_RATIO),
  );
  const validationEnd = moveBoundaryAfterKickoffGroup(
    matrix,
    orderedDevelopment,
    Math.max(requestedValidationEnd, trainEnd + 1),
  );
  const trainIndices = orderedDevelopment.slice(0, trainEnd);
  const validationIndices = orderedDevelopment.slice(trainEnd, validationEnd);
  const holdoutIndices = orderedDevelopment.slice(validationEnd);

  console.log("\n2024 CHRONOLOGICAL SPLIT");
  console.table({
    "Requested train rows": requestedTrainEnd,
    "Aligned train rows": trainIndices.length,
    "Requested train+validation rows": requestedValidationEnd,
    "Aligned train+validation rows": validationEnd,
    "Validation rows": validationIndices.length,
    "Holdout rows": holdoutIndices.length,
    "Same-kickoff groups split": "NO",
  });

  if (
    trainIndices.length < MIN_PARTITION_MATCHES ||
    validationIndices.length < MIN_PARTITION_MATCHES ||
    holdoutIndices.length < MIN_PARTITION_MATCHES ||
    ootIndices.length < MIN_PARTITION_MATCHES
  ) {
    throw new Error("Train/validation/holdout/OOT bolumlerinden biri yetersiz.");
  }

  console.log("\n====================================================");
  console.log("STAGE 1 - VALIDATION-ONLY RULE SELECTION");
  console.log("====================================================");
  const validationRows = await predictPartition(
    matrix,
    trainIndices,
    validationIndices,
    "2024 VALIDATION",
  );
  const selection = chooseRule(validationRows);
  console.log("\nTOP VALIDATION CANDIDATES");
  console.table(topCandidateRows(selection.candidates));

  if (!selection.selected) {
    console.log("\n====================================================");
    console.log("DECISION");
    console.log("====================================================");
    console.table({
      "Validation candidate": "NONE",
      "Holdout test": "NOT RUN",
      "2025/2026 OOT test": "NOT RUN",
      Decision: "REJECT - KEEP BASE 20/80 DECISION",
    });
    return;
  }

  const lockedRule = selection.selected.rule;
  const validationProbability = evaluateProbabilities(validationRows);
  console.log("\nSELECTED AND LOCKED RULE");
  console.table({
    "Minimum DRAW probability": `${lockedRule.minimumDrawProbability}%`,
    "Maximum DRAW gap": `${lockedRule.maximumDrawGap} percentage points`,
    "Selected using": "2024 VALIDATION ONLY",
    "Further tuning": "DISABLED",
  });
  console.table([
    metricRow(
      "VALIDATION",
      "BASE 20/80",
      selection.baseline,
      validationProbability,
    ),
    metricRow(
      "VALIDATION",
      "BASE + DRAW V3",
      selection.selected.metrics,
      validationProbability,
    ),
  ]);

  console.log("\n====================================================");
  console.log("STAGE 2 - UNTOUCHED 2024 HOLDOUT");
  console.log("====================================================");
  const developmentBeforeHoldout = [
    ...trainIndices,
    ...validationIndices,
  ];
  const holdoutRows = await predictPartition(
    matrix,
    developmentBeforeHoldout,
    holdoutIndices,
    "2024 HOLDOUT",
  );
  const holdoutProbability = evaluateProbabilities(holdoutRows);
  const holdoutBaseline = evaluateDecision(holdoutRows, null);
  const holdoutCandidate = evaluateDecision(holdoutRows, lockedRule);
  const holdoutPass = stageGate(
    holdoutBaseline,
    holdoutCandidate,
    MIN_HOLDOUT_OVERRIDES,
  );
  console.table([
    metricRow("HOLDOUT", "BASE 20/80", holdoutBaseline, holdoutProbability),
    metricRow(
      "HOLDOUT",
      "BASE + LOCKED DRAW V3",
      holdoutCandidate,
      holdoutProbability,
    ),
  ]);
  console.table({
    "Accuracy not worse": holdoutCandidate.accuracy >= holdoutBaseline.accuracy
      ? "PASS"
      : "FAIL",
    "Draw precision gate": holdoutCandidate.drawPrecision >= MIN_DRAW_PRECISION
      ? "PASS"
      : "FAIL",
    "Draw capture improved": holdoutCandidate.correctDraws > holdoutBaseline.correctDraws
      ? "PASS"
      : "FAIL",
    "Minimum overrides": holdoutCandidate.overrides >= MIN_HOLDOUT_OVERRIDES
      ? "PASS"
      : "FAIL",
    "2024 HOLDOUT": holdoutPass ? "PASS" : "FAIL",
  });

  if (!holdoutPass) {
    console.log("\n====================================================");
    console.log("DECISION");
    console.log("====================================================");
    console.table({
      "Locked rule": `DRAW>=${lockedRule.minimumDrawProbability}, GAP<=${lockedRule.maximumDrawGap}`,
      "2024 holdout": "FAIL",
      "2025/2026 OOT test": "NOT RUN",
      Decision: "REJECT - KEEP BASE 20/80 DECISION",
    });
    return;
  }

  console.log("\n====================================================");
  console.log("STAGE 3 - 2025/2026 OUT-OF-TIME VALIDATION");
  console.log("====================================================");
  const ootRowsPredicted = await predictPartition(
    matrix,
    developmentIndices,
    ootIndices,
    "2025/2026 OOT",
  );
  const ootProbability = evaluateProbabilities(ootRowsPredicted);
  const ootBaseline = evaluateDecision(ootRowsPredicted, null);
  const ootCandidate = evaluateDecision(ootRowsPredicted, lockedRule);
  const ootPass = stageGate(
    ootBaseline,
    ootCandidate,
    MIN_HOLDOUT_OVERRIDES,
  );
  console.table([
    metricRow("OOT", "BASE 20/80", ootBaseline, ootProbability),
    metricRow(
      "OOT",
      "BASE + LOCKED DRAW V3",
      ootCandidate,
      ootProbability,
    ),
  ]);
  console.table({
    "Accuracy not worse": ootCandidate.accuracy >= ootBaseline.accuracy
      ? "PASS"
      : "FAIL",
    "Draw precision gate": ootCandidate.drawPrecision >= MIN_DRAW_PRECISION
      ? "PASS"
      : "FAIL",
    "Draw capture improved": ootCandidate.correctDraws > ootBaseline.correctDraws
      ? "PASS"
      : "FAIL",
    "Minimum overrides": ootCandidate.overrides >= MIN_HOLDOUT_OVERRIDES
      ? "PASS"
      : "FAIL",
    "2025/2026 OOT": ootPass ? "PASS" : "FAIL",
  });

  console.log("\n====================================================");
  console.log("FINAL DECISION");
  console.log("====================================================");
  console.table({
    "Locked minimum DRAW probability": `${lockedRule.minimumDrawProbability}%`,
    "Locked maximum DRAW gap": `${lockedRule.maximumDrawGap} pp`,
    "2024 validation": "PASS",
    "2024 untouched holdout": holdoutPass ? "PASS" : "FAIL",
    "2025/2026 untouched OOT": ootPass ? "PASS" : "FAIL",
    "Brier / Log Loss / ECE": "UNCHANGED (probabilities are not mutated)",
    Decision: holdoutPass && ootPass
      ? "PASS - DRAW V3 MAY PROCEED TO PRODUCTION IMPLEMENTATION"
      : "REJECT - KEEP BASE 20/80 DECISION",
  });
}

main().catch((error: unknown) => {
  console.error("\nDRAW Decision V3 test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
