import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  summarizeApiQuota,
  summarizeLeagueCoverage,
} from "@/lib/production-data-coverage-shared";

async function main(): Promise<void> {
const api = summarizeApiQuota({
  subscription: {
    plan: "Pro",
    active: true,
    end: "2026-09-14",
  },
  requests: {
    current: 41,
    limit_day: 7_500,
  },
});

assert.equal(api.state, "CONNECTED");
assert.equal(api.plan, "Pro");
assert.equal(api.active, true);
assert.equal(api.usedToday, 41);
assert.equal(api.dailyLimit, 7_500);
assert.equal(api.remainingToday, 7_459);

const leagues = summarizeLeagueCoverage(
  [
    {
      id: 1,
      status: "FINISHED",
      homeScore: 0,
      awayScore: 2,
      updatedAt: new Date(
        "2026-08-14T08:00:00.000Z",
      ),
      leagueApiId: 203,
      leagueName: "Süper Lig",
    },
    {
      id: 2,
      status: "FINISHED",
      homeScore: null,
      awayScore: null,
      updatedAt: new Date(
        "2026-08-14T09:00:00.000Z",
      ),
      leagueApiId: 203,
      leagueName: "Süper Lig",
    },
    {
      id: 3,
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
      updatedAt: new Date(
        "2026-08-14T10:00:00.000Z",
      ),
      leagueApiId: 39,
      leagueName: "Premier League",
    },
  ],
  new Set([1, 3]),
);

const superLig = leagues.find(
  (league) =>
    league.leagueApiId === 203,
);

assert.ok(superLig);
assert.equal(superLig.fixtures, 2);
assert.equal(superLig.finished, 2);
assert.equal(superLig.missingFinalScores, 1);
assert.equal(superLig.publishedCandidates, 1);
assert.equal(
  superLig.lastDatabaseUpdateAt,
  "2026-08-14T09:00:00.000Z",
);

const source = await readFile(
  join(
    process.cwd(),
    "src",
    "lib",
    "production-data-coverage.ts",
  ),
  "utf8",
);

const snapshotSource = await readFile(
  join(
    process.cwd(),
    "src",
    "lib",
    "production-data-coverage-snapshot.ts",
  ),
  "utf8",
);

const operationsPage = await readFile(
  join(
    process.cwd(),
    "src",
    "app",
    "operations",
    "page.tsx",
  ),
  "utf8",
);

const automation = await readFile(
  join(
    process.cwd(),
    "deploy",
    "windows",
    "run-local-daily-collection.ps1",
  ),
  "utf8",
);

assert.match(
  snapshotSource,
  /"data-coverage-v5\.json"/,
);
assert.match(
  snapshotSource,
  /secretsStored:\s*false/,
);
assert.match(
  snapshotSource,
  /automaticModelChangeAllowed:\s*false/,
);
assert.doesNotMatch(
  `${source}\n${snapshotSource}`,
  /firstname|lastname|email/,
);
assert.doesNotMatch(
  `${source}\n${snapshotSource}`,
  /writeFile[\s\S]{0,300}API_FOOTBALL_KEY/,
);

assert.match(
  operationsPage,
  /loadProductionDataCoverageSnapshot/,
);
assert.match(
  operationsPage,
  /2026 Veri Kapsamı ve API Kotası/,
);

const refreshIndex = automation.indexOf(
  'Script = "refresh"',
);
const coverageIndex = automation.indexOf(
  'Script = "coverage:production"',
);
const oddsIndex = automation.indexOf(
  'Script = "import-odds"',
);

assert.ok(refreshIndex >= 0);
assert.ok(coverageIndex > refreshIndex);
assert.ok(oddsIndex > coverageIndex);
assert.doesNotMatch(
  automation,
  /notifications:deliver-v4/,
);

console.log(
  "Production Data Coverage and API Quota V5.1 tests passed.",
);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
