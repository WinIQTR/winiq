import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  evaluateSelectionPolicyV2,
} from "@/lib/selection-policy-explanation";

import {
  mergePredictionSelectionAudits,
  type PredictionSelectionAuditRecord,
} from "@/lib/prediction-selection-audit-snapshot";

function createAudit(
  matchId: number,
  evaluatedAt: string,
  decision: "PUBLISHED" | "FILTERED",
): PredictionSelectionAuditRecord {
  return {
    matchId,
    kickoffAt: new Date(
      "2026-08-15T18:00:00.000Z",
    ),
    evaluatedAt: new Date(evaluatedAt),
    decision,
    eligible: decision === "PUBLISHED",
    predictedOutcome: "HOME",
    predictedProbability: 65,
    homeProbability: 65,
    drawProbability: 20,
    awayProbability: 15,
    expectedHomeGoals: 1.8,
    expectedAwayGoals: 0.9,
    advisoryMarket: "Match Result",
    advisorySelection: "Home",
    advisoryProbability: 65,
    advisoryReliabilityScore: 75,
    confidenceLevel: "HIGH",
    confidenceScore: 75,
    dataQualityScore: 80,
    productionModelName:
      "20% ML / 80% Poisson",
    summary: "test",
    failedCodes: [],
    checks: [],
  };
}

async function main(): Promise<void> {
  const published =
    evaluateSelectionPolicyV2({
      predictedOutcome: "HOME",
      predictedProbability: 64.2,
      confidenceLevel: "HIGH",
      confidenceScore: 74,
      dataQualityScore: 72,
      productionModelName:
        "20% ML / 80% Poisson",
      mlFallback: false,
    });

  assert.equal(published.eligible, true);
  assert.equal(published.decision, "PUBLISHED");
  assert.deepEqual(published.failedCodes, []);

  const filtered =
    evaluateSelectionPolicyV2({
      predictedOutcome: "DRAW",
      predictedProbability: 52.5,
      confidenceLevel: "MEDIUM",
      confidenceScore: 61,
      dataQualityScore: 60,
      productionModelName:
        "Poisson fallback",
      mlFallback: true,
    });

  assert.equal(filtered.eligible, false);
  assert.equal(filtered.decision, "FILTERED");
  assert.deepEqual(
    filtered.failedCodes,
    [
      "MODEL",
      "OUTCOME",
      "CONFIDENCE",
      "DATA_QUALITY",
      "PROBABILITY",
    ],
  );

  const merged = mergePredictionSelectionAudits(
    [
      createAudit(
        1,
        "2026-08-14T08:00:00.000Z",
        "FILTERED",
      ),
    ],
    [
      createAudit(
        1,
        "2026-08-14T09:00:00.000Z",
        "PUBLISHED",
      ),
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].decision, "PUBLISHED");

  const workspace = await readFile(
    join(
      process.cwd(),
      "src",
      "components",
      "predictions-workspace.tsx",
    ),
    "utf8",
  );
  const dashboard = await readFile(
    join(
      process.cwd(),
      "src",
      "lib",
      "prediction-dashboard.ts",
    ),
    "utf8",
  );
  const snapshot = await readFile(
    join(
      process.cwd(),
      "src",
      "lib",
      "prediction-selection-audit-snapshot.ts",
    ),
    "utf8",
  );

  assert.match(
    workspace,
    /selectionAudit\.checks\.map/,
  );
  assert.doesNotMatch(
    workspace,
    /It may be below the 60% probability/,
  );
  assert.match(
    dashboard,
    /evaluateSelectionPolicyV2/,
  );
  assert.match(
    dashboard,
    /savePredictionSelectionAuditSnapshot/,
  );
  assert.match(
    snapshot,
    /automaticModelChangeAllowed:\s*false/,
  );

  console.log(
    "Exact Prediction Selection Explanations V5.2 tests passed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
