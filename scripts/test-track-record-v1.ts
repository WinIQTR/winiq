import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  appendCorrection,
  buildMarginIndex,
  buildTrackRecordReport,
  combineDoubleChanceOdds,
  computeLabeledClv,
  computeRecordHash,
  detectTeamsReversed,
  doubleChanceWins,
  filterScoreableRows,
  formatAutopsyMarkdown,
  formatCorrectionsMarkdown,
  formatExperimentMarkdown,
  isLoggedBeforeKickoff,
  oneXTwoMargin,
  parseManifestCsv,
  pickRealizableOdds,
  sealValueFlag,
  sha256OfText,
  verifyValueCommitment,
  voidReasonFromMatchStatus,
  writeImmutableTrackSnapshot,
} from "../src/modules/track-record";

assert.equal(
  isLoggedBeforeKickoff(
    new Date("2026-01-01T10:00:00Z"),
    new Date("2026-01-01T18:00:00Z"),
  ),
  true,
);
assert.equal(
  isLoggedBeforeKickoff(
    new Date("2026-01-01T19:00:00Z"),
    new Date("2026-01-01T18:00:00Z"),
  ),
  false,
);

assert.equal(voidReasonFromMatchStatus("POSTPONED"), "postponed");
assert.equal(
  filterScoreableRows([
    { result: "1", voidReason: null },
    { result: null, voidReason: "no_result" },
  ]).length,
  1,
);

const hash = computeRecordHash({
  id: "1",
  matchId: "99",
  league: "Süper Lig",
  home: "A",
  away: "B",
  kickoffAt: new Date("2026-01-02T15:00:00Z"),
  probability: 0.55,
  pinOpenHome: 1.9,
  loggedAt: new Date("2026-01-01T12:00:00Z"),
});
assert.equal(hash.length, 16);

const labeled = computeLabeledClv({
  oddsTaken: 2.1,
  closingOdds: 2.0,
  fairProbability: 0.5,
});
assert.ok(labeled.rawClvPct !== null && labeled.rawClvPct > 0);
assert.ok(labeled.deVigClvPct !== null);
assert.equal(labeled.beatClosing, true);

const sealed = sealValueFlag({
  matchId: "99",
  selection: "1",
  bookmaker: "TestBook",
  oddsTaken: 2.1,
  fairOdds: 1.95,
  closingOdds: 2.0,
  origin: "live",
  recordedAt: new Date("2026-01-01T12:00:00Z"),
  kickoffAt: new Date("2026-01-02T15:00:00Z"),
  salt: "abc",
  realizableOdds: 2.05,
});
assert.equal(verifyValueCommitment(sealed.commitment, sealed.preimage), true);
assert.equal(sealed.sealedBeforeKickoff, true);
assert.ok(sealed.realizableClvPct !== null);

assert.equal(
  pickRealizableOdds(
    [
      { at: new Date("2026-01-01T12:10:00Z"), odds: 2.05, bookmaker: "TestBook" },
      { at: new Date("2026-01-01T13:30:00Z"), odds: 2.2, bookmaker: "TestBook" },
    ],
    {
      bookmaker: "TestBook",
      flaggedAt: new Date("2026-01-01T12:00:00Z"),
      kickoffAt: new Date("2026-01-02T15:00:00Z"),
      windowMinutes: 60,
    },
  ),
  2.05,
);

const dc = combineDoubleChanceOdds(2.0, 3.5);
assert.ok(dc !== null && dc > 1);
assert.equal(doubleChanceWins("1X", "X"), true);
assert.equal(doubleChanceWins("12", "X"), false);

assert.ok(oneXTwoMargin(2.0, 3.4, 3.8) > 0);
const margins = buildMarginIndex(
  [
    {
      bookmaker: "Pinnacle",
      kind: "etalon",
      margin: 0.04,
      leagueKey: "super-lig",
      at: new Date(),
    },
    {
      bookmaker: "SoftA",
      kind: "soft",
      margin: 0.08,
      leagueKey: "super-lig",
      at: new Date(),
    },
  ],
  { windowDays: 30 },
);
assert.equal(margins.bookmakers.length, 2);
assert.ok(margins.byLeague["super-lig"]);

const reversed = detectTeamsReversed({
  loggedHome: "Alpha",
  loggedAway: "Beta",
  canonicalHome: "Beta",
  canonicalAway: "Alpha",
});
assert.equal(reversed.teamsReversedAfterLogging, true);

const ledger = appendCorrection([], {
  id: "2026-01-01-score",
  at: new Date("2026-01-01T00:00:00Z"),
  scope: "score",
  summary: "HT score stored as FT",
  rowIds: ["1"],
  before: "2-1",
  after: "2-2",
});
assert.ok(formatCorrectionsMarkdown(ledger).includes("HT score"));

const expMd = formatExperimentMarkdown({
  id: "WINIQ-EXP-001",
  title: "Smoke",
  registeredAt: new Date("2026-01-01"),
  hypothesis: "h",
  universe: "u",
  selection: "s",
  stake: "1u",
  prices: "close",
  primaryMetric: "CLV",
  duration: "1 season",
  successCriteria: "CLV>0",
  failureCriteria: "CLV<=0",
  caveats: ["caveat"],
});
assert.ok(expMd.includes("WINIQ-EXP-001"));
assert.ok(
  formatAutopsyMarkdown({
    experimentId: "WINIQ-EXP-001",
    concludedAt: new Date("2026-06-01"),
    outcome: "failure",
    primaryMetricResult: "CLV -1%",
    whatWorked: ["logging"],
    whatFailed: ["edge"],
    nextSteps: ["stop"],
  }).includes("AUTOPSY"),
);

const report = buildTrackRecordReport([
  {
    id: "1",
    matchId: "1",
    league: "L",
    home: "A",
    away: "B",
    kickoffAt: new Date("2026-02-01T18:00:00Z"),
    loggedAt: new Date("2026-02-01T10:00:00Z"),
    pick: "1",
    probability: 0.55,
    oddsTaken: 2.0,
    pinClose: 1.9,
    result: "1",
    predictionWon: true,
    loggedBeforeKickoff: true,
    voidReason: null,
    value: {
      selection: "1",
      bookmaker: "X",
      oddsTaken: 2.1,
      fairOdds: 2.0,
      origin: "live",
      recordedAt: new Date("2026-02-01T10:00:00Z"),
      sealedBeforeKickoff: true,
      commitment: "x",
    },
  },
  {
    id: "2",
    matchId: "2",
    league: "L",
    home: "C",
    away: "D",
    kickoffAt: new Date("2026-02-02T18:00:00Z"),
    loggedAt: new Date("2026-02-02T10:00:00Z"),
    pick: "X",
    probability: 0.3,
    oddsTaken: 3.2,
    result: null,
    voidReason: "postponed",
    predictionWon: null,
    loggedBeforeKickoff: true,
  },
]);
assert.equal(report.scoreable, 1);
assert.equal(report.voided, 1);
assert.equal(report.liveValueFlags, 1);

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "track-"));
  try {
    const meta = await writeImmutableTrackSnapshot(
      { predictions: [{ id: 1 }], source: "test" },
      {
        trackDir: dir,
        manifestPath: path.join(dir, "manifest.csv"),
      },
    );
    const body = await readFile(path.join(dir, meta.fileName), "utf8");
    assert.equal(sha256OfText(body), meta.sha256);
    const manifest = parseManifestCsv(
      await readFile(path.join(dir, "manifest.csv"), "utf8"),
    );
    assert.equal(manifest.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  console.log("test-track-record-v1: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
