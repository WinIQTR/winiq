import type {
  MatchRatingEdge,
  MatchRatingResult,
} from "@/modules/rating-engine";

export type MatchOutcome = "HOME" | "DRAW" | "AWAY";

export type FairOdds = {
  home: number;
  draw: number;
  away: number;
};

export type OutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
};

export type ProbabilityConfidenceLevel =
  | "VERY_LOW"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

export type MatchProbabilityResult = {
  match: MatchRatingResult["match"];

  model: {
    name: "rating-logistic-v0.1";
    version: "0.1";
    isCalibrated: false;
  };

  rating: {
    homeOverall: number | null;
    awayOverall: number | null;
    rawDifference: number | null;
    homeAdvantage: number;
    adjustedDifference: number | null;
    ratingEdge: MatchRatingEdge;
  };

  probabilities: OutcomeProbabilities;
  fairOdds: FairOdds;

  predictedOutcome: MatchOutcome | null;
  predictedProbability: number | null;

  confidenceScore: number;
  confidenceLevel: ProbabilityConfidenceLevel;

  warnings: string[];
};