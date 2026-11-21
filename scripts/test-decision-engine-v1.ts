import assert from "node:assert/strict";

import {
  applyExposureCaps,
  binaryRowsToBootstrapObservations,
  buildReliabilityDiagram,
  compareDevigMethods,
  computeUncertaintyBuffer,
  conservativeExpectedValue,
  DEFAULT_DECISION_ENGINE_CONFIG,
  devig,
  evaluateBetMode,
  evaluateDecision,
  isMarketEnabled,
  runPairedBlockBootstrap,
} from "../src/modules/decision-engine";

// --- de-vig ---
const odds = [1.5, 4.2, 6.5];
const methods = compareDevigMethods(odds);
assert.ok(methods.overround > 0, "book has overround");
for (const name of ["normalized", "power", "shin"] as const) {
  const probs = methods[name];
  const sum = probs.reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `${name} sums to 1`);
}
const shin = devig(odds, "shin");
const norm = devig(odds, "normalized");
assert.ok(shin[0]! >= norm[0]! - 1e-9, "Shin lifts favourite vs normalized");
assert.ok(shin[2]! <= norm[2]! + 1e-9, "Shin cuts longshot vs normalized");

// --- uncertainty + conservative EV ---
const buffer = computeUncertaintyBuffer({
  modelDisagreement: 0.08,
  dataQuality: 0.95,
  historicalSamples: 100,
  minimumHistoricalSamples: 300,
});
assert.ok(buffer > 0.02 && buffer <= 0.15, "buffer within clamp");
const cev = conservativeExpectedValue(0.55, 2.1, buffer);
assert.ok(cev < 0.55 * 2.1 - 1, "conservative EV below raw EV");

// --- market activation ---
assert.equal(isMarketEnabled("match_winner_home"), true);
assert.equal(isMarketEnabled("correct_score_2_1"), false);

// --- decision: disagreement / no-bet ---
const noBet = evaluateDecision({
  marketKey: "match_winner_home",
  decimalOdds: 1.9,
  modelProbability: 0.62,
  alternateProbability: 0.4,
  dataQuality: 0.95,
  historicalSamples: 400,
  fixtureAgeHours: 1,
  oddsAgeHours: 1,
  oddsTimestampPresent: true,
});
assert.equal(noBet.status, "NO_BET");
assert.ok(noBet.rejectionCodes.includes("MODEL_DISAGREEMENT"));

const qualified = evaluateDecision({
  marketKey: "btts_yes",
  decimalOdds: 2.05,
  modelProbability: 0.62,
  alternateProbability: 0.55,
  dataQuality: 0.98,
  historicalSamples: 500,
  fixtureAgeHours: 2,
  oddsAgeHours: 1,
  oddsTimestampPresent: true,
});
assert.equal(qualified.status, "QUALIFIED", qualified.rejectionCodes.join(","));

// --- bet modes ---
const smart = evaluateBetMode(
  {
    marketKey: "match_winner_home",
    decimalOdds: 1.9,
    modelProbability: 0.62,
    alternateProbability: 0.56,
    dataQuality: 0.97,
    historicalSamples: 500,
    modelSupportCount: 1,
  },
  "smart",
);
assert.equal(smart.qualified, true, smart.rejectionCodes.join(","));

const smartRejectCs = evaluateBetMode(
  {
    marketKey: "correct_score_2_1",
    decimalOdds: 8,
    modelProbability: 0.12,
    alternateProbability: 0.09,
    dataQuality: 0.95,
    historicalSamples: 1200,
    modelSupportCount: 2,
  },
  "smart",
);
assert.ok(smartRejectCs.rejectionCodes.includes("MARKET_NOT_IN_MODE"));

// --- exposure ---
const now = new Date();
const exposure = applyExposureCaps([
  {
    id: "a",
    matchId: 1,
    leagueKey: "39",
    kickoffAt: now,
    stakeFraction: 0.004,
    score: 90,
  },
  {
    id: "b",
    matchId: 1,
    leagueKey: "39",
    kickoffAt: now,
    stakeFraction: 0.004,
    score: 80,
  },
  {
    id: "c",
    matchId: 2,
    leagueKey: "39",
    kickoffAt: now,
    stakeFraction: 0.004,
    score: 70,
  },
  {
    id: "d",
    matchId: 3,
    leagueKey: "39",
    kickoffAt: now,
    stakeFraction: 0.004,
    score: 60,
  },
  {
    id: "e",
    matchId: 4,
    leagueKey: "39",
    kickoffAt: now,
    stakeFraction: 0.004,
    score: 50,
  },
]);
assert.equal(exposure.filter((row) => row.accepted).length, 2);
assert.equal(
  exposure.find((row) => row.id === "b")?.rejectionReason,
  "MATCH_PRIMARY_CAP",
);
assert.equal(
  exposure.find((row) => row.id === "d")?.rejectionReason,
  "LEAGUE_FRACTION_CAP",
);

// --- bootstrap + reliability ---
const observations = binaryRowsToBootstrapObservations(
  Array.from({ length: 40 }, (_, index) => ({
    blockKey: `d${Math.floor(index / 5)}`,
    modelProbability: 0.55,
    marketProbability: 0.54,
    won: index % 2 === 0,
  })),
);
const bootstrap = runPairedBlockBootstrap(observations, {
  iterations: 200,
  seed: 7,
});
assert.ok(bootstrap.metrics.length === 3);
assert.ok(bootstrap.summary.length > 10);

const diagram = buildReliabilityDiagram(
  Array.from({ length: 50 }, (_, index) => ({
    predicted01: 0.4 + (index % 5) * 0.1,
    outcome01: (index % 3 === 0 ? 1 : 0) as 0 | 1,
  })),
);
assert.ok(diagram.ece >= 0);
assert.equal(diagram.bins.length, 10);
assert.equal(DEFAULT_DECISION_ENGINE_CONFIG.devigMethod, "shin");

console.log("test-decision-engine-v1: ok");
