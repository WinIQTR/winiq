export {
  EARLY_FORBIDDEN_FEATURES,
  filterFeaturesForMode,
  hoursUntilKickoff,
  isFeatureAllowedInMode,
  resolvePredictionMode,
  type FeatureGateResult,
  type PredictionMode,
  type PredictionModeContext,
} from "@/modules/match-context-engine/prediction-mode";

export {
  categorizeCompetition,
  computeChronologicalElo,
  DEFAULT_ELO_CONFIG,
  eloWinProbability,
  expectedScore,
  type CompetitionCategory,
  type EloConfig,
  type EloMatchInput,
  type EloPreMatch,
} from "@/modules/match-context-engine/elo";

export {
  computeRollingForm,
  priorMatchesForTeam,
  type FormMatchRow,
  type RollingFormStats,
} from "@/modules/match-context-engine/rolling-form";

export {
  aggregateTeamScorerHistory,
  type ScorerGoalEvent,
  type TeamScorerSnapshot,
} from "@/modules/match-context-engine/scorer-features";

export {
  buildAliasIndex,
  canonicalizeMany,
  canonicalizeTeamName,
  DEFAULT_TEAM_ALIASES,
  type TeamAliasTable,
} from "@/modules/match-context-engine/team-aliases";

export {
  filterOddsHistoryAsOf,
  selectOddsAsOf,
  type AsOfOddsResult,
  type TimestampedOddsQuote,
} from "@/modules/match-context-engine/odds-asof";

export {
  crossCheckAnalyticVsMonteCarlo,
  simulateScorelines,
  type AnalyticMarkets,
  type MonteCarloCrossCheck,
  type MonteCarloMarketEstimate,
} from "@/modules/match-context-engine/monte-carlo";

export {
  normalizeWeightMap,
  PRODUCTION_ENSEMBLE_WEIGHTS,
  redistributeEnsembleWeights,
  resolveProductionBlendWeights,
  type EnsembleWeightMap,
} from "@/modules/match-context-engine/ensemble-weights";

export {
  resolveVenueContext,
  type VenueContext,
  type VenueContextInput,
} from "@/modules/match-context-engine/venue-context";

export {
  deriveGoalLineMarkets,
  HIGHLIGHTED_TOTAL_LINES,
  labelGoalLineMarket,
  type GoalLineMarketSet,
  type ScoreCell,
} from "@/modules/match-context-engine/goal-line-markets";
