import type {
  GoalProbabilityResult,
} from "@/modules/goal-probability-engine";

import type {
  MarketEngineResult,
} from "@/modules/market-engine";

import type {
  RankedMarketPick,
} from "@/modules/top-picks-engine";

export type UpcomingPredictionStatus =
  | "READY"
  | "FAILED";

export type UpcomingPredictionMatch = {
  matchId: number;
  apiId: number;

  kickoffAt: Date;

  league: {
    id: number;
    apiId: number;
    name: string;
  };

  season: {
    id: number;
    year: number;
  };

  homeTeam: {
    id: number;
    apiId: number;
    name: string;
  };

  awayTeam: {
    id: number;
    apiId: number;
    name: string;
  };

  predictionStatus:
    UpcomingPredictionStatus;

  expectedGoals: {
    home: number;
    away: number;
  } | null;

  outcomeProbabilities: {
    home: number;
    draw: number;
    away: number;
  } | null;

  topPicks:
    RankedMarketPick[];

  marketCount: number;

  goalModel:
    GoalProbabilityResult | null;

  marketModel:
    MarketEngineResult | null;

  warnings:
    string[];

  error:
    string | null;
};

export type GenerateUpcomingPredictionsOptions = {
  from?: Date;
  to?: Date;

  daysAhead?: number;

  leagueApiIds?: number[];

  limitMatches?: number;

  picksPerMatch?: number;

  minimumPickProbability?: number;

  minimumHistoricalSamples?: number;

  minimumFairOdds?: number;

  maximumFairOdds?: number;
};

export type UpcomingPredictionsResult = {
  from: Date;
  to: Date;

  requestedLeagueApiIds:
    number[];

  matchesFound: number;

  predictionsReady: number;
  predictionsFailed: number;

  matches:
    UpcomingPredictionMatch[];

  warnings:
    string[];
};