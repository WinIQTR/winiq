import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

export type CalibrationBucket = {
  outcome: MatchOutcome;

  minimumProbability: number;
  maximumProbability: number;
  label: string;

  sampleSize: number;
  occurred: number;

  rawOccurrencePercentage: number;
  smoothedOccurrencePercentage: number;

  averagePredictedProbability: number;
  calibrationDifference: number;

  reliabilityScore: number;
};

export type OutcomeCalibrationProfile = {
  outcome: MatchOutcome;

  totalMatches: number;
  totalOccurred: number;
  baseRatePercentage: number;

  buckets: CalibrationBucket[];
};

export type CalibrationProfile = {
  profileName: string;
  version: string;

  leagueApiId: number;
  seasonYear: number;

  sourceModelName: string | null;
  sourceModelVersion: string | null;

  createdAt: string;

  priorStrength: number;
  minimumReliableSampleSize: number;

  outcomes: Record<
    MatchOutcome,
    OutcomeCalibrationProfile
  >;
};

export type CalibratedOutcomeDetail = {
  outcome: MatchOutcome;

  rawProbability: number;
  calibratedProbability: number;

  bucketLabel: string | null;
  sampleSize: number;
  reliabilityScore: number;

  rawHistoricalRate: number | null;
  smoothedHistoricalRate: number | null;
};

export type CalibrationResult = {
  rawProbabilities: OutcomeProbabilities;
  calibratedProbabilities: OutcomeProbabilities;

  details: Record<
    MatchOutcome,
    CalibratedOutcomeDetail
  >;

  overallReliabilityScore: number;
  profileVersion: string;

  warnings: string[];
};