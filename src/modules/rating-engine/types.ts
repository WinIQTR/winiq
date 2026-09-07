export type RatingCategory =
  | "form"
  | "attack"
  | "defense"
  | "venue"
  | "xg"
  | "shotThreat"
  | "fitness";

export type RatingFeatureContribution = {
  key: string;
  name: string;

  normalizedValue: number;

  configuredWeight: number;
  effectiveWeight: number;

  dataQualityScore: number;

  weightedContribution: number;
};

export type CategoryRating = {
  category: RatingCategory;

  /**
   * 0–100 kategori gücü.
   * Kullanılabilir veri yoksa null.
   */
  score: number | null;

  /**
   * Kategori veri güveni: 0–100.
   */
  confidenceScore: number;

  configuredWeight: number;
  availableWeight: number;
  effectiveWeight: number;

  coveragePercentage: number;

  configuredFeatureCount: number;
  usedFeatureCount: number;
  missingFeatureCount: number;

  contributions:
    RatingFeatureContribution[];
};

export type TeamRating = {
  matchId: number;
  teamId: number;
  teamName: string;

  form: number | null;
  attack: number | null;
  defense: number | null;
  venue: number | null;
  xg: number | null;
  shotThreat: number | null;
  fitness: number | null;

  overall: number | null;
  confidenceScore: number;

  calculationRunId: string;
  modelVersion: string;

  categories: CategoryRating[];
};

export type MatchRatingEdge =
  | "STRONG_HOME"
  | "HOME"
  | "BALANCED"
  | "AWAY"
  | "STRONG_AWAY"
  | "INSUFFICIENT_DATA";

export type MatchRatingResult = {
  match: {
    id: number;
    apiId: number;
    kickoffAt: Date;

    homeTeam: string;
    awayTeam: string;

    actualHomeScore: number | null;
    actualAwayScore: number | null;
  };

  home: TeamRating;
  away: TeamRating;

  ratingDifference: number | null;

  combinedConfidenceScore: number;

  edge: MatchRatingEdge;
};