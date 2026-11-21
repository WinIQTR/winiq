import type { DecisionEngineConfig } from "@/modules/decision-engine/config";
import { DEFAULT_DECISION_ENGINE_CONFIG } from "@/modules/decision-engine/config";

export type UncertaintyInputs = {
  /** Absolute L1/2 gap between model views (0–1). */
  modelDisagreement: number;
  /** Data quality score 0–1. */
  dataQuality: number;
  /** Historical samples available for this market/band. */
  historicalSamples: number;
  minimumHistoricalSamples?: number;
};

/**
 * buffer = base ECE
 *   + disagreement_weight * disagreement
 *   + data_quality_weight * (1 - quality)
 *   + sample_weight * shortfall_vs_min
 * clamped to [0, max].
 */
export function computeUncertaintyBuffer(
  inputs: UncertaintyInputs,
  config: DecisionEngineConfig["uncertainty"] = DEFAULT_DECISION_ENGINE_CONFIG.uncertainty,
  minimumHistoricalSamples = DEFAULT_DECISION_ENGINE_CONFIG.minimumHistoricalSamples,
): number {
  const minSamples = inputs.minimumHistoricalSamples ?? minimumHistoricalSamples;
  const shortfall =
    minSamples <= 0
      ? 0
      : Math.max(0, (minSamples - Math.max(0, inputs.historicalSamples)) / minSamples);

  const raw =
    config.baseCalibrationError +
    config.disagreementWeight * Math.max(0, inputs.modelDisagreement) +
    config.dataQualityWeight * (1 - Math.min(1, Math.max(0, inputs.dataQuality))) +
    config.sampleWeight * shortfall;

  return Math.min(config.maxUncertaintyBuffer, Math.max(0, raw));
}

/** Conservative model probability after subtracting the uncertainty buffer. */
export function conservativeProbability(
  modelProbability01: number,
  buffer: number,
): number {
  return Math.max(0, Math.min(1, modelProbability01 - buffer));
}

/** EV using conservative probability and offered decimal odds. */
export function conservativeExpectedValue(
  modelProbability01: number,
  decimalOdds: number,
  buffer: number,
): number {
  const p = conservativeProbability(modelProbability01, buffer);
  return p * decimalOdds - 1;
}
