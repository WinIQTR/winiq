export {
  DEFAULT_DECISION_ENGINE_CONFIG,
  resolveMarketActivationKey,
  type BetModeProfile,
  type DecisionEngineConfig,
  type MarketActivationKey,
  type MarketActivationProfile,
} from "@/modules/decision-engine/config";

export {
  compareDevigMethods,
  devig,
  devigNormalized,
  devigPower,
  devigShin,
  overround,
  toProbabilityPercents,
  type DevigMethod,
} from "@/modules/decision-engine/devig";

export {
  computeUncertaintyBuffer,
  conservativeExpectedValue,
  conservativeProbability,
  type UncertaintyInputs,
} from "@/modules/decision-engine/uncertainty";

export {
  evaluateDecision,
  isMarketEnabled,
  type DecisionCandidate,
  type DecisionResult,
  type DecisionStatus,
  type RejectionCode,
} from "@/modules/decision-engine/evaluate";

export {
  applyExposureCaps,
  type ExposureCandidate,
  type ExposureSelection,
} from "@/modules/decision-engine/exposure";

export {
  evaluateBetMode,
  filterByBetMode,
  type BetModeCandidate,
  type BetModeEvaluation,
  type BetModeId,
} from "@/modules/decision-engine/bet-modes";

export {
  binaryRowsToBootstrapObservations,
  runPairedBlockBootstrap,
  type BootstrapObservation,
  type BootstrapMetricResult,
  type PairedBootstrapReport,
} from "@/modules/decision-engine/bootstrap";

export {
  buildReliabilityDiagram,
  type ReliabilityBin,
  type ReliabilityDiagram,
} from "@/modules/decision-engine/reliability-diagram";
