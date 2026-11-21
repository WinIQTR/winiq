import {
  DEFAULT_DECISION_ENGINE_CONFIG,
  resolveMarketActivationKey,
  type BetModeProfile,
  type DecisionEngineConfig,
} from "@/modules/decision-engine/config";
import {
  computeUncertaintyBuffer,
  conservativeExpectedValue,
} from "@/modules/decision-engine/uncertainty";

export type BetModeId = "smart" | "high_return";

export type BetModeCandidate = {
  marketKey: string;
  decimalOdds: number;
  modelProbability: number;
  alternateProbability: number;
  dataQuality: number;
  historicalSamples: number;
  /** How many independent model views support this selection (≥1). */
  modelSupportCount: number;
};

export type BetModeEvaluation = {
  mode: BetModeId;
  qualified: boolean;
  rejectionCodes: string[];
  uncertaintyBuffer: number;
  conservativeEv: number;
  smartBetScore: number | null;
};

function profileFor(
  mode: BetModeId,
  config: DecisionEngineConfig,
): BetModeProfile {
  return mode === "smart" ? config.betModes.smart : config.betModes.highReturn;
}

export function evaluateBetMode(
  candidate: BetModeCandidate,
  mode: BetModeId,
  config: DecisionEngineConfig = DEFAULT_DECISION_ENGINE_CONFIG,
): BetModeEvaluation {
  const profile = profileFor(mode, config);
  const rejectionCodes: string[] = [];
  const family = resolveMarketActivationKey(candidate.marketKey);
  const disagreement = Math.abs(
    candidate.modelProbability - candidate.alternateProbability,
  );
  const uncertaintyBuffer = computeUncertaintyBuffer(
    {
      modelDisagreement: disagreement,
      dataQuality: candidate.dataQuality,
      historicalSamples: candidate.historicalSamples,
      minimumHistoricalSamples: profile.minimumHistoricalSamples,
    },
    config.uncertainty,
    profile.minimumHistoricalSamples,
  );
  const conservativeEv = conservativeExpectedValue(
    candidate.modelProbability,
    candidate.decimalOdds,
    uncertaintyBuffer,
  );

  if (!profile.enabled) rejectionCodes.push("MODE_DISABLED");
  if (family === "correct_score" && !profile.allowCorrectScore) {
    rejectionCodes.push("MARKET_NOT_IN_MODE");
  }
  if (!config.markets[family].enabled && family === "correct_score") {
    rejectionCodes.push("MARKET_DISABLED");
  }
  if (candidate.dataQuality < profile.minimumDataQuality) {
    rejectionCodes.push("DATA_QUALITY_TOO_LOW");
  }
  if (disagreement > profile.maximumModelDisagreement) {
    rejectionCodes.push("MODEL_DISAGREEMENT");
  }
  if (candidate.historicalSamples < profile.minimumHistoricalSamples) {
    rejectionCodes.push("SAMPLES_TOO_LOW");
  }
  if (candidate.modelProbability < profile.minimumProbability) {
    rejectionCodes.push("PROBABILITY_TOO_LOW");
  }
  if (
    candidate.decimalOdds < profile.minimumOdds ||
    candidate.decimalOdds > profile.maximumOdds
  ) {
    rejectionCodes.push("ODDS_OUT_OF_BAND");
  }
  if (conservativeEv < profile.minimumConservativeEv) {
    rejectionCodes.push("CONSERVATIVE_EV_TOO_LOW");
  }
  if (candidate.modelSupportCount < profile.requireModelSupportCount) {
    rejectionCodes.push("MODEL_SUPPORT_TOO_LOW");
  }

  const qualified = rejectionCodes.length === 0;
  const smartBetScore = qualified
    ? Math.round(
        (candidate.modelProbability * 100 +
          Math.max(0, conservativeEv) * 40 +
          (1 - disagreement) * 20) *
          10,
      ) / 10
    : null;

  return {
    mode,
    qualified,
    rejectionCodes,
    uncertaintyBuffer,
    conservativeEv,
    smartBetScore,
  };
}

export function filterByBetMode<T extends BetModeCandidate>(
  rows: readonly T[],
  mode: BetModeId,
  config: DecisionEngineConfig = DEFAULT_DECISION_ENGINE_CONFIG,
): Array<T & { betMode: BetModeEvaluation }> {
  return rows
    .map((row) => ({ ...row, betMode: evaluateBetMode(row, mode, config) }))
    .filter((row) => row.betMode.qualified)
    .sort(
      (a, b) =>
        (b.betMode.smartBetScore ?? 0) - (a.betMode.smartBetScore ?? 0) ||
        b.betMode.conservativeEv - a.betMode.conservativeEv,
    );
}
