import { MatchStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculate1x2Probabilities,
  type MatchOutcome,
  type ProbabilityConfidenceLevel,
} from "@/modules/probability-engine";

import type {
  ConfidencePerformanceSummary,
  ProbabilityBacktestFailure,
  ProbabilityBacktestMatch,
  ProbabilityBucketSummary,
  SeasonProbabilityBacktestResult,
  TopPredictionBucketSummary,
} from "./types";

const OUTCOMES: MatchOutcome[] = [
  "HOME",
  "DRAW",
  "AWAY",
];

const CONFIDENCE_LEVELS: ProbabilityConfidenceLevel[] = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
];

type ProbabilityBucketDefinition = {
  minimum: number;
  maximum: number;
  label: string;
};

type MutableMarketBucket = {
  total: number;
  occurred: number;
  predictedProbabilityTotal: number;
};

type MutableTopBucket = {
  total: number;
  correct: number;
  predictedProbabilityTotal: number;
};

type MutableConfidenceSummary = {
  total: number;
  correct: number;
  confidenceTotal: number;
};

function round(
  value: number,
  decimals = 4,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function percentage(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator <= 0) {
    return null;
  }

  return round(
    (numerator / denominator) * 100,
    2,
  );
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

function createProbabilityBuckets(): ProbabilityBucketDefinition[] {
  const buckets: ProbabilityBucketDefinition[] = [];

  for (
    let minimum = 0;
    minimum < 100;
    minimum += 5
  ) {
    const maximum =
      minimum === 95
        ? 100
        : minimum + 4.99;

    buckets.push({
      minimum,
      maximum,
      label:
        minimum === 95
          ? "95–100"
          : `${minimum}–${maximum.toFixed(2)}`,
    });
  }

  return buckets;
}

const PROBABILITY_BUCKETS =
  createProbabilityBuckets();

function getActualOutcome(options: {
  homeScore: number;
  awayScore: number;
}): MatchOutcome {
  if (options.homeScore > options.awayScore) {
    return "HOME";
  }

  if (options.homeScore < options.awayScore) {
    return "AWAY";
  }

  return "DRAW";
}

function getOutcomeProbability(options: {
  outcome: MatchOutcome;
  home: number;
  draw: number;
  away: number;
}): number {
  switch (options.outcome) {
    case "HOME":
      return options.home;

    case "DRAW":
      return options.draw;

    case "AWAY":
      return options.away;
  }
}

function findBucketIndex(
  probability: number,
): number {
  return PROBABILITY_BUCKETS.findIndex(
    (bucket) =>
      probability >= bucket.minimum &&
      probability <= bucket.maximum,
  );
}

function createMutableMarketBuckets(): Record<
  MatchOutcome,
  MutableMarketBucket[]
> {
  return {
    HOME: PROBABILITY_BUCKETS.map(() => ({
      total: 0,
      occurred: 0,
      predictedProbabilityTotal: 0,
    })),

    DRAW: PROBABILITY_BUCKETS.map(() => ({
      total: 0,
      occurred: 0,
      predictedProbabilityTotal: 0,
    })),

    AWAY: PROBABILITY_BUCKETS.map(() => ({
      total: 0,
      occurred: 0,
      predictedProbabilityTotal: 0,
    })),
  };
}

function createMutableTopBuckets(): MutableTopBucket[] {
  return PROBABILITY_BUCKETS.map(() => ({
    total: 0,
    correct: 0,
    predictedProbabilityTotal: 0,
  }));
}

function createMutableConfidenceSummaries(): Record<
  ProbabilityConfidenceLevel,
  MutableConfidenceSummary
> {
  return {
    VERY_LOW: {
      total: 0,
      correct: 0,
      confidenceTotal: 0,
    },

    LOW: {
      total: 0,
      correct: 0,
      confidenceTotal: 0,
    },

    MEDIUM: {
      total: 0,
      correct: 0,
      confidenceTotal: 0,
    },

    HIGH: {
      total: 0,
      correct: 0,
      confidenceTotal: 0,
    },

    VERY_HIGH: {
      total: 0,
      correct: 0,
      confidenceTotal: 0,
    },
  };
}

export async function runSeasonProbabilityBacktest(options: {
  leagueApiId: number;
  seasonYear: number;
}): Promise<SeasonProbabilityBacktestResult> {
  const {
    leagueApiId,
    seasonYear,
  } = options;

  if (
    !Number.isInteger(leagueApiId) ||
    leagueApiId <= 0
  ) {
    throw new Error(
      "leagueApiId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(seasonYear) ||
    seasonYear < 2000 ||
    seasonYear > 2100
  ) {
    throw new Error(
      "seasonYear geçerli bir yıl olmalıdır.",
    );
  }

  const matches =
    await prisma.match.findMany({
      where: {
        status: MatchStatus.FINISHED,

        homeScore: {
          not: null,
        },

        awayScore: {
          not: null,
        },

        season: {
          year: seasonYear,

          league: {
            apiId: leagueApiId,
          },
        },
      },

      select: {
        id: true,
        kickoffAt: true,
        homeScore: true,
        awayScore: true,

        homeTeam: {
          select: {
            name: true,
          },
        },

        awayTeam: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        kickoffAt: "asc",
      },
    });

  const mutableMarketBuckets =
    createMutableMarketBuckets();

  const mutableTopBuckets =
    createMutableTopBuckets();

  const mutableConfidenceSummaries =
    createMutableConfidenceSummaries();

  const matchResults: ProbabilityBacktestMatch[] = [];
  const failures: ProbabilityBacktestFailure[] = [];

  let matchesProcessed = 0;
  let matchesEvaluated = 0;
  let matchesWithoutPrediction = 0;
  let matchesFailed = 0;

  let correctPredictions = 0;
  let incorrectPredictions = 0;

  let predictedProbabilityTotal = 0;

  let brierTotal = 0;
  let logLossTotal = 0;
  let metricMatchCount = 0;

  let modelName: string | null = null;
  let modelVersion: string | null = null;
  let modelIsCalibrated = false;

  for (const match of matches) {
    try {
      if (
        match.homeScore === null ||
        match.awayScore === null
      ) {
        continue;
      }

      const result =
        await calculate1x2Probabilities(
          match.id,
        );

      matchesProcessed += 1;

      modelName ??= result.model.name;
      modelVersion ??= result.model.version;
      modelIsCalibrated =
        result.model.isCalibrated;

      const actualOutcome =
        getActualOutcome({
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        });

      for (const outcome of OUTCOMES) {
        const probability =
          getOutcomeProbability({
            outcome,
            home: result.probabilities.home,
            draw: result.probabilities.draw,
            away: result.probabilities.away,
          });

        const bucketIndex =
          findBucketIndex(probability);

        if (bucketIndex >= 0) {
          const bucket =
            mutableMarketBuckets[
              outcome
            ][bucketIndex];

          bucket.total += 1;
          bucket.predictedProbabilityTotal +=
            probability;

          if (actualOutcome === outcome) {
            bucket.occurred += 1;
          }
        }
      }

      const homeProbability =
        clamp(
          result.probabilities.home / 100,
          0.000001,
          0.999999,
        );

      const drawProbability =
        clamp(
          result.probabilities.draw / 100,
          0.000001,
          0.999999,
        );

      const awayProbability =
        clamp(
          result.probabilities.away / 100,
          0.000001,
          0.999999,
        );

      const actualHome =
        actualOutcome === "HOME" ? 1 : 0;

      const actualDraw =
        actualOutcome === "DRAW" ? 1 : 0;

      const actualAway =
        actualOutcome === "AWAY" ? 1 : 0;

      brierTotal +=
        (
          (homeProbability - actualHome) ** 2 +
          (drawProbability - actualDraw) ** 2 +
          (awayProbability - actualAway) ** 2
        ) / 3;

      const actualProbability =
        actualOutcome === "HOME"
          ? homeProbability
          : actualOutcome === "DRAW"
            ? drawProbability
            : awayProbability;

      logLossTotal +=
        -Math.log(actualProbability);

      metricMatchCount += 1;

      const isCorrect =
        result.predictedOutcome === null
          ? null
          : result.predictedOutcome ===
            actualOutcome;

      if (
        result.predictedOutcome === null ||
        result.predictedProbability === null
      ) {
        matchesWithoutPrediction += 1;
      } else {
        matchesEvaluated += 1;

        predictedProbabilityTotal +=
          result.predictedProbability;

        const topBucketIndex =
          findBucketIndex(
            result.predictedProbability,
          );

        if (topBucketIndex >= 0) {
          const bucket =
            mutableTopBuckets[
              topBucketIndex
            ];

          bucket.total += 1;

          bucket.predictedProbabilityTotal +=
            result.predictedProbability;

          if (isCorrect) {
            bucket.correct += 1;
          }
        }

        const confidence =
          mutableConfidenceSummaries[
            result.confidenceLevel
          ];

        confidence.total += 1;
        confidence.confidenceTotal +=
          result.confidenceScore;

        if (isCorrect) {
          confidence.correct += 1;
          correctPredictions += 1;
        } else {
          incorrectPredictions += 1;
        }
      }

      matchResults.push({
        matchId: match.id,
        kickoffAt: match.kickoffAt,

        homeTeam:
          match.homeTeam.name,

        awayTeam:
          match.awayTeam.name,

        actualHomeScore:
          match.homeScore,

        actualAwayScore:
          match.awayScore,

        actualOutcome,

        homeProbability:
          result.probabilities.home,

        drawProbability:
          result.probabilities.draw,

        awayProbability:
          result.probabilities.away,

        predictedOutcome:
          result.predictedOutcome,

        predictedProbability:
          result.predictedProbability,

        confidenceScore:
          result.confidenceScore,

        confidenceLevel:
          result.confidenceLevel,

        isCorrect,
      });
    } catch (error) {
      matchesFailed += 1;

      failures.push({
        matchId: match.id,

        message:
          error instanceof Error
            ? error.message
            : "Bilinmeyen Probability Backtest hatası.",
      });
    }
  }

  const marketBuckets =
    OUTCOMES.flatMap<ProbabilityBucketSummary>(
      (outcome) =>
        PROBABILITY_BUCKETS.map(
          (definition, index) => {
            const values =
              mutableMarketBuckets[
                outcome
              ][index];

            const averagePredictedProbability =
              values.total > 0
                ? round(
                    values.predictedProbabilityTotal /
                      values.total,
                    2,
                  )
                : null;

            const actualOccurrencePercentage =
              percentage(
                values.occurred,
                values.total,
              );

            return {
              outcome,

              minimumProbability:
                definition.minimum,

              maximumProbability:
                definition.maximum,

              label: definition.label,

              total: values.total,
              occurred: values.occurred,

              didNotOccur:
                values.total -
                values.occurred,

              averagePredictedProbability,

              actualOccurrencePercentage,

              calibrationDifference:
                averagePredictedProbability !== null &&
                actualOccurrencePercentage !== null
                  ? round(
                      actualOccurrencePercentage -
                        averagePredictedProbability,
                      2,
                    )
                  : null,
            };
          },
        ),
    );

  const topPredictionBuckets =
    PROBABILITY_BUCKETS.map<TopPredictionBucketSummary>(
      (definition, index) => {
        const values =
          mutableTopBuckets[index];

        const averagePredictedProbability =
          values.total > 0
            ? round(
                values.predictedProbabilityTotal /
                  values.total,
                2,
              )
            : null;

        const accuracyPercentage =
          percentage(
            values.correct,
            values.total,
          );

        return {
          minimumProbability:
            definition.minimum,

          maximumProbability:
            definition.maximum,

          label: definition.label,

          total: values.total,
          correct: values.correct,

          incorrect:
            values.total -
            values.correct,

          averagePredictedProbability,

          accuracyPercentage,

          calibrationDifference:
            averagePredictedProbability !== null &&
            accuracyPercentage !== null
              ? round(
                  accuracyPercentage -
                    averagePredictedProbability,
                  2,
                )
              : null,
        };
      },
    );

  const confidencePerformance =
    CONFIDENCE_LEVELS.map<ConfidencePerformanceSummary>(
      (confidenceLevel) => {
        const values =
          mutableConfidenceSummaries[
            confidenceLevel
          ];

        return {
          confidenceLevel,

          total: values.total,
          correct: values.correct,

          incorrect:
            values.total -
            values.correct,

          accuracyPercentage:
            percentage(
              values.correct,
              values.total,
            ),

          averageConfidenceScore:
            values.total > 0
              ? round(
                  values.confidenceTotal /
                    values.total,
                  2,
                )
              : null,
        };
      },
    );

  return {
    leagueApiId,
    seasonYear,

    model: {
      name: modelName,
      version: modelVersion,
      isCalibrated:
        modelIsCalibrated,
    },

    matchesFound: matches.length,
    matchesProcessed,
    matchesEvaluated,
    matchesWithoutPrediction,
    matchesFailed,

    correctPredictions,
    incorrectPredictions,

    overallAccuracyPercentage:
      percentage(
        correctPredictions,
        matchesEvaluated,
      ),

    averagePredictedProbability:
      matchesEvaluated > 0
        ? round(
            predictedProbabilityTotal /
              matchesEvaluated,
            2,
          )
        : null,

    brierScore:
      metricMatchCount > 0
        ? round(
            brierTotal /
              metricMatchCount,
            6,
          )
        : null,

    logLoss:
      metricMatchCount > 0
        ? round(
            logLossTotal /
              metricMatchCount,
            6,
          )
        : null,

    marketBuckets,
    topPredictionBuckets,
    confidencePerformance,

    matches: matchResults,
    failures,
  };
}