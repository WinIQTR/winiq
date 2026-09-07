import { prisma } from "@/lib/prisma";

export type PredictionSettlement = "WON" | "LOST" | "VOID";

export type ActualOutcome = "HOME" | "DRAW" | "AWAY";

export type EvaluatedPrediction = {
  id: number;
  matchId: number;
  leagueName: string;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  marketKey: string;
  category: string;
  market: string;
  selection: string;
  /** Legacy 1X2 alias. It is null for non-1X2 markets. */
  predictedOutcome: ActualOutcome | null;
  predictedProbability: number;
  fairOdds: number | null;
  marketOdds: number | null;
  confidenceScore: number;
  dataQualityScore: number | null;
  tier: string;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  /** Legacy 1X2 alias derived from the archived final score. */
  actualOutcome: ActualOutcome | null;
  /** Legacy read-only alias derived from the canonical settlement result. */
  isCorrect: boolean;
  /** Binary probability error retained for legacy reports. */
  probabilityError: number;
  result: PredictionSettlement;
  rank: number;
  modelName: string;
  modelVersion: string;
  publishedAt: Date;
  settledAt: Date | null;
};

export type PerformanceBucket = {
  label: string;
  minimum: number;
  maximum: number | null;
  totalPredictions: number;
  settledPredictions: number;
  wonPredictions: number;
  lostPredictions: number;
  voidPredictions: number;
  averageValue: number;
  actualAccuracy: number;
  calibrationGap: number;
};

export type MarketPerformance = {
  marketKey: string;
  market: string;
  totalPredictions: number;
  settledPredictions: number;
  wonPredictions: number;
  lostPredictions: number;
  voidPredictions: number;
  accuracy: number;
  averageProbability: number;
  averageConfidence: number;
};

export type PredictionEvaluationSummary = {
  totalPredictions: number;
  settledPredictions: number;
  wonPredictions: number;
  lostPredictions: number;
  voidPredictions: number;
  /** Legacy aliases retained while older scripts migrate to WON/LOST/VOID. */
  correctPredictions: number;
  incorrectPredictions: number;
  accuracy: number;
  averagePredictedProbability: number;
  averageWinningProbability: number;
  averageConfidence: number;
  averageFairOdds: number | null;
  homePredictions: number;
  homeCorrect: number;
  homeAccuracy: number;
  drawPredictions: number;
  drawCorrect: number;
  drawAccuracy: number;
  awayPredictions: number;
  awayCorrect: number;
  awayAccuracy: number;
  highConfidencePredictions: number;
  highConfidenceCorrect: number;
  highConfidenceAccuracy: number;
  mediumConfidencePredictions: number;
  mediumConfidenceCorrect: number;
  mediumConfidenceAccuracy: number;
  lowConfidencePredictions: number;
  lowConfidenceCorrect: number;
  lowConfidenceAccuracy: number;
  probabilityBuckets: PerformanceBucket[];
  confidenceBuckets: PerformanceBucket[];
  marketPerformance: MarketPerformance[];
};

export type PredictionEvaluationResult = {
  summary: PredictionEvaluationSummary;
  predictions: EvaluatedPrediction[];
};

type BucketDefinition = {
  label: string;
  minimum: number;
  maximum: number | null;
};

const BUCKETS: BucketDefinition[] = [
  { label: "0–49.9%", minimum: 0, maximum: 50 },
  { label: "50–59.9%", minimum: 50, maximum: 60 },
  { label: "60–69.9%", minimum: 60, maximum: 70 },
  { label: "70–79.9%", minimum: 70, maximum: 80 },
  { label: "80–89.9%", minimum: 80, maximum: 90 },
  { label: "90–100%", minimum: 90, maximum: null },
];

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return round((numerator / denominator) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((total, value) => total + value, 0) / values.length);
}

function normalizeResult(value: string): PredictionSettlement | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "WON" || normalized === "LOST" || normalized === "VOID") {
    return normalized;
  }
  return null;
}

