import assert from "node:assert/strict";

import {
  UNIFORM_ONE_THIRD_BRIER,
  assertProbabilitySum,
  assertRefreshShrink,
  buildFavouriteStrengthBrier,
  buildLeagueRollupSummary,
  buildPickProbabilityCalibration,
  buildPredictionAuditReport,
  checkProbabilitySum,
  checkRefreshShrink,
  compareToExternalOpenData,
  computeLedgerAdditions,
  computeNaiveBaselines,
  derivePick,
  latestPickBeforeKickoff,
  ledgerSummary,
  multiClassBrier,
  parseOpenDataSettledCsv,
  serializeSettledExportCsv,
  softPredictionsToOneXTwo,
  type SettledOneXTwoRow,
} from "../src/modules/prediction-audit";

const day = (n: number) => new Date(`2024-03-${String(n).padStart(2, "0")}T15:00:00Z`);

const sample: SettledOneXTwoRow[] = [
  {
    fixtureId: "1",
    kickoffAt: day(1),
    leagueKey: "super-lig",
    leagueName: "Süper Lig",
    country: "Türkiye",
    homeTeam: "A",
    awayTeam: "B",
    homeScore: 2,
    awayScore: 1,
    result: "1",
    pHome: 0.55,
    pDraw: 0.25,
    pAway: 0.2,
    lambdaHome: 1.6,
    lambdaAway: 1.0,
    pick: "1",
    pickCorrect: true,
    modelVersion: "winiq-test",
    pickWrittenAt: day(1),
    firstSeenAt: day(1),
  },
  {
    fixtureId: "2",
    kickoffAt: day(2),
    leagueKey: "super-lig",
    leagueName: "Süper Lig",
    homeTeam: "C",
    awayTeam: "D",
    homeScore: 0,
    awayScore: 0,
    result: "X",
    pHome: 0.3,
    pDraw: 0.4,
    pAway: 0.3,
    pick: "X",
    pickCorrect: true,
    modelVersion: "winiq-test",
    pickWrittenAt: day(2),
    firstSeenAt: day(2),
  },
  {
    fixtureId: "3",
    kickoffAt: day(3),
    leagueKey: "la-liga",
    leagueName: "LaLiga",
    homeTeam: "E",
    awayTeam: "F",
    homeScore: 1,
    awayScore: 3,
    result: "2",
    pHome: 0.5,
    pDraw: 0.25,
    pAway: 0.25,
    pick: "1",
    pickCorrect: false,
    modelVersion: "winiq-test",
    pickWrittenAt: day(3),
    firstSeenAt: day(3),
  },
];

assert.ok(Math.abs(UNIFORM_ONE_THIRD_BRIER - 2 / 3) < 1e-12);
assert.ok(multiClassBrier(1 / 3, 1 / 3, 1 / 3, "1") - UNIFORM_ONE_THIRD_BRIER < 1e-12);

const baselines = computeNaiveBaselines(sample);
assert.equal(baselines.matches, 3);
assert.ok(baselines.modelPickHitRate !== null);
assert.ok(baselines.homePickHitRate !== null);
assert.ok(baselines.modelBrier !== null);

assert.equal(checkProbabilitySum(0.5, 0.25, 0.25).ok, true);
assert.equal(checkProbabilitySum(0.9, 0.9, 0.9).ok, false);
assert.doesNotThrow(() =>
  assertProbabilitySum({ fixtureId: "ok", pHome: 0.4, pDraw: 0.3, pAway: 0.3 }),
);

assert.equal(checkRefreshShrink(100, 90).ok, true);
assert.equal(checkRefreshShrink(100, 70).ok, false);
assert.throws(() => assertRefreshShrink(100, 50));

const cal = buildPickProbabilityCalibration(sample);
assert.ok(cal.some((bin) => bin.matches > 0));

const rollup = buildLeagueRollupSummary(sample);
assert.equal(rollup.leagues.length, 2);
assert.ok(rollup.all.brier !== null);

const fav = buildFavouriteStrengthBrier(sample);
assert.ok(fav.some((slice) => slice.matches > 0));

const csv = serializeSettledExportCsv(sample);
assert.ok(csv.includes("fixture_id"));
assert.ok(csv.includes("lambda_home"));
assert.ok(csv.includes("pick_written_utc"));

const kickoffFuture = new Date("2030-01-01T18:00:00Z");
const t0 = new Date("2029-12-31T10:00:00Z");
const t1 = new Date("2029-12-31T11:00:00Z");
const t2 = new Date("2029-12-31T12:00:00Z");
const additions = computeLedgerAdditions(
  [
    {
      fixtureId: "10",
      kickoffAt: kickoffFuture,
      leagueKey: "super-lig",
      homeTeam: "G",
      awayTeam: "H",
      pick: "1",
      pickWrittenAt: t0,
    },
    {
      fixtureId: "10",
      kickoffAt: kickoffFuture,
      leagueKey: "super-lig",
      homeTeam: "G",
      awayTeam: "H",
      pick: "X",
      pickWrittenAt: t1,
    },
  ],
  [],
  t1,
);
assert.equal(additions.length, 1);
assert.equal(additions[0]!.pick, "X");

const ledger = [
  ...additions,
  ...computeLedgerAdditions(
    [
      {
        fixtureId: "10",
        kickoffAt: kickoffFuture,
        leagueKey: "super-lig",
        homeTeam: "G",
        awayTeam: "H",
        pick: "2",
        pickWrittenAt: t2,
      },
    ],
    additions,
    t2,
  ),
];
assert.equal(ledgerSummary(ledger).changes, 1);
assert.equal(latestPickBeforeKickoff(ledger, "10", kickoffFuture)?.pick, "2");

const theirs = sample.map((row) => ({
  ...row,
  pHome: 0.34,
  pDraw: 0.33,
  pAway: 0.33,
  pick: derivePick(0.34, 0.33, 0.33),
}));
const bench = compareToExternalOpenData(sample, theirs);
assert.equal(bench.overlapped, 3);
assert.ok(bench.ourMeanBrier !== null);

const parsed = parseOpenDataSettledCsv(csv);
assert.equal(parsed.length, 3);

const soft = softPredictionsToOneXTwo([
  {
    matchId: 99,
    leagueName: "Test",
    kickoffAt: day(4),
    homeTeam: "Z",
    awayTeam: "Y",
    predictedOutcome: "HOME",
    predictedProbability: 60,
    actualHomeScore: 1,
    actualAwayScore: 0,
    actualOutcome: "HOME",
    isCorrect: true,
    marketKey: "match_result",
    publishedAt: day(4),
  },
]);
assert.equal(soft.length, 1);
assert.ok(soft[0]!.firstSeenAt);

const report = buildPredictionAuditReport(sample);
assert.equal(report.rejectedProbabilityRows, 0);
assert.ok(report.settledExportCsv.includes("model_version"));

console.log("test-prediction-audit-v1: ok");
