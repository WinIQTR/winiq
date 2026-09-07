import { MatchStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateMatchScore,
  type MatchEdge,
} from "@/modules/scoring-engine";

export type ActualMatchResult = "HOME" | "DRAW" | "AWAY";

export type BacktestEdgeSummary = {
  edge: MatchEdge;
  total: number;
  correct: number;
  incorrect: number;
  accuracyPercentage: number | null;
  homeWins: number;
  draws: number;
  awayWins: number;
  averageScoreDifference: number | null;
  averageConfidenceScore: number | null;
};

export type BacktestConfidenceBucket = {
  minimum: number;
  maximum: number;
  label: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracyPercentage: number | null;
};

export type BacktestDifferenceBucket = {
  minimum: number;
  maximum: number | null;
  label: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracyPercentage: number | null;
};

export type SeasonBacktestFailure = {
  matchId: number;
  message: string;
};

export type SeasonBacktestMatchResult = {
  matchId: number;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  actualScore: string;
  actualResult: ActualMatchResult;
  homeFeatureScore: number | null;
  awayFeatureScore: number | null;
  scoreDifference: number | null;
  confidenceScore: number;
  edge: MatchEdge;
  predictedResult: ActualMatchResult | null;
  isCorrect: boolean | null;
};

export type SeasonBacktestResult = {
  leagueApiId: number;
  seasonYear: number;
  model: {
    name: string | null;
    version: string | null;
  };
  matchesFound: number;
  matchesProcessed: number;
  matchesEvaluated: number;
  matchesSkipped: number;
  matchesFailed: number;
  correctPredictions: number;
  incorrectPredictions: number;
  overallAccuracyPercentage: number | null;
  actualHomeWins: number;
  actualDraws: number;
  actualAwayWins: number;
  edgeSummaries: BacktestEdgeSummary[];
  confidenceBuckets: BacktestConfidenceBucket[];
  differenceBuckets: BacktestDifferenceBucket[];
  failures: SeasonBacktestFailure[];
  matches: SeasonBacktestMatchResult[];
};

type MutableEdgeSummary = {
  total: number;
  correct: number;
  incorrect: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  scoreDifferenceTotal: number;
  scoreDifferenceCount: number;
  confidenceTotal: number;
};

type MutableBucket = {
  total: number;
  correct: number;
  incorrect: number;
};

const ALL_EDGES: MatchEdge[] = [
  "STRONG_HOME",
  "HOME",
  "BALANCED",
  "AWAY",
  "STRONG_AWAY",
  "INSUFFICIENT_DATA",
];

const CONFIDENCE_BUCKETS = [
  { minimum: 0, maximum: 39.99, label: "0–39" },
  { minimum: 40, maximum: 49.99, label: "40–49" },
  { minimum: 50, maximum: 59.99, label: "50–59" },
  { minimum: 60, maximum: 69.99, label: "60–69" },
  { minimum: 70, maximum: 79.99, label: "70–79" },
  { minimum: 80, maximum: 89.99, label: "80–89" },
  { minimum: 90, maximum: 100, label: "90–100" },
] as const;

const DIFFERENCE_BUCKETS = [
  { minimum: 0, maximum: 2.99, label: "0–2.99" },
  { minimum: 3, maximum: 6.99, label: "3–6.99" },
  { minimum: 7, maximum: 9.99, label: "7–9.99" },
  { minimum: 10, maximum: 14.99, label: "10–14.99" },
  { minimum: 15, maximum: 19.99, label: "15–19.99" },
  { minimum: 20, maximum: null, label: "20+" },
] as const;

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentage(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator === 0) {
    return null;
  }

  return round((numerator / denominator) * 100);
}

function getActualResult(options: {
  homeScore: number;
  awayScore: number;
}): ActualMatchResult {
  if (options.homeScore > options.awayScore) {
    return "HOME";
  }

  if (options.homeScore < options.awayScore) {
    return "AWAY";
  }

  return "DRAW";
}

function getPredictedResult(
  edge: MatchEdge,
): ActualMatchResult | null {
  switch (edge) {
    case "STRONG_HOME":
    case "HOME":
      return "HOME";

    case "STRONG_AWAY":
    case "AWAY":
      return "AWAY";

    /*
     * BALANCED sınıfını şimdilik DRAW tahmini saymıyoruz.
     * Çünkü skorların yakın olması, otomatik olarak beraberlik
     * olasılığının en yüksek olduğu anlamına gelmez.
     */
    case "BALANCED":
    case "INSUFFICIENT_DATA":
    default:
      return null;
  }
}