function normalizeOutcome(value: string): ActualOutcome | null {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (
    normalized === "HOME" ||
    normalized === "HOME_WIN" ||
    normalized === "MATCH_RESULT_HOME" ||
    normalized === "FULL_TIME_RESULT_HOME" ||
    normalized === "1"
  ) {
    return "HOME";
  }

  if (
    normalized === "DRAW" ||
    normalized === "MATCH_RESULT_DRAW" ||
    normalized === "FULL_TIME_RESULT_DRAW" ||
    normalized === "X"
  ) {
    return "DRAW";
  }

  if (
    normalized === "AWAY" ||
    normalized === "AWAY_WIN" ||
    normalized === "MATCH_RESULT_AWAY" ||
    normalized === "FULL_TIME_RESULT_AWAY" ||
    normalized === "2"
  ) {
    return "AWAY";
  }

  return null;
}

function derivePredictedOutcome(
  marketKey: string,
  selection: string,
): ActualOutcome | null {
  return normalizeOutcome(marketKey) ?? normalizeOutcome(selection);
}

function deriveActualOutcome(
  homeScore: number | null,
  awayScore: number | null,
): ActualOutcome | null {
  if (homeScore === null || awayScore === null) return null;
  if (homeScore > awayScore) return "HOME";
  if (awayScore > homeScore) return "AWAY";
  return "DRAW";
}

function calculateProbabilityError(
  probability: number,
  result: PredictionSettlement,
): number {
  if (result === "VOID") return 0;
  return round(result === "WON" ? 100 - probability : probability);
}

function isInsideBucket(value: number, bucket: BucketDefinition): boolean {
  if (value < bucket.minimum) return false;
  return bucket.maximum === null || value < bucket.maximum;
}

function buildBuckets(
  predictions: EvaluatedPrediction[],
  readValue: (prediction: EvaluatedPrediction) => number,
): PerformanceBucket[] {
  return BUCKETS.map((bucket) => {
    const rows = predictions.filter((prediction) =>
      isInsideBucket(readValue(prediction), bucket),
    );
    const won = rows.filter((prediction) => prediction.result === "WON").length;
    const lost = rows.filter((prediction) => prediction.result === "LOST").length;
    const voided = rows.filter((prediction) => prediction.result === "VOID").length;
    const settled = won + lost;
    const averageValue = average(rows.map(readValue));
    const actualAccuracy = percentage(won, settled);

    return {
      label: bucket.label,
      minimum: bucket.minimum,
      maximum: bucket.maximum,
      totalPredictions: rows.length,
      settledPredictions: settled,
      wonPredictions: won,
      lostPredictions: lost,
      voidPredictions: voided,
      averageValue,
      actualAccuracy,
      calibrationGap: round(actualAccuracy - averageValue),
    };
  });
}

function buildMarketPerformance(
  predictions: EvaluatedPrediction[],
): MarketPerformance[] {
  const grouped = new Map<string, EvaluatedPrediction[]>();

  for (const prediction of predictions) {
    const current = grouped.get(prediction.marketKey) ?? [];
    current.push(prediction);
    grouped.set(prediction.marketKey, current);
  }

  return [...grouped.entries()]
    .map(([marketKey, rows]) => {
      const won = rows.filter((prediction) => prediction.result === "WON").length;
      const lost = rows.filter((prediction) => prediction.result === "LOST").length;
      const voided = rows.filter((prediction) => prediction.result === "VOID").length;
      const settled = won + lost;

      return {
        marketKey,
        market: rows[0]?.market ?? marketKey,
        totalPredictions: rows.length,
        settledPredictions: settled,
        wonPredictions: won,
        lostPredictions: lost,
        voidPredictions: voided,
        accuracy: percentage(won, settled),
        averageProbability: average(
          rows.map((prediction) => prediction.predictedProbability),
        ),
        averageConfidence: average(
          rows.map((prediction) => prediction.confidenceScore),
        ),
      };
    })
    .sort((left, right) => {
      if (right.settledPredictions !== left.settledPredictions) {
        return right.settledPredictions - left.settledPredictions;
      }
      return right.accuracy - left.accuracy;
    });
}

