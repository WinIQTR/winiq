import {
  DEFAULT_DECISION_ENGINE_CONFIG,
  resolveMarketActivationKey,
  type DecisionEngineConfig,
  type MarketActivationKey,
} from "@/modules/decision-engine/config";
import {
  computeUncertaintyBuffer,
  conservativeExpectedValue,
} from "@/modules/decision-engine/uncertainty";

export type DecisionStatus = "QUALIFIED" | "NO_BET";

export type RejectionCode =
  | "MARKET_DISABLED"
  | "DATA_QUALITY_TOO_LOW"
  | "MODEL_DISAGREEMENT"
  | "STALE_FIXTURE"
  | "STALE_ODDS"
  | "MISSING_ODDS_TIMESTAMP"
  | "ODDS_OUT_OF_BAND"
  | "EDGE_TOO_LOW"
  | "CONSERVATIVE_EV_TOO_LOW"
  | "SAMPLES_TOO_LOW"
  | "PROBABILITY_TOO_LOW";

export type DecisionCandidate = {
  marketKey: string;
  decimalOdds: number;
  /** Model probability 0–1. */
  modelProbability: number;
  /** Competing view (hybrid/market) 0–1. */
  alternateProbability: number;
  dataQuality: number;
  historicalSamples: number;
  fixtureAgeHours: number | null;
  oddsAgeHours: number | null;
  oddsTimestampPresent: boolean;
};

export type DecisionResult = {
  status: DecisionStatus;
  marketFamily: MarketActivationKey;
  rejectionCodes: RejectionCode[];
  disagreement: number;
  uncertaintyBuffer: number;
  conservativeEv: number;
  probabilityEdge: number;
};

export function evaluateDecision(
  candidate: DecisionCandidate,
  config: DecisionEngineConfig = DEFAULT_DECISION_ENGINE_CONFIG,
): DecisionResult {
  const marketFamily = resolveMarketActivationKey(candidate.marketKey);
  const market = config.markets[marketFamily];
  const rejectionCodes: RejectionCode[] = [];

  const disagreement = Math.abs(
    candidate.modelProbability - candidate.alternateProbability,
  );
  const uncertaintyBuffer = computeUncertaintyBuffer(
    {
      modelDisagreement: disagreement,
      dataQuality: candidate.dataQuality,
      historicalSamples: candidate.historicalSamples,
      minimumHistoricalSamples: market.minimumHistoricalSamples,
    },
    config.uncertainty,
    config.minimumHistoricalSamples,
  );
  const conservativeEv = conservativeExpectedValue(
    candidate.modelProbability,
    candidate.decimalOdds,
    uncertaintyBuffer,
  );
  const probabilityEdge =
    candidate.modelProbability - candidate.alternateProbability;

  if (!market.enabled) rejectionCodes.push("MARKET_DISABLED");
  if (candidate.dataQuality < config.minimumDataQuality) {
    rejectionCodes.push("DATA_QUALITY_TOO_LOW");
  }
  if (disagreement > config.maximumModelDisagreement) {
    rejectionCodes.push("MODEL_DISAGREEMENT");
  }
  if (
    config.requireFreshFixtures &&
    candidate.fixtureAgeHours !== null &&
    candidate.fixtureAgeHours > config.maxFixtureStalenessHours
  ) {
    rejectionCodes.push("STALE_FIXTURE");
  }
  if (config.requireTimestampedOdds && !candidate.oddsTimestampPresent) {
    rejectionCodes.push("MISSING_ODDS_TIMESTAMP");
  }
  if (
    candidate.oddsAgeHours !== null &&
    candidate.oddsAgeHours > config.maxOddsStalenessHours
  ) {
    rejectionCodes.push("STALE_ODDS");
  }
  if (
    candidate.decimalOdds < market.minimumOdds ||
    candidate.decimalOdds > market.maximumOdds
  ) {
    rejectionCodes.push("ODDS_OUT_OF_BAND");
  }
  if (probabilityEdge < market.minimumProbabilityEdge) {
    rejectionCodes.push("EDGE_TOO_LOW");
  }
  if (conservativeEv < market.minimumConservativeEv) {
    rejectionCodes.push("CONSERVATIVE_EV_TOO_LOW");
  }
  if (candidate.historicalSamples < market.minimumHistoricalSamples) {
    rejectionCodes.push("SAMPLES_TOO_LOW");
  }
  if (
    market.minimumModelProbability !== undefined &&
    candidate.modelProbability < market.minimumModelProbability
  ) {
    rejectionCodes.push("PROBABILITY_TOO_LOW");
  }

  const status: DecisionStatus =
    rejectionCodes.length === 0 ? "QUALIFIED" : "NO_BET";

  return {
    status,
    marketFamily,
    rejectionCodes,
    disagreement,
    uncertaintyBuffer,
    conservativeEv,
    probabilityEdge,
  };
}

export function isMarketEnabled(
  marketKey: string,
  config: DecisionEngineConfig = DEFAULT_DECISION_ENGINE_CONFIG,
): boolean {
  return config.markets[resolveMarketActivationKey(marketKey)].enabled;
}
