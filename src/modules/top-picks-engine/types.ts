import type {
  MarketSelection,
} from "@/modules/market-engine";

export type ReliabilityTier =
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type MarketReliabilityProfile = {
  key: string;

  historicalSamples: number;

  averageProbability: number;
  historicalHitRate: number;

  calibrationGap: number;
  brier: number;

  samples70: number;
  hit70: number | null;

  samples80: number;
  hit80: number | null;

  samples90: number;
  hit90: number | null;
};

export type RankedMarketPick = {
  rank: number;

  key: string;

  category:
    MarketSelection["category"];

  market: string;
  selection: string;

  probability: number;
  fairOdds: number | null;

  historicalHitRate: number | null;
  historicalSamples: number;

  thresholdHitRate: number | null;
  thresholdSamples: number;

  calibrationGap: number | null;
  brier: number | null;

  reliabilityScore: number;
  pickScore: number;

  tier:
    ReliabilityTier;

  reasons: string[];
};

export type TopPicksResult = {
  matchId: number;

  picks:
    RankedMarketPick[];

  consideredSelections: number;
  eligibleSelections: number;

  model: {
    name: string;
    version: string;
  };

  warnings: string[];
};

export type TopPicksOptions = {
  limit?: number;

  minimumProbability?: number;

  minimumHistoricalSamples?: number;

  minimumFairOdds?: number;

  maximumFairOdds?: number;

  /*
   * Aynı markette kaç farklı seçim
   * gösterilebilir?
   *
   * Ör:
   * Total Goals 2.5 OVER / UNDER
   *
   * default = 1
   */
  maximumSelectionsPerMarket?: number;

  /*
   * Aynı market ailesinden Top Picks'e
   * maksimum kaç seçim alınabilir?
   *
   * Ör:
   * TOTAL_GOALS
   * TEAM_GOALS_HOME
   * TEAM_GOALS_AWAY
   *
   * default = 2
   */
  maximumSelectionsPerFamily?: number;
};