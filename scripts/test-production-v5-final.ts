import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

async function main(): Promise<void> {
  const verifier = await readFile(
    join(
      process.cwd(),
      "scripts",
      "verify-production-v5-final.ts",
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
    verifier,
    /runV4FinalVerification\(\)/,
  );
  assert.match(
    verifier,
    /process\.env\.ComSpec \|\| "cmd\.exe"/,
  );
  assert.match(
    verifier,
    /pnpm\.cmd run verify:v4-final/,
  );
  assert.match(
    verifier,
    /data\/operations\/data-coverage-v5\.json/,
  );
  assert.match(
    verifier,
    /data\/production-selection-audit-v5\.json/,
  );
  assert.match(
    verifier,
    /result-reconciliation-v5\.json/,
  );
  assert.match(
    verifier,
    /advisory,\s*filtered/,
  );
  assert.match(
    verifier,
    /reconciliation\.status,\s*"HEALTHY"/,
  );
  assert.match(
    verifier,
    /20% ML \/ 80% Poisson/,
  );
  assert.doesNotMatch(
    verifier,
    /Start-ScheduledTask/,
  );
  assert.doesNotMatch(
    verifier,
    /notifications:deliver-v4/,
  );

  assert.match(
    auditSnapshot,
    /const DEFAULT_SNAPSHOT_PATH =\s*"data\/production-selection-audit-v5\.json"/,
  );
  assert.doesNotMatch(
    auditSnapshot,
    /join\([\s\S]{0,100}process\.cwd\(\)/,
  );
  assert.doesNotMatch(
    auditSnapshot,
    /PRODUCTION_SELECTION_AUDIT_PATH/,
  );
  assert.match(
    auditSnapshot,
    /readFile\(\s*DEFAULT_SNAPSHOT_PATH/,
  );

  console.log(
    "V5 Final Production Verification safety tests passed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
