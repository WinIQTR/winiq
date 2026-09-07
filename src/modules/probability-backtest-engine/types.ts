import type {
  MatchOutcome,
  ProbabilityConfidenceLevel,
} from "@/modules/probability-engine";

export type ProbabilityBucketSummary = {
  outcome: MatchOutcome;
  minimumProbability: number;
  maximumProbability: number;
  label: string;

  total: number;
  occurred: number;
  didNotOccur: number;

  averagePredictedProbability: number | null;
  actualOccurrencePercentage: number | null;
  calibrationDifference: number | null;
};

export type TopPredictionBucketSummary = {
  minimumProbability: number;
  maximumProbability: number;
  label: string;

  total: number;
  correct: number;
  incorrect: number;

  averagePredictedProbability: number | null;
  accuracyPercentage: number | null;
  calibrationDifference: number | null;
};

export type ConfidencePerformanceSummary = {
  confidenceLevel: ProbabilityConfidenceLevel;

  total: number;
  correct: number;
  incorrect: number;
  accuracyPercentage: number | null;
  averageConfidenceScore: number | null;
};

export type ProbabilityBacktestMatch = {
  matchId: number;
  kickoffAt: Date;

  homeTeam: string;
  awayTeam: string;

  actualHomeScore: number;
  actualAwayScore: number;
  actualOutcome: MatchOutcome;

  homeProbability: number;
  drawProbability: number;
  awayProbability: number;

  predictedOutcome: MatchOutcome | null;
  predictedProbability: number | null;

  confidenceScore: number;
  confidenceLevel: ProbabilityConfidenceLevel;

  isCorrect: boolean | null;
};

export type ProbabilityBacktestFailure = {
  matchId: number;
  message: string;
};

export type SeasonProbabilityBacktestResult = {
  leagueApiId: number;
  seasonYear: number;

  model: {
    name: string | null;
    version: string | null;
    isCalibrated: boolean;
  };

  matchesFound: number;
  matchesProcessed: number;
  matchesEvaluated: number;
  matchesWithoutPrediction: number;
  matchesFailed: number;

  correctPredictions: number;
  incorrectPredictions: number;
  overallAccuracyPercentage: number | null;

  averagePredictedProbability: number | null;
  brierScore: number | null;
  logLoss: number | null;

  marketBuckets: ProbabilityBucketSummary[];
  topPredictionBuckets: TopPredictionBucketSummary[];
  confidencePerformance: ConfidencePerformanceSummary[];

  matches: ProbabilityBacktestMatch[];
  failures: ProbabilityBacktestFailure[];
};