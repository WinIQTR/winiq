export type {
  BacktestBetInput,
  BacktestBetOutcome,
  BacktestMetrics,
  BankrollPathPoint,
  SettledBacktestBet,
  StressTestRow,
} from "@/modules/bankroll-backtest/types";

export {
  adjustSimultaneousStakes,
  applyRiskLimits,
  createBetHistory,
  DEFAULT_RISK_LIMITS,
  DEFAULT_STRATEGY_CONFIG,
  expectedValue,
  kellyFraction,
  recordSettlement,
  selectBet,
  sizeStake,
  type RiskLimitConfig,
  type SizerKind,
  type StrategyConfig,
} from "@/modules/bankroll-backtest/strategies";

export {
  istanbulDateKey,
  runBankrollSimulation,
  type SimulationResult,
} from "@/modules/bankroll-backtest/simulate";

export { calculateBacktestMetrics } from "@/modules/bankroll-backtest/metrics";
export { computeClvMetrics, type ClvMetrics } from "@/modules/bankroll-backtest/clv";
export { runOddsStressTest } from "@/modules/bankroll-backtest/stress";
export {
  chronologicalHoldoutSplit,
  evaluateStrategy,
  tuneMinEvOnHoldout,
  type EvaluateOptions,
  type HoldoutSplit,
} from "@/modules/bankroll-backtest/evaluate";
export {
  buildEquityChartSeries,
  toSparklinePoints,
  type EquityChartSeries,
} from "@/modules/bankroll-backtest/equity-chart";
export {
  couponsToBacktestInputs,
  valueBetsToBacktestInputs,
} from "@/modules/bankroll-backtest/from-value-bets";
export {
  buildBankrollBacktestReport,
  type BankrollBacktestReport,
} from "@/modules/bankroll-backtest/report";

export {
  computeYieldBootstrapCI,
  type YieldCI,
} from "@/modules/bankroll-backtest/yield-ci";
export {
  NoCommission,
  NetWinningsCommission,
  settleWithCommission,
  type CommissionModel,
} from "@/modules/bankroll-backtest/commission";
export {
  runWalkForward,
  type WalkForwardFold,
  type WalkForwardResult,
} from "@/modules/bankroll-backtest/walk-forward";
export {
  StrategyLedger,
  type RejectionReason,
  type StrategyCommitment,
  type StrategyRejection,
} from "@/modules/bankroll-backtest/rejection-log";
export {
  kellyBackFraction,
  kellyBackStake,
  kellyLayFraction,
  kellyLayStake,
} from "@/modules/bankroll-backtest/lay-kelly";
export {
  detectOneXTwoArbitrage,
  type ArbitrageOpportunity,
  type OneXTwoOdds,
} from "@/modules/bankroll-backtest/arbitrage";
export {
  generateSyntheticBets,
  type SyntheticConfig,
} from "@/modules/bankroll-backtest/synthetic";
export {
  runRegimeReversalTest,
  type RegimeReversalResult,
} from "@/modules/bankroll-backtest/regime-reversal";
export {
  checkBankrollInvariants,
  type InvariantViolation,
} from "@/modules/bankroll-backtest/invariants";
export {
  createFixedEvStrategy,
  type OddsDecision,
  type StrategyProtocol,
} from "@/modules/bankroll-backtest/strategy-protocol";
