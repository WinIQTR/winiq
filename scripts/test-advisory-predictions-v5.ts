import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

async function source(
  ...parts: string[]
): Promise<string> {
  return readFile(
    join(process.cwd(), ...parts),
    "utf8",
  );
}

async function main(): Promise<void> {
  const snapshot = await source(
    "src",
    "lib",
    "prediction-selection-audit-snapshot.ts",
  );
  const dashboard = await source(
    "src",
    "lib",
    "prediction-dashboard.ts",
  );
  const workspace = await source(
    "src",
    "components",
    "predictions-workspace.tsx",
  );
  const styles = await source(
    "src",
    "components",
    "predictions-workspace.module.css",
  );
  const page = await source(
    "src",
    "app",
    "predictions",
    "page.tsx",
  );

  assert.match(
    snapshot,
    /const SNAPSHOT_SCHEMA_VERSION = 2/,
  );
  assert.match(snapshot, /homeProbability/);
  assert.match(snapshot, /advisoryMarket/);
  assert.match(snapshot, /advisoryReliabilityScore/);
  assert.match(
    dashboard,
    /homeProbability:\s*probabilities\.home/,
  );
  assert.match(
    dashboard,
    /advisoryMarket:/,
  );

  assert.match(
    workspace,
    /DİKKATLİ İNCELE • ÖNERİ DEĞİL/,
  );
  assert.match(
    workspace,
    /Neden önerilmedi\?/,
  );
  assert.match(
    workspace,
    /<details className=\{styles\.policyDetails\}>/,
  );
  assert.match(
    workspace,
    /advisoryProbability/,
  );
  assert.match(
    workspace,
    /bahis önerisi olarak değerlendirilmemelidir/,
  );
  assert.match(
    styles,
    /\.fixtureCardAdvisory/,
  );
  assert.match(styles, /\.advisoryBadge/);
  assert.match(styles, /\.policyDetails/);
  assert.match(
    page,
    /filtered model estimates in amber/,
  );

  assert.ok(
    workspace.indexOf(
      "...selectionAudit.checks.filter((check) => !check.passed)",
    ) <
      workspace.indexOf(
        "...selectionAudit.checks.filter((check) => check.passed)",
      ),
    "Failed checks must be shown before passed checks.",
  );

  console.log(
    "Advisory Predictions for Filtered Matches V5.4 tests passed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
