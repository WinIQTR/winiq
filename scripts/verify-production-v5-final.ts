import "dotenv/config";

import assert from "node:assert/strict";

import {
  execFileSync,
} from "node:child_process";

import {
  access,
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  assert.ok(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value),
    "Expected a JSON object.",
  );

  return value as JsonRecord;
}

function number(value: unknown): number {
  assert.equal(
    typeof value,
    "number",
    "Expected a numeric snapshot value.",
  );

  return value as number;
}

function text(value: unknown): string {
  assert.equal(
    typeof value,
    "string",
    "Expected a text snapshot value.",
  );

  return value as string;
}

async function jsonFile(
  relativePath: string,
): Promise<JsonRecord> {
  return record(
    JSON.parse(
      await readFile(
        join(process.cwd(), relativePath),
        "utf8",
      ),
    ) as unknown,
  );
}

function runV4FinalVerification(): void {
  if (process.platform === "win32") {
    execFileSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "pnpm.cmd run verify:v4-final",
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        windowsHide: true,
      },
    );

    return;
  }

  execFileSync(
    "pnpm",
    ["run", "verify:v4-final"],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    },
  );
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "V5 FINAL PRODUCTION VERIFICATION",
  );
  console.log("");

  await access(
    join(process.cwd(), ".next", "BUILD_ID"),
  );

  runV4FinalVerification();

  const [
    coverage,
    selectionAudit,
    reconciliation,
  ] = await Promise.all([
    jsonFile(
      "data/operations/data-coverage-v5.json",
    ),
    jsonFile(
      "data/production-selection-audit-v5.json",
    ),
    jsonFile(
      "data/operations/result-reconciliation-v5.json",
    ),
  ]);

  const coverageApi = record(coverage.api);
  const coverageTotals = record(
    coverage.totals,
  );
  const coverageProduction = record(
    coverage.production,
  );

  assert.equal(coverage.seasonYear, 2026);
  assert.equal(
    coverageApi.state,
    "CONNECTED",
    "API-Football quota snapshot is not connected.",
  );
  assert.ok(
    number(coverageTotals.fixtures) > 0,
    "No 2026 fixture is present in the coverage snapshot.",
  );
  assert.equal(
    coverageTotals.missingFinalScores,
    0,
    "Coverage snapshot contains missing final scores.",
  );
  assert.equal(
    coverageProduction.automaticModelChangeAllowed,
    false,
  );

  assert.equal(
    selectionAudit.schemaVersion,
    2,
    "Regenerate V5.4 explanations after installing the final package.",
  );
  assert.ok(
    Array.isArray(selectionAudit.records),
    "Selection audit records are missing.",
  );

  const auditRecords =
    selectionAudit.records as JsonRecord[];
  const published = auditRecords.filter(
    (item) => item.decision === "PUBLISHED",
  ).length;
  const filtered = auditRecords.filter(
    (item) => item.decision === "FILTERED",
  ).length;
  const advisory = auditRecords.filter(
    (item) =>
      item.decision === "FILTERED" &&
      typeof item.predictedProbability ===
        "number",
  ).length;
  const evaluationErrors = auditRecords.filter(
    (item) => item.decision === "ERROR",
  ).length;

  assert.ok(
    published > 0,
    "No published prediction exists.",
  );
  assert.ok(
    filtered > 0,
    "No filtered prediction exists.",
  );
  assert.equal(
    advisory,
    filtered,
    "Every filtered match must retain an advisory prediction.",
  );
  assert.equal(
    evaluationErrors,
    0,
    "The selection audit contains model evaluation errors.",
  );
  assert.equal(
    selectionAudit.automaticModelChangeAllowed,
    false,
  );

  const reconciliationProduction = record(
    reconciliation.production,
  );

  assert.equal(
    reconciliation.seasonYear,
    2026,
  );
  assert.equal(
    reconciliation.status,
    "HEALTHY",
    "Result reconciliation is not healthy.",
  );
  assert.equal(
    reconciliation.issueCount,
    0,
    "Result reconciliation contains active alerts.",
  );
  assert.equal(
    reconciliationProduction
      .automaticModelChangeAllowed,
    false,
  );
  assert.equal(
    reconciliationProduction
      .externalNotificationSent,
    false,
  );

  console.table({
    "Production build": "PASS",
    "V4 production core": "PASS",
    "Active season": coverage.seasonYear,
    "API-Football": text(coverageApi.state),
    "API plan": text(coverageApi.plan),
    "2026 fixtures":
      number(coverageTotals.fixtures),
    "Finished fixtures":
      number(coverageTotals.finished),
    "Missing final scores":
      number(coverageTotals.missingFinalScores),
    "Selection audits": auditRecords.length,
    "Published recommendations": published,
    "Advisory predictions": advisory,
    "Evaluation errors": evaluationErrors,
    "Result reconciliation":
      text(reconciliation.status),
    "Active result alerts":
      number(reconciliation.issueCount),
    Champion: "20% ML / 80% Poisson",
    "Automatic model change": "LOCKED",
    "External notifications": "SAFELY_BLOCKED",
  });

  console.log(
    "V5 final production verification passed.",
  );
  console.log(
    "Published and advisory predictions are available for the 2026 season.",
  );
  console.log(
    "20% ML / 80% Poisson Champion remains unchanged.",
  );
  console.log(
    "No deployment, notification, or model activation was executed.",
  );
}

main().catch((error: unknown) => {
  console.error("");
  console.error(
    "V5 final production verification failed.",
  );
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );
  process.exitCode = 1;
});
