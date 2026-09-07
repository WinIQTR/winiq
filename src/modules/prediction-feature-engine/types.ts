export type PredictionFeatureSource =
  | "CORE"
  | "H2H"
  | "SQUAD"
  | "SHOT_THREAT";

export type PredictionFeatureValue = {
  key: string;

  homeValue: number | null;
  awayValue: number | null;

  difference: number | null;

  homeQuality: number;
  awayQuality: number;

  combinedQuality: number;

  source:
    PredictionFeatureSource;
};

export type MatchPredictionFeatureVector = {
  match: {
    id: number;

    kickoffAt: Date;

    homeTeamId: number;
    awayTeamId: number;

    homeTeam: string;
    awayTeam: string;
  };

  calculationRunId: string;

  features:
    PredictionFeatureValue[];

  vector: Record<
    string,
    number | null
  >;

  quality: {
    average: number;

    minimum: number;

    featureCount: number;

    missingFeatureCount: number;
  };

  warnings: string[];
};