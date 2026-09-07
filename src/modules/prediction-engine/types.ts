import type {
  CalibrationResult,
} from "@/modules/calibration-engine";

import type {
  FairOdds,
  MatchOutcome,
  MatchProbabilityResult,
  OutcomeProbabilities,
  ProbabilityConfidenceLevel,
} from "@/modules/probability-engine";

import type {
  MatchRatingEdge,
} from "@/modules/rating-engine";

import type {
  DrawDecisionLayerResult,
} from "./draw-decision-layer";

import type {
  PoissonConfidenceResult,
} from "./poisson-confidence";

import type {
  RatingProbabilityAdjustmentResult,
} from "./rating-probability-adjustment";

export type PredictionModelStatus =
  | "EXPERIMENTAL"
  | "CALIBRATED"
  | "PRODUCTION";

export type PredictionRatingSummary = {
  modelVersion:
    string;

  homeOverall:
    number | null;

  awayOverall:
    number | null;

  ratingDifference:
    number | null;

  confidenceScore:
    number;

  edge:
    MatchRatingEdge;
};

export type MatchPredictionResult = {
  match:
    MatchProbabilityResult["match"];

  model: {
    probabilityModelName:
      string;

    probabilityModelVersion:
      string;

    calibrationProfileVersion:
      string;

    ratingModelVersion:
      string;

    goalProbabilityModelName:
      string;

    goalProbabilityModelVersion:
      string;

    drawDecisionModelVersion:
      string;

    poissonConfidenceModelVersion:
      string;

    productionModelName:
      string;

    status:
      PredictionModelStatus;
  };

  rawProbabilities:
    OutcomeProbabilities;

  calibratedProbabilities:
    OutcomeProbabilities;

  ratingAdjustedProbabilities:
    OutcomeProbabilities;

  poissonProbabilities:
    OutcomeProbabilities;

  finalProbabilities:
    OutcomeProbabilities;

  rawFairOdds:
    FairOdds;

  calibratedFairOdds:
    FairOdds;

  ratingAdjustedFairOdds:
    FairOdds;

  poissonFairOdds:
    FairOdds;

  finalFairOdds:
    FairOdds;

  rawPredictedOutcome:
    MatchOutcome | null;

  rawPredictedProbability:
    number | null;

  calibratedPredictedOutcome:
    MatchOutcome;

  calibratedPredictedProbability:
    number;

  ratingAdjustedPredictedOutcome:
    MatchOutcome;

  ratingAdjustedPredictedProbability:
    number;

  poissonPredictedOutcome:
    MatchOutcome;

  poissonPredictedProbability:
    number;

  predictedOutcome:
    MatchOutcome;

  predictedProbability:
    number;

  drawDecision:
    DrawDecisionLayerResult;

  /*
   * Production Poisson confidence.
   */
  poissonConfidence:
    PoissonConfidenceResult;

  /*
   * Bunlar legacy Probability Engine
   * confidence alanlarıdır.
   */
  probabilityConfidenceScore:
    number;

  probabilityConfidenceLevel:
    ProbabilityConfidenceLevel;

  calibrationReliabilityScore:
    number;

  ratingConfidenceScore:
    number;

  /*
   * Backward compatibility:
   *
   * Dashboard ve mevcut servisler
   * combinedConfidenceScore kullandığı
   * için alanı koruyoruz.
   *
   * V3 itibarıyla bu alan artık
   * Poisson Confidence V1 değeridir.
   */
  combinedConfidenceScore:
    number;

  combinedConfidenceLevel:
    ProbabilityConfidenceLevel;

  rating:
    PredictionRatingSummary;

  ratingAdjustment:
    RatingProbabilityAdjustmentResult;

  calibration:
    CalibrationResult;

  warnings:
    string[];
};

export type LearnedMatchPredictionResult = {
  match: {
    id:
      number;

    apiId:
      number;

    kickoffAt:
      Date;

    status:
      string;

    homeTeam:
      string;

    awayTeam:
      string;
  };

  model: {
    name:
      string;

    version:
      string;

    status:
      PredictionModelStatus;

    trainingSeasonYear:
      number;

    trainingLeagueApiId:
      number;

    featureCount:
      number;

    featureNames:
      string[];

    learningRate:
      number;

    maximumEpochs:
      number;

    l2Regularization:
      number;

    epochsCompleted:
      number;
  };

  probabilities: {
    home:
      number;

    draw:
      number;

    away:
      number;
  };

  fairOdds: {
    home:
      number;

    draw:
      number;

    away:
      number;
  };

  predictedOutcome:
    MatchOutcome;

  predictedProbability:
    number;

  confidenceScore:
    number;

  confidenceLevel:
    ProbabilityConfidenceLevel;

  featureVector:
    Record<
      string,
      number
    >;

  warnings:
    string[];
};