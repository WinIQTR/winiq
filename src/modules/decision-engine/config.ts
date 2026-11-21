/**
 * Decision-engine thresholds (advisory). Tuned on validation only — examples,
 * not claimed optimal. Adapted from Reymes decision_engine.yml (MIT).
 */

import type { DevigMethod } from "@/modules/decision-engine/devig";

export type MarketActivationKey =
  | "match_winner"
  | "over_under_2_5"
  | "btts"
  | "correct_score"
  | "asian_handicap"
  | "other";

export type MarketActivationProfile = {
  enabled: boolean;
  minimumProbabilityEdge: number;
  minimumConservativeEv: number;
  minimumOdds: number;
  maximumOdds: number;
  minimumHistoricalSamples: number;
  minimumModelProbability?: number;
};

export type DecisionEngineConfig = {
  requireFreshFixtures: boolean;
  requireTimestampedOdds: boolean;
  allowNoBet: boolean;
  minimumDataQuality: number;
  maximumModelDisagreement: number;
  minimumHistoricalSamples: number;
  maxFixtureStalenessHours: number;
  maxOddsStalenessHours: number;
  probabilitySumTolerance: number;
  uncertainty: {
    baseCalibrationError: number;
    disagreementWeight: number;
    dataQualityWeight: number;
    sampleWeight: number;
    maxUncertaintyBuffer: number;
  };
  devigMethod: DevigMethod;
  markets: Record<MarketActivationKey, MarketActivationProfile>;
  exposure: {
    maximumQualifiedSelectionsPerDay: number;
    maximumPrimarySelectionsPerMatch: number;
    maximumHypotheticalFractionPerSelection: number;
    maximumHypotheticalDailyFraction: number;
    maximumLeagueDailyFraction: number;
    maximumCorrelatedGroupFraction: number;
  };
  betModes: {
    smart: BetModeProfile;
    highReturn: BetModeProfile;
  };
};

export type BetModeProfile = {
  enabled: boolean;
  minimumDataQuality: number;
  maximumModelDisagreement: number;
  minimumHistoricalSamples: number;
  minimumProbability: number;
  minimumConservativeEv: number;
  minimumOdds: number;
  maximumOdds: number;
  requireModelSupportCount: number;
  allowCorrectScore: boolean;
};

export const DEFAULT_DECISION_ENGINE_CONFIG: DecisionEngineConfig = {
  requireFreshFixtures: true,
  requireTimestampedOdds: true,
  allowNoBet: true,
  minimumDataQuality: 0.9,
  maximumModelDisagreement: 0.1,
  minimumHistoricalSamples: 300,
  maxFixtureStalenessHours: 72,
  maxOddsStalenessHours: 24,
  probabilitySumTolerance: 0.02,
  uncertainty: {
    baseCalibrationError: 0.02,
    disagreementWeight: 0.5,
    dataQualityWeight: 0.1,
    sampleWeight: 0.05,
    maxUncertaintyBuffer: 0.15,
  },
  devigMethod: "shin",
  markets: {
    match_winner: {
      enabled: true,
      minimumProbabilityEdge: 0.04,
      minimumConservativeEv: 0.03,
      minimumOdds: 1.5,
      maximumOdds: 6,
      minimumHistoricalSamples: 300,
    },
    over_under_2_5: {
      enabled: true,
      minimumProbabilityEdge: 0.035,
      minimumConservativeEv: 0.025,
      minimumOdds: 1.5,
      maximumOdds: 3.5,
      minimumHistoricalSamples: 300,
    },
    btts: {
      enabled: true,
      minimumProbabilityEdge: 0.035,
      minimumConservativeEv: 0.025,
      minimumOdds: 1.5,
      maximumOdds: 3.5,
      minimumHistoricalSamples: 300,
    },
    correct_score: {
      enabled: false,
      minimumProbabilityEdge: 0.025,
      minimumConservativeEv: 0.08,
      minimumModelProbability: 0.07,
      minimumOdds: 4,
      maximumOdds: 41,
      minimumHistoricalSamples: 1000,
    },
    asian_handicap: {
      enabled: true,
      minimumProbabilityEdge: 0.035,
      minimumConservativeEv: 0.025,
      minimumOdds: 1.55,
      maximumOdds: 2.8,
      minimumHistoricalSamples: 250,
    },
    other: {
      enabled: true,
      minimumProbabilityEdge: 0.04,
      minimumConservativeEv: 0.03,
      minimumOdds: 1.5,
      maximumOdds: 5,
      minimumHistoricalSamples: 300,
    },
  },
  exposure: {
    maximumQualifiedSelectionsPerDay: 3,
    maximumPrimarySelectionsPerMatch: 1,
    maximumHypotheticalFractionPerSelection: 0.005,
    maximumHypotheticalDailyFraction: 0.015,
    maximumLeagueDailyFraction: 0.01,
    maximumCorrelatedGroupFraction: 0.005,
  },
  betModes: {
    smart: {
      enabled: true,
      minimumDataQuality: 0.92,
      maximumModelDisagreement: 0.08,
      minimumHistoricalSamples: 400,
      minimumProbability: 0.48,
      minimumConservativeEv: 0.02,
      minimumOdds: 1.35,
      maximumOdds: 2.75,
      requireModelSupportCount: 1,
      allowCorrectScore: false,
    },
    highReturn: {
      enabled: true,
      minimumDataQuality: 0.9,
      maximumModelDisagreement: 0.1,
      minimumHistoricalSamples: 300,
      minimumProbability: 0.18,
      minimumConservativeEv: 0.05,
      minimumOdds: 3,
      maximumOdds: 12,
      requireModelSupportCount: 2,
      allowCorrectScore: true,
    },
  },
};

export function resolveMarketActivationKey(
  marketKey: string,
): MarketActivationKey {
  const key = marketKey.toLowerCase();
  if (
    key.includes("correct_score") ||
    key.includes("exact_score") ||
    key.includes("cs_")
  ) {
    return "correct_score";
  }
  if (
    key.includes("match_winner") ||
    key.includes("1x2") ||
    key === "home" ||
    key === "draw" ||
    key === "away" ||
    key.includes("full_time_result")
  ) {
    return "match_winner";
  }
  if (key.includes("btts") || key.includes("both_teams")) return "btts";
  if (
    key.includes("over_under") ||
    key.includes("ou_2_5") ||
    key.includes("totals_2_5") ||
    key.includes("goals_ou")
  ) {
    return "over_under_2_5";
  }
  if (key.includes("asian") || key.includes("handicap")) {
    return "asian_handicap";
  }
  return "other";
}
