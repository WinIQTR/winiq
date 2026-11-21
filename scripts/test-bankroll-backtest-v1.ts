import assert from "node:assert/strict";

import {
  adjustSimultaneousStakes,
  buildBankrollBacktestReport,
  calculateBacktestMetrics,
  chronologicalHoldoutSplit,
  evaluateStrategy,
  expectedValue,
  kellyFraction,
  runBankrollSimulation,
  runOddsStressTest,
  selectBet,
  DEFAULT_STRATEGY_CONFIG,
  type BacktestBetInput,
} from "../src/modules/bankroll-backtest";

function bet(
  partial: Partial<BacktestBetInput> & Pick<BacktestBetInput, "id" | "date" | "odds" | "result">,
): BacktestBetInput {
  return {
    modelProbability: 0.55,
    ...partial,
  };
}

const day = (n: number) => new Date(`2024-01-${String(n).padStart(2, "0")}T12:00:00Z`);

const sample: BacktestBetInput[] = [
  bet({ id: "1", date: day(1), odds: 2.0, modelProbability: 0.58, result: "WON", closingOdds: 1.9 }),
  bet({ id: "2", date: day(2), odds: 1.8, modelProbability: 0.6, result: "LOST", closingOdds: 1.85 }),
  bet({ id: "3", date: day(3), odds: 2.2, modelProbability: 0.52, result: "WON", closingOdds: 2.0 }),
  bet({ id: "4", date: day(4), odds: 1.7, modelProbability: 0.62, result: "WON", closingOdds: 1.65 }),
  bet({ id: "5", date: day(5), odds: 2.5, modelProbability: 0.48, result: "LOST", closingOdds: 2.4 }),
  bet({ id: "6", date: day(6), odds: 1.9, modelProbability: 0.57, result: "WON", closingOdds: 1.8 }),
  bet({ id: "7", date: day(7), odds: 3.0, modelProbability: 0.4, result: "LOST", closingOdds: 3.2 }),
  bet({ id: "8", date: day(8), odds: 1.85, modelProbability: 0.59, result: "WON", closingOdds: 1.8 }),
];

assert.ok(expectedValue(0.55, 2) > 0);
assert.ok(kellyFraction(0.55, 2) > 0);

const accepted = selectBet(sample[0]!, DEFAULT_STRATEGY_CONFIG);
assert.equal(accepted.accept, true);

const rejected = selectBet(
  bet({ id: "x", date: day(1), odds: 1.2, modelProbability: 0.9, result: "WON" }),
  DEFAULT_STRATEGY_CONFIG,
);
assert.equal(rejected.accept, false);

const sim = runBankrollSimulation(sample, { initialBankroll: 1000 });
assert.ok(sim.settled.length === sample.length);
assert.ok(sim.path.length >= 1);
const metrics = calculateBacktestMetrics(sim.settled, 1000);
assert.ok(typeof metrics.roiPct === "number");
assert.ok(metrics.yieldPct !== null || metrics.bets === 0);
assert.ok(metrics.clvPct !== null);
assert.ok(metrics.beatClosingPct !== null);

const stress = runOddsStressTest(sample, { initialBankroll: 1000 });
assert.equal(stress.length, 4);
assert.equal(stress[0]!.haircut, 0);

const split = chronologicalHoldoutSplit(sample, 0.25);
assert.ok(split.train.length + split.holdout.length === sample.length);
assert.ok(split.holdout.length >= 1);

const evaluated = evaluateStrategy(sample, {
  strategy: { minEv: 0.02 },
  metric: "yieldPct",
});
assert.ok(evaluated.bets >= 0);

const simultaneous = adjustSimultaneousStakes([100, 100, 100], 1000, 0.2);
assert.ok(Math.abs(simultaneous.reduce((a, b) => a + b, 0) - 200) < 1e-6);

const report = buildBankrollBacktestReport(sample, {
  initialBankroll: 1000,
  includeTuning: true,
});
assert.ok(report.equity.bankroll.length > 0);
assert.ok(report.stress.length === 4);
assert.ok(report.bankrollSparkline.length > 0);

console.log("test-bankroll-backtest-v1: ok");
