import "dotenv/config";

import {
  loadDashboardPredictions,
} from "@/lib/prediction-dashboard";

import {
  loadPredictionSelectionAuditSnapshot,
} from "@/lib/prediction-selection-audit-snapshot";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "V5.2 EXACT SELECTION POLICY EXPLANATIONS",
  );
  console.log("");

  await loadDashboardPredictions(300);

  const records =
    await loadPredictionSelectionAuditSnapshot();

  const published = records.filter(
    (record) =>
      record.decision === "PUBLISHED",
  ).length;
  const filtered = records.filter(
    (record) =>
      record.decision === "FILTERED",
  ).length;
  const errors = records.filter(
    (record) =>
      record.decision === "ERROR",
  ).length;
  const advisoryPredictions = records.filter(
    (record) =>
      record.decision === "FILTERED" &&
      record.predictedProbability !== null,
  ).length;

  const failedChecks = records.reduce<
    Record<string, number>
  >((totals, record) => {
    for (const code of record.failedCodes) {
      totals[code] = (totals[code] ?? 0) + 1;
    }

    return totals;
  }, {});

  console.table({
    "Audited matches": records.length,
    "Published decisions": published,
    "Filtered decisions": filtered,
    "Advisory predictions":
      advisoryPredictions,
    "Evaluation errors": errors,
    "Probability failures":
      failedChecks.PROBABILITY ?? 0,
    "Reliability failures":
      failedChecks.CONFIDENCE ?? 0,
    "Data-quality failures":
      failedChecks.DATA_QUALITY ?? 0,
    "Draw-policy failures":
      failedChecks.OUTCOME ?? 0,
    "Fallback-model failures":
      failedChecks.MODEL ?? 0,
    Champion: "20% ML / 80% Poisson",
    "Automatic model change": "LOCKED",
  });

  console.log(
    "Exact Selection Policy V2 explanations were saved.",
  );
  console.log(
    "No model weight or production setting was changed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