function createMutableEdgeSummaries(): Map<
  MatchEdge,
  MutableEdgeSummary
> {
  return new Map(
    ALL_EDGES.map((edge) => [
      edge,
      {
        total: 0,
        correct: 0,
        incorrect: 0,
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        scoreDifferenceTotal: 0,
        scoreDifferenceCount: 0,
        confidenceTotal: 0,
      },
    ]),
  );
}

function createMutableBuckets<T extends readonly unknown[]>(
  bucketDefinitions: T,
): MutableBucket[] {
  return bucketDefinitions.map(() => ({
    total: 0,
    correct: 0,
    incorrect: 0,
  }));
}

function findConfidenceBucketIndex(
  confidenceScore: number,
): number {
  return CONFIDENCE_BUCKETS.findIndex(
    (bucket) =>
      confidenceScore >= bucket.minimum &&
      confidenceScore <= bucket.maximum,
  );
}

function findDifferenceBucketIndex(
  absoluteDifference: number,
): number {
  return DIFFERENCE_BUCKETS.findIndex(
    (bucket) =>
      absoluteDifference >= bucket.minimum &&
      (bucket.maximum === null ||
        absoluteDifference <= bucket.maximum),
  );
}

export async function runSeasonBacktest(options: {
  leagueApiId: number;
  seasonYear: number;
}): Promise<SeasonBacktestResult> {
  const { leagueApiId, seasonYear } = options;

  if (!Number.isInteger(leagueApiId) || leagueApiId <= 0) {
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

  const matches = await prisma.match.findMany({
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

  const edgeSummaries = createMutableEdgeSummaries();

  const confidenceBucketValues =
    createMutableBuckets(CONFIDENCE_BUCKETS);

  const differenceBucketValues =
    createMutableBuckets(DIFFERENCE_BUCKETS);

  const failures: SeasonBacktestFailure[] = [];
  const matchResults: SeasonBacktestMatchResult[] = [];

  let matchesProcessed = 0;
  let matchesEvaluated = 0;
  let matchesSkipped = 0;
  let matchesFailed = 0;

  let correctPredictions = 0;
  let incorrectPredictions = 0;

  let actualHomeWins = 0;
  let actualDraws = 0;
  let actualAwayWins = 0;

  let modelName: string | null = null;
  let modelVersion: string | null = null;

  for (const match of matches) {
    try {
      if (
        match.homeScore === null ||
        match.awayScore === null
      ) {
        matchesSkipped += 1;
        continue;
      }

      const scoreResult = await calculateMatchScore(
        match.id,
      );

      matchesProcessed += 1;

      modelName ??= scoreResult.model.name;
      modelVersion ??= scoreResult.model.version;

      const actualResult = getActualResult({
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      });

      switch (actualResult) {
        case "HOME":
          actualHomeWins += 1;
          break;
        case "DRAW":
          actualDraws += 1;
          break;
        case "AWAY":
          actualAwayWins += 1;
          break;
      }

      const predictedResult = getPredictedResult(
        scoreResult.edge,
      );

      const isCorrect =
        predictedResult === null
          ? null
          : predictedResult === actualResult;

      const mutableEdge =
        edgeSummaries.get(scoreResult.edge);

      if (!mutableEdge) {
        throw new Error(
          `Bilinmeyen edge değeri: ${scoreResult.edge}`,
        );
      }

      mutableEdge.total += 1;
      mutableEdge.confidenceTotal +=
        scoreResult.combinedConfidenceScore;

      if (scoreResult.scoreDifference !== null) {
        mutableEdge.scoreDifferenceTotal +=
          scoreResult.scoreDifference;
        mutableEdge.scoreDifferenceCount += 1;
      }

      switch (actualResult) {
        case "HOME":
          mutableEdge.homeWins += 1;
          break;
        case "DRAW":
          mutableEdge.draws += 1;
          break;
        case "AWAY":
          mutableEdge.awayWins += 1;
          break;
      }

      if (isCorrect !== null) {
        matchesEvaluated += 1;

        if (isCorrect) {
          correctPredictions += 1;
          mutableEdge.correct += 1;
        } else {
          incorrectPredictions += 1;
          mutableEdge.incorrect += 1;
        }

        const confidenceBucketIndex =
          findConfidenceBucketIndex(
            scoreResult.combinedConfidenceScore,
          );

        if (confidenceBucketIndex >= 0) {
          const bucket =
            confidenceBucketValues[
              confidenceBucketIndex
            ];

          bucket.total += 1;

          if (isCorrect) {
            bucket.correct += 1;
          } else {
            bucket.incorrect += 1;
          }
        }

        if (scoreResult.scoreDifference !== null) {
          const differenceBucketIndex =
            findDifferenceBucketIndex(
              Math.abs(scoreResult.scoreDifference),
            );

          if (differenceBucketIndex >= 0) {
            const bucket =
              differenceBucketValues[
                differenceBucketIndex
              ];

            bucket.total += 1;

            if (isCorrect) {
              bucket.correct += 1;
            } else {
              bucket.incorrect += 1;
            }
          }
        }
      }

      matchResults.push({
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        actualScore:
          `${match.homeScore} - ${match.awayScore}`,
        actualResult,
        homeFeatureScore: scoreResult.home.score,
        awayFeatureScore: scoreResult.away.score,
        scoreDifference:
          scoreResult.scoreDifference,
        confidenceScore:
          scoreResult.combinedConfidenceScore,
        edge: scoreResult.edge,
        predictedResult,
        isCorrect,
      });
    } catch (error) {
      matchesFailed += 1;

      failures.push({
        matchId: match.id,
        message:
          error instanceof Error
            ? error.message
            : "Bilinmeyen backtest hatası.",
      });
    }
  }

  const finalizedEdgeSummaries =
    ALL_EDGES.map<BacktestEdgeSummary>((edge) => {
      const summary = edgeSummaries.get(edge);

      if (!summary) {
        throw new Error(
          `${edge} edge özeti bulunamadı.`,
        );
      }

      const evaluatedTotal =
        summary.correct + summary.incorrect;

      return {
        edge,
        total: summary.total,
        correct: summary.correct,
        incorrect: summary.incorrect,
        accuracyPercentage: percentage(
          summary.correct,
          evaluatedTotal,
        ),
        homeWins: summary.homeWins,
        draws: summary.draws,
        awayWins: summary.awayWins,
        averageScoreDifference:
          summary.scoreDifferenceCount > 0
            ? round(
                summary.scoreDifferenceTotal /
                  summary.scoreDifferenceCount,
              )
            : null,
        averageConfidenceScore:
          summary.total > 0
            ? round(
                summary.confidenceTotal /
                  summary.total,
              )
            : null,
      };
    });

  const finalizedConfidenceBuckets =
    CONFIDENCE_BUCKETS.map<BacktestConfidenceBucket>(
      (definition, index) => {
        const values =
          confidenceBucketValues[index];

        return {
          ...definition,
          total: values.total,
          correct: values.correct,
          incorrect: values.incorrect,
          accuracyPercentage: percentage(
            values.correct,
            values.total,
          ),
        };
      },
    );

  const finalizedDifferenceBuckets =
    DIFFERENCE_BUCKETS.map<BacktestDifferenceBucket>(
      (definition, index) => {
        const values =
          differenceBucketValues[index];

        return {
          ...definition,
          total: values.total,
          correct: values.correct,
          incorrect: values.incorrect,
          accuracyPercentage: percentage(
            values.correct,
            values.total,
          ),
        };
      },
    );

  return {
    leagueApiId,
    seasonYear,
    model: {
      name: modelName,
      version: modelVersion,
    },
    matchesFound: matches.length,
    matchesProcessed,
    matchesEvaluated,
    matchesSkipped,
    matchesFailed,
    correctPredictions,
    incorrectPredictions,
    overallAccuracyPercentage: percentage(
      correctPredictions,
      matchesEvaluated,
    ),
    actualHomeWins,
    actualDraws,
    actualAwayWins,
    edgeSummaries: finalizedEdgeSummaries,
    confidenceBuckets: finalizedConfidenceBuckets,
    differenceBuckets: finalizedDifferenceBuckets,
    failures,
    matches: matchResults,
  };
}