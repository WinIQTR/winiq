import assert from "node:assert/strict";

import {
  aggregateTeamScorerHistory,
  buildAliasIndex,
  canonicalizeTeamName,
  computeChronologicalElo,
  computeRollingForm,
  crossCheckAnalyticVsMonteCarlo,
  DEFAULT_TEAM_ALIASES,
  deriveGoalLineMarkets,
  filterFeaturesForMode,
  priorMatchesForTeam,
  redistributeEnsembleWeights,
  resolvePredictionMode,
  resolveProductionBlendWeights,
  resolveVenueContext,
  selectOddsAsOf,
  simulateScorelines,
} from "../src/modules/match-context-engine";

// 1 prediction modes
assert.equal(
  resolvePredictionMode({
    kickoffAt: new Date("2030-01-01"),
    lineupStatus: "PREDICTED",
  }),
  "early_prediction",
);
assert.equal(
  resolvePredictionMode({
    kickoffAt: new Date("2030-01-01"),
    confirmedLineupPresent: true,
  }),
  "lineup_known_prediction",
);
const gated = filterFeaturesForMode(
  [
    { key: "recent_form" },
    { key: "confirmed_starting_xi" },
    { key: "closing_odds" },
  ],
  "early_prediction",
);
assert.equal(gated.kept.length, 1);
assert.equal(gated.blocked.length, 2);

// 2 Elo chronological + MoV + neutral
const elo = computeChronologicalElo([
  {
    matchId: 1,
    kickoffAt: new Date("2024-01-01"),
    homeTeamId: "A",
    awayTeamId: "B",
    homeScore: 3,
    awayScore: 0,
    competition: "Premier League",
    neutral: false,
  },
  {
    matchId: 2,
    kickoffAt: new Date("2024-02-01"),
    homeTeamId: "A",
    awayTeamId: "B",
    homeScore: 1,
    awayScore: 1,
    competition: "Friendly",
    neutral: true,
  },
]);
assert.equal(elo.preMatch.length, 2);
assert.ok(elo.preMatch[0]!.homeAdvantageApplied > 0);
assert.equal(elo.preMatch[1]!.homeAdvantageApplied, 0);
assert.ok((elo.finalRatings.get("A") ?? 0) > (elo.finalRatings.get("B") ?? 0));

// 3 opponent-adjusted rolling form + shift safety
const formRows = [
  {
    matchId: 1,
    kickoffAt: new Date("2024-01-01"),
    teamId: "A",
    opponentId: "B",
    goalsFor: 2,
    goalsAgainst: 0,
    ownElo: 1600,
    opponentElo: 1400,
  },
  {
    matchId: 2,
    kickoffAt: new Date("2024-02-01"),
    teamId: "A",
    opponentId: "C",
    goalsFor: 0,
    goalsAgainst: 1,
    ownElo: 1610,
    opponentElo: 1550,
  },
];
const prior = priorMatchesForTeam(formRows, "A", new Date("2024-02-01"));
assert.equal(prior.length, 1);
assert.equal(prior[0]!.matchId, 1);
const form = computeRollingForm(prior, [5]);
assert.equal(form[0]!.matchesUsed, 1);
assert.ok(form[0]!.opponentAdjustedPointsPerGame !== null);

// 4 scorer features
const scorers = aggregateTeamScorerHistory(
  [
    {
      matchId: 1,
      kickoffAt: new Date("2024-01-01"),
      teamId: "A",
      scorerKey: "x",
      isPenalty: false,
    },
    {
      matchId: 1,
      kickoffAt: new Date("2024-01-01"),
      teamId: "A",
      scorerKey: "x",
      isPenalty: true,
    },
    {
      matchId: 2,
      kickoffAt: new Date("2024-03-01"),
      teamId: "A",
      scorerKey: "y",
    },
  ],
  "A",
  new Date("2024-02-01"),
  [5],
);
assert.equal(scorers[0]!.totalGoals, 2);
assert.equal(scorers[0]!.penaltyGoals, 1);
assert.ok((scorers[0]!.goalConcentration ?? 0) > 0.9);

// 5 aliases
const index = buildAliasIndex(DEFAULT_TEAM_ALIASES);
assert.equal(canonicalizeTeamName("Man Utd", index), "Manchester United");
assert.equal(canonicalizeTeamName("PSG", index), "Paris Saint-Germain");

// 6 odds as-of (leakage)
const asOf = selectOddsAsOf(
  [
    {
      id: "early",
      observedAt: new Date("2024-01-01T10:00:00Z"),
      homeOdds: 2.1,
      drawOdds: 3.2,
      awayOdds: 3.8,
    },
    {
      id: "close",
      observedAt: new Date("2024-01-01T20:00:00Z"),
      homeOdds: 1.5,
      drawOdds: 4,
      awayOdds: 6,
    },
  ],
  new Date("2024-01-01T12:00:00Z"),
);
assert.equal(asOf.quote?.id, "early");
assert.equal(asOf.rejectedAfterCutoff, 1);

// 7 leakage: ranking/odds/rolling/player-style gates via feature filter
assert.ok(
  !filterFeaturesForMode([{ key: "late_odds" }], "early_prediction").kept.length,
);

// 8 Monte Carlo cross-check
const mc = simulateScorelines(1.4, 1.1, { simulations: 5000, seed: 1 });
assert.ok(mc.over15Prob > mc.over35Prob);
const check = crossCheckAnalyticVsMonteCarlo(
  {
    homeWinProb: mc.homeWinProb,
    drawProb: mc.drawProb,
    awayWinProb: mc.awayWinProb,
    over25Prob: mc.over25Prob,
  },
  1.4,
  1.1,
  { simulations: 5000, seed: 1, tolerance: 0.05 },
);
assert.equal(check.withinTolerance, true);

// 9 O/U 1.5 / 3.5 from matrix
const lines = deriveGoalLineMarkets([
  { homeGoals: 1, awayGoals: 0, probability: 0.2 },
  { homeGoals: 1, awayGoals: 1, probability: 0.2 },
  { homeGoals: 2, awayGoals: 2, probability: 0.3 },
  { homeGoals: 3, awayGoals: 1, probability: 0.3 },
]);
assert.ok(lines.find((row) => row.line === 1.5)?.highlighted);
assert.ok(lines.find((row) => row.line === 3.5)?.highlighted);
assert.ok((lines.find((row) => row.line === 1.5)?.overProb ?? 0) > 0.5);

// 10 venue / host / neutral
const venue = resolveVenueContext({
  venueName: "Olympic Stadium",
  venueCity: "Berlin",
  homeTeamName: "Spain",
  competitionCountry: "Germany",
});
assert.equal(venue.isNeutral, true);
assert.equal(venue.homeAdvantageFactor, 0);
assert.equal(venue.hostCountry, "Germany");

// 12 ensemble redistribute
const redistributed = redistributeEnsembleWeights(
  { elo: 0.25, poisson: 0.25, tabular: 0.35, market: 0.15 },
  ["market"],
);
assert.equal(redistributed.market, 0);
assert.ok(Math.abs(Object.values(redistributed).reduce((a, b) => a + b, 0) - 1) < 1e-9);
const blend = resolveProductionBlendWeights({ mlAvailable: false });
assert.equal(blend.ml, 0);
assert.ok(blend.poisson > 0.99);

console.log("test-match-context-engine-v1: ok");