function createEmptySummary(): PredictionEvaluationSummary {
  return {
    totalPredictions: 0,
    settledPredictions: 0,
    wonPredictions: 0,
    lostPredictions: 0,
    voidPredictions: 0,
    correctPredictions: 0,
    incorrectPredictions: 0,
    accuracy: 0,
    averagePredictedProbability: 0,
    averageWinningProbability: 0,
    averageConfidence: 0,
    averageFairOdds: null,
    homePredictions: 0,
    homeCorrect: 0,
    homeAccuracy: 0,
    drawPredictions: 0,
    drawCorrect: 0,
    drawAccuracy: 0,
    awayPredictions: 0,
    awayCorrect: 0,
    awayAccuracy: 0,
    highConfidencePredictions: 0,
    highConfidenceCorrect: 0,
    highConfidenceAccuracy: 0,
    mediumConfidencePredictions: 0,
    mediumConfidenceCorrect: 0,
    mediumConfidenceAccuracy: 0,
    lowConfidencePredictions: 0,
    lowConfidenceCorrect: 0,
    lowConfidenceAccuracy: 0,
    probabilityBuckets: buildBuckets([], (prediction) => prediction.predictedProbability),
    confidenceBuckets: buildBuckets([], (prediction) => prediction.confidenceScore),
    marketPerformance: [],
  };
}

function confidenceSummary(
  predictions: EvaluatedPrediction[],
  minimum: number,
  maximum: number | null,
): { count: number; accuracy: number } {
  const rows = predictions.filter((prediction) => {
    if (prediction.confidenceScore < minimum) return false;
    return maximum === null || prediction.confidenceScore < maximum;
  });
  const won = rows.filter((prediction) => prediction.result === "WON").length;
  const lost = rows.filter((prediction) => prediction.result === "LOST").length;
  return { count: rows.length, accuracy: percentage(won, won + lost) };
}

export async function evaluatePredictions(
  limit = 500,
  seasonYear?: number,
  categories?: string[],
  kickoffRange?: { from?: Date; to?: Date },
): Promise<PredictionEvaluationResult> {
  const archived = await prisma.smartPickHistory.findMany({
    where: {
      result: { in: ["WON", "LOST", "VOID"] },
      ...(categories && categories.length > 0
        ? { category: { in: categories } }
        : {}),
      ...(kickoffRange?.from || kickoffRange?.to
        ? {
            kickoffAt: {
              ...(kickoffRange.from ? { gte: kickoffRange.from } : {}),
              ...(kickoffRange.to ? { lte: kickoffRange.to } : {}),
            },
          }
        : {}),
      ...(seasonYear === undefined
        ? {}
        : {
            match: {
              season: {
                year: seasonYear,
              },
            },
          }),
    },
    orderBy: [{ kickoffAt: "desc" }, { rank: "asc" }],
    take: limit,
    select: {
      id: true,
      matchId: true,
      leagueName: true,
      kickoffAt: true,
      homeTeam: true,
      awayTeam: true,
      marketKey: true,
      category: true,
      market: true,
      selection: true,
      probability: true,
      fairOdds: true,
      marketOdds: true,
      reliabilityScore: true,
      dataQualityScore: true,
      tier: true,
      actualHomeScore: true,
      actualAwayScore: true,
      result: true,
      rank: true,
      modelName: true,
      modelVersion: true,
      publishedAt: true,
      settledAt: true,
    },
  });

  const predictions: EvaluatedPrediction[] = archived.flatMap((row) => {
    const result = normalizeResult(row.result);
    if (!result) return [];

    const predictedOutcome = derivePredictedOutcome(
      row.marketKey,
      row.selection,
    );
    const actualOutcome = deriveActualOutcome(
      row.actualHomeScore,
      row.actualAwayScore,
    );

    return [{
      id: row.id,
      matchId: row.matchId,
      leagueName: row.leagueName,
      kickoffAt: row.kickoffAt,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      marketKey: row.marketKey,
      category: row.category,
      market: row.market,
      selection: row.selection,
      predictedOutcome,
      predictedProbability: row.probability,
      fairOdds: row.fairOdds,
      marketOdds: row.marketOdds,
      confidenceScore: row.reliabilityScore,
      dataQualityScore: row.dataQualityScore,
      tier: row.tier,
      actualHomeScore: row.actualHomeScore,
      actualAwayScore: row.actualAwayScore,
      actualOutcome,
      isCorrect: result === "WON",
      probabilityError: calculateProbabilityError(row.probability, result),
      result,
      rank: row.rank,
      modelName: row.modelName,
      modelVersion: row.modelVersion,
      publishedAt: row.publishedAt,
      settledAt: row.settledAt,
    }];
  });

  if (predictions.length === 0) {
    return { summary: createEmptySummary(), predictions: [] };
  }

  const won = predictions.filter((prediction) => prediction.result === "WON").length;
  const lost = predictions.filter((prediction) => prediction.result === "LOST").length;
  const voided = predictions.filter((prediction) => prediction.result === "VOID").length;
  const settled = won + lost;
  const high = confidenceSummary(predictions, 70, null);
  const medium = confidenceSummary(predictions, 50, 70);
  const low = confidenceSummary(predictions, 0, 50);
  const legacySettled = predictions.filter(
    (prediction) => prediction.result !== "VOID",
  );
  const outcomeSummary = (outcome: ActualOutcome) => {
    const rows = legacySettled.filter(
      (prediction) => prediction.predictedOutcome === outcome,
    );
    const correct = rows.filter((prediction) => prediction.isCorrect).length;
    return {
      predictions: rows.length,
      correct,
      accuracy: percentage(correct, rows.length),
    };
  };
  const home = outcomeSummary("HOME");
  const draw = outcomeSummary("DRAW");
  const away = outcomeSummary("AWAY");
  const averagePredictedProbability = average(
    predictions.map((prediction) => prediction.predictedProbability),
  );
  const fairOdds = predictions
    .map((prediction) => prediction.fairOdds)
    .filter((value): value is number => value !== null);

  return {
    summary: {
      totalPredictions: predictions.length,
      settledPredictions: settled,
      wonPredictions: won,
      lostPredictions: lost,
      voidPredictions: voided,
      correctPredictions: won,
      incorrectPredictions: lost,
      accuracy: percentage(won, settled),
      averagePredictedProbability,
      averageWinningProbability: averagePredictedProbability,
      averageConfidence: average(
        predictions.map((prediction) => prediction.confidenceScore),
      ),
      averageFairOdds: fairOdds.length > 0 ? average(fairOdds) : null,
      homePredictions: home.predictions,
      homeCorrect: home.correct,
      homeAccuracy: home.accuracy,
      drawPredictions: draw.predictions,
      drawCorrect: draw.correct,
      drawAccuracy: draw.accuracy,
      awayPredictions: away.predictions,
      awayCorrect: away.correct,
      awayAccuracy: away.accuracy,
      highConfidencePredictions: high.count,
      highConfidenceCorrect: predictions.filter(
        (prediction) =>
          prediction.confidenceScore >= 70 && prediction.result === "WON",
      ).length,
      highConfidenceAccuracy: high.accuracy,
      mediumConfidencePredictions: medium.count,
      mediumConfidenceCorrect: predictions.filter(
        (prediction) =>
          prediction.confidenceScore >= 50 &&
          prediction.confidenceScore < 70 &&
          prediction.result === "WON",
      ).length,
      mediumConfidenceAccuracy: medium.accuracy,
      lowConfidencePredictions: low.count,
      lowConfidenceCorrect: predictions.filter(
        (prediction) =>
          prediction.confidenceScore < 50 && prediction.result === "WON",
      ).length,
      lowConfidenceAccuracy: low.accuracy,
      probabilityBuckets: buildBuckets(
        predictions,
        (prediction) => prediction.predictedProbability,
      ),
      confidenceBuckets: buildBuckets(
        predictions,
        (prediction) => prediction.confidenceScore,
      ),
      marketPerformance: buildMarketPerformance(predictions),
    },
    predictions,
  };
}
