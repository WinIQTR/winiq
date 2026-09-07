import { ACTIVE_COMPETITIONS } from "@/config/competitions";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_CALCULATION_RUN_ID,
  generateMatchFeatures,
} from "@/modules/feature-engine/generate-match-features";
import {
  buildTrainingMatrix,
  collectTrainingData,
  trainSimpleLearningModel,
  type FeatureStandardization,
  type SimpleLearningModel,
} from "@/modules/learning-engine";
import type {
  MatchOutcome,
  ProbabilityConfidenceLevel,
} from "@/modules/probability-engine";
import type { LearnedMatchPredictionResult } from "./types";

const TRAINING_SEASON_YEAR = 2024;
const VALIDATION_SEASON_YEAR = 2025;
const MINIMUM_PROBABILITY = 0.000001;

const CORE_FEATURES = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

type TrainingRows = Awaited<
  ReturnType<typeof collectTrainingData>
>["rows"];

type TrainingMatrix = ReturnType<typeof buildTrainingMatrix>;

let trainedModelPromise: Promise<{
  model: SimpleLearningModel;
  warnings: string[];
}> | null = null;

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function softmax(scores: number[]): number[] {
  const maximumScore = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - maximumScore));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function predictProbabilities(options: {
  model: SimpleLearningModel;
  featureValues: number[];
}): number[] {
  const inputWithBias = [1, ...options.featureValues];
  const scores = options.model.weights.map((classWeights) =>
    classWeights.reduce(
      (total, weight, index) => total + weight * inputWithBias[index],
      0,
    ),
  );
  return softmax(scores);
}

function standardizeFeature(options: {
  rawValue: number;
  statistics: FeatureStandardization;
}): number {
  const standardDeviation =
    options.statistics.standardDeviation === 0
      ? 1
      : options.statistics.standardDeviation;
  return (options.rawValue - options.statistics.mean) / standardDeviation;
}

function normalize(probabilities: {
  home: number;
  draw: number;
  away: number;
}): { home: number; draw: number; away: number } {
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

function getTopPrediction(probabilities: {
  home: number;
  draw: number;
  away: number;
}): { outcome: MatchOutcome; probability: number } {
  const candidates: Array<{ outcome: MatchOutcome; probability: number }> = [
    { outcome: "HOME", probability: probabilities.home },
    { outcome: "DRAW", probability: probabilities.draw },
    { outcome: "AWAY", probability: probabilities.away },
  ];
  candidates.sort((left, right) => right.probability - left.probability);
  return candidates[0];
}

function probabilityToFairOdds(probabilityPercentage: number): number {
  const probability = probabilityPercentage / 100;
  if (!Number.isFinite(probability) || probability <= 0) return 999;
  return round(1 / Math.max(probability, MINIMUM_PROBABILITY));
}

function getConfidenceLevel(score: number): ProbabilityConfidenceLevel {
  if (score >= 85) return "VERY_HIGH";
  if (score >= 70) return "HIGH";
  if (score >= 55) return "MEDIUM";
  if (score >= 40) return "LOW";
  return "VERY_LOW";
}

function calculateConfidence(options: {
  highestProbability: number;
  secondHighestProbability: number;
  availableFeatureCount: number;
  expectedFeatureCount: number;
}): number {
  const probabilityGap =
    options.highestProbability - options.secondHighestProbability;
  const featureCoverage = options.expectedFeatureCount > 0
    ? options.availableFeatureCount / options.expectedFeatureCount
    : 0;
  const score =
    options.highestProbability * 0.55 +
    probabilityGap * 0.25 +
    featureCoverage * 100 * 0.2;
  return round(clamp(score, 0, 100));
}

function getNumericField(value: unknown, field: string): number {
  if (typeof value === "object" && value !== null && field in value) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  throw new Error(`${field} alanÄ± bulunamadÄ± veya sayÄ±sal deÄŸil.`);
}

function buildPartition(matrix: TrainingMatrix, indices: number[]) {
  if (indices.length === 0) {
    throw new Error("BoÅŸ eÄŸitim veya doÄŸrulama bÃ¶lÃ¼mÃ¼ oluÅŸturulamaz.");
  }
  const sorted = [...indices].sort((left, right) => {
    const timeDifference =
      matrix.metadata[left].kickoffAt.getTime() -
      matrix.metadata[right].kickoffAt.getTime();
    return timeDifference || left - right;
  });
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

async function collectSeasonRows(seasonYear: number): Promise<{
  rows: TrainingRows;
  warnings: string[];
}> {
  const rows: TrainingRows = [];
  const warnings: string[] = [];

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
      warnings.push(...result.warnings);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      warnings.push(
        `League ${competition.apiId}, sezon ${seasonYear} atlandÄ±: ${message}`,
      );
    }
  }

  return { rows, warnings };
}

