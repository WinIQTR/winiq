export type GoalExpectation = {
  home: number;
  away: number;
};

export type ScoreProbability = {
  homeGoals: number;
  awayGoals: number;
  probability: number;
};

export type GoalOutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
};

export type BttsProbabilities = {
  yes: number;
  no: number;
};

export type GoalLineProbability = {
  line: number;
  over: number;
  under: number;
};

export type GoalProbabilityModelConfig = {
  smoothingMatches?: number;
  recencyDecay?: number;
  dixonColesRho?: number;
};

export type GoalProbabilityResolvedConfig = {
  smoothingMatches: number;
  recencyDecay: number;
  dixonColesRho: number;
};

/*
 * Poisson modelinin tahmin sırasında
 * gerçekten ne kadar historical veriye
 * sahip olduğunu production katmanına
 * açık şekilde taşır.
 */
export type GoalProbabilityDataQuality = {
  leagueMatches: number;

  homeVenueMatches: number;

  awayVenueMatches: number;

  minimumVenueMatches: number;

  averageVenueMatches: number;
};

export type GoalProbabilityResult = {
  matchId: number;

  expectedGoals:
    GoalExpectation;

  scoreProbabilities:
    ScoreProbability[];

  outcomeProbabilities:
    GoalOutcomeProbabilities;

  btts:
    BttsProbabilities;

  totals:
    GoalLineProbability[];

  mostLikelyScores:
    ScoreProbability[];

  dataQuality:
    GoalProbabilityDataQuality;

  model: {
    name: string;
    version: string;

    configuration:
      GoalProbabilityResolvedConfig;
  };

  warnings: string[];
};