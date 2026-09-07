import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  summarizeResultReconciliation,
  type ReconciliationMatchRow,
  type ReconciliationPickRow,
} from "@/lib/production-result-reconciliation";

const now = new Date(
  "2026-08-14T12:00:00.000Z",
);

function match(
  input: Partial<ReconciliationMatchRow> &
    Pick<ReconciliationMatchRow, "id">,
): ReconciliationMatchRow {
  return {
    id: input.id,
    apiId: input.apiId ?? input.id + 1_000,
    kickoffAt:
      input.kickoffAt ??
      new Date("2026-08-13T12:00:00.000Z"),
    status: input.status ?? "FINISHED",
    homeScore:
      input.homeScore === undefined
        ? 1
        : input.homeScore,
    awayScore:
      input.awayScore === undefined
        ? 0
        : input.awayScore,
    updatedAt:
      input.updatedAt ?? now,
    leagueName:
      input.leagueName ?? "Test League",
    homeTeam:
      input.homeTeam ?? `Home ${input.id}`,
    awayTeam:
      input.awayTeam ?? `Away ${input.id}`,
  };
}

const matches: ReconciliationMatchRow[] = [
  match({
    id: 1,
    homeScore: 0,
    awayScore: 2,
  }),
  match({
    id: 2,
    homeScore: null,
    awayScore: null,
  }),
  match({
    id: 3,
  }),
  match({
    id: 4,
  }),
  match({
    id: 5,
    status: "SCHEDULED",
    kickoffAt:
      new Date("2026-08-13T00:00:00.000Z"),
    homeScore: null,
    awayScore: null,
  }),
];

const picks: ReconciliationPickRow[] = [
  {
    matchId: 1,
    result: "WON",
    actualHomeScore: 0,
    actualAwayScore: 2,
  },
  {
    matchId: 3,
    result: "PENDING",
    actualHomeScore: null,
    actualAwayScore: null,
  },
  {
    matchId: 4,
    result: "LOST",
    actualHomeScore: 2,
    actualAwayScore: 0,
  },
];

async function main(): Promise<void> {
  const summary =
    summarizeResultReconciliation(
      matches,
      picks,
      now,
    );

  assert.equal(summary.totalFixtures, 5);
  assert.equal(summary.finishedFixtures, 4);
  assert.equal(summary.archivedMatches, 3);
  assert.equal(summary.missingFinalScores, 1);
  assert.equal(summary.pendingSettlements, 1);
  assert.equal(summary.archiveScoreMismatches, 1);
  assert.equal(summary.overdueStatuses, 1);
  assert.equal(summary.issueCount, 4);
  assert.equal(summary.status, "CRITICAL");

  const zeroScoreIssue =
    summary.issues.find(
      (issue) => issue.matchId === 1,
    );
  assert.equal(zeroScoreIssue, undefined);

  const operations = await readFile(
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
  const auditSnapshot = await readFile(
    join(
      process.cwd(),
      "src",
      "lib",
      "prediction-selection-audit-snapshot.ts",
    ),
    "utf8",
  );

  assert.match(
    operations,
    /loadProductionResultReconciliationSnapshot/,
  );
  assert.match(
    operations,
    /Sonuç Uzlaştırma ve Skor Uyarıları/,
  );
  assert.match(
    automation,
    /Script = "reconcile:results-v5"/,
  );
  assert.match(
    auditSnapshot,
    /"data\/production-selection-audit-v5\.json"/,
  );
  assert.doesNotMatch(
    auditSnapshot,
    /join\([\s\S]{0,100}process\.cwd\(\)/,
  );

  console.log(
    "Production Result Reconciliation V5.3 tests passed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