async function trainValidatedLearningModel(): Promise<{
  model: SimpleLearningModel;
  warnings: string[];
}> {
  const [trainingCollection, validationCollection] = await Promise.all([
    collectSeasonRows(TRAINING_SEASON_YEAR),
    collectSeasonRows(VALIDATION_SEASON_YEAR),
  ]);

  if (trainingCollection.rows.length === 0) {
    throw new Error("2024 eÄŸitim verisi bulunamadÄ±.");
  }
  if (validationCollection.rows.length === 0) {
    throw new Error("2025 doÄŸrulama verisi bulunamadÄ±.");
  }

  const trainingIds = new Set(
    trainingCollection.rows.map((row) => getNumericField(row, "matchId")),
  );
  const validationIds = new Set(
    validationCollection.rows.map((row) => getNumericField(row, "matchId")),
  );

  const matrix = buildTrainingMatrix(
    [...trainingCollection.rows, ...validationCollection.rows],
    {
      includeSideFeatures: false,
      includeDifferenceFeatures: true,
      missingValueStrategy: "ZERO",
      maximumMissingRatio: 0.5,
    },
  );

  const trainingIndices: number[] = [];
  const validationIndices: number[] = [];
  for (let index = 0; index < matrix.rowCount; index += 1) {
    const matchId = getNumericField(matrix.metadata[index], "matchId");
    if (trainingIds.has(matchId)) trainingIndices.push(index);
    else if (validationIds.has(matchId)) validationIndices.push(index);
  }

  const training = buildPartition(matrix, trainingIndices);
  const validation = buildPartition(matrix, validationIndices);
  if (training.endedAt.getTime() >= validation.startedAt.getTime()) {
    throw new Error("2024 eÄŸitim ve 2025 doÄŸrulama dÃ¶nemleri kronolojik ayrÄ±lmadÄ±.");
  }

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
    warnings: [] as string[],
  };

  const learning = trainSimpleLearningModel(split);
  return {
    model: learning.model,
    warnings: [
      ...trainingCollection.warnings,
      ...validationCollection.warnings,
      ...matrix.warnings,
      ...learning.warnings,
    ],
  };
}

async function getValidatedLearningModel(): Promise<{
  model: SimpleLearningModel;
  warnings: string[];
}> {
  if (!trainedModelPromise) {
    trainedModelPromise = trainValidatedLearningModel();
  }
  try {
    return await trainedModelPromise;
  } catch (error) {
    trainedModelPromise = null;
    throw error;
  }
}

async function loadMatchFeatureVector(options: {
  matchId: number;
  homeTeamId: number;
  awayTeamId: number;
  featureNames: string[];
}): Promise<{
  featureVector: Record<string, number>;
  availableFeatureCount: number;
}> {
  const baseFeatureKeys = [
    ...new Set(
      options.featureNames.map((featureName) =>
        featureName.replace(/^diff_/, ""),
      ),
    ),
  ];
  const definitions = await prisma.featureDefinition.findMany({
    where: { key: { in: baseFeatureKeys } },
    select: { id: true, key: true },
  });
  const values = await prisma.matchFeatureValue.findMany({
    where: {
      matchId: options.matchId,
      featureId: { in: definitions.map((definition) => definition.id) },
      teamId: { in: [options.homeTeamId, options.awayTeamId] },
      calculationRunId: ACTIVE_CALCULATION_RUN_ID,
    },
    include: { feature: { select: { key: true } } },
    orderBy: { calculatedAt: "desc" },
  });

  const homeValues = new Map<string, number>();
  const awayValues = new Map<string, number>();
  for (const value of values) {
    const numericValue = value.normalizedValue ?? value.numericValue;
    if (numericValue === null || !Number.isFinite(numericValue)) continue;
    const target = value.teamId === options.homeTeamId
      ? homeValues
      : value.teamId === options.awayTeamId
      ? awayValues
      : null;
    if (target && !target.has(value.feature.key)) {
      target.set(value.feature.key, numericValue);
    }
  }

  const featureVector: Record<string, number> = {};
  let availableFeatureCount = 0;
  for (const featureName of options.featureNames) {
    const baseKey = featureName.replace(/^diff_/, "");
    const homeValue = homeValues.get(baseKey);
    const awayValue = awayValues.get(baseKey);
    if (typeof homeValue === "number" && typeof awayValue === "number") {
      featureVector[featureName] = round(homeValue - awayValue, 6);
      availableFeatureCount += 1;
    } else {
      featureVector[featureName] = 0;
    }
  }
  return { featureVector, availableFeatureCount };
}

export async function generateLearnedMatchPrediction(options: {
  matchId: number;
}): Promise<LearnedMatchPredictionResult> {
  if (!Number.isInteger(options.matchId) || options.matchId <= 0) {
    throw new Error("matchId pozitif bir tam sayÄ± olmalÄ±dÄ±r.");
  }

  const match = await prisma.match.findUnique({
    where: { id: options.matchId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!match) {
    throw new Error(`${options.matchId} ID deÄŸerine sahip maÃ§ bulunamadÄ±.`);
  }

  await generateMatchFeatures(match.id);
  const trained = await getValidatedLearningModel();
  const loaded = await loadMatchFeatureVector({
    matchId: match.id,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    featureNames: trained.model.featureNames,
  });

  const standardizedValues = trained.model.featureNames.map(
    (featureName, index) => standardizeFeature({
      rawValue: loaded.featureVector[featureName] ?? 0,
      statistics: trained.model.standardization[index],
    }),
  );
  const vector = predictProbabilities({
    model: trained.model,
    featureValues: standardizedValues,
  });
  const normalized = normalize({
    home: vector[0] * 100,
    draw: vector[1] * 100,
    away: vector[2] * 100,
  });
  const probabilities = {
    home: round(normalized.home),
    draw: round(normalized.draw),
    away: round(normalized.away),
  };
  const topPrediction = getTopPrediction(probabilities);
  const sorted = [
    probabilities.home,
    probabilities.draw,
    probabilities.away,
  ].sort((left, right) => right - left);
  const confidenceScore = calculateConfidence({
    highestProbability: sorted[0],
    secondHighestProbability: sorted[1],
    availableFeatureCount: loaded.availableFeatureCount,
    expectedFeatureCount: trained.model.featureNames.length,
  });
  const warnings = [...trained.warnings];
  const missingFeatureCount =
    trained.model.featureNames.length - loaded.availableFeatureCount;
  if (missingFeatureCount > 0) {
    warnings.push(
      `${missingFeatureCount} ML feature deÄŸeri eksik olduÄŸu iÃ§in ZERO kullanÄ±ldÄ±.`,
    );
  }

  return {
    match: {
      id: match.id,
      apiId: match.apiId,
      kickoffAt: match.kickoffAt,
      status: match.status,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
    },
    model: {
      name: "Validated Multi-League Simple Learning Model",
      version: "learning-v3.0-2024-nine-league-zero",
      status: "EXPERIMENTAL",
      trainingSeasonYear: TRAINING_SEASON_YEAR,
      trainingLeagueApiId: 0,
      featureCount: trained.model.featureNames.length,
      featureNames: trained.model.featureNames,
      learningRate: trained.model.configuration.learningRate,
      maximumEpochs: trained.model.configuration.maximumEpochs,
      l2Regularization: trained.model.configuration.l2Regularization,
      epochsCompleted: trained.model.epochsCompleted,
    },
    probabilities,
    fairOdds: {
      home: probabilityToFairOdds(probabilities.home),
      draw: probabilityToFairOdds(probabilities.draw),
      away: probabilityToFairOdds(probabilities.away),
    },
    predictedOutcome: topPrediction.outcome,
    predictedProbability: topPrediction.probability,
    confidenceScore,
    confidenceLevel: getConfidenceLevel(confidenceScore),
    featureVector: loaded.featureVector,
    warnings: [...new Set(warnings)],
  };
}