import "dotenv/config";

import { buildControlledLearningGate } from "../src/lib/controlled-learning-gate";
import { loadValueBetDashboardSnapshot } from "../src/lib/value-bet-dashboard-snapshot";
import { buildChampionChallengerAudit } from "../src/lib/value-bet-champion-challenger";
import { buildValueBetLearningReport } from "../src/lib/value-bet-learning";
import { buildModelHealthReport } from "../src/lib/value-bet-model-health";

async function main(): Promise<void> {
  const snapshot = await loadValueBetDashboardSnapshot();
  const learning = buildValueBetLearningReport(snapshot.settled);
  const audit = buildChampionChallengerAudit(snapshot.settled);
  const health = buildModelHealthReport({
    generatedAt: snapshot.generatedAt,
    upcoming: snapshot.upcoming,
    settled: snapshot.settled,
  });
  const gate = buildControlledLearningGate({
    independentSelections: learning.independentSelections,
    learningStatus: learning.status,
    learningTrainSelections: learning.trainSelections,
    learningValidationSelections: learning.validationSelections,
    auditStatus: audit.status,
    auditProfileSelections: audit.profileSelections,
    auditSelectionSelections: audit.selectionSelections,
    auditFinalUnseenSelections: audit.finalUnseenSelections,
    modelHealthLevel: health.overallLevel,
    driftStatus: health.drift.status,
    candidateSha256: process.env.PRODUCTION_CANDIDATE_SHA256,
    manualApproval:
      process.env.PRODUCTION_LEARNING_APPROVED?.trim().toLowerCase() === "true",
    manualApprovalId: process.env.PRODUCTION_LEARNING_APPROVAL_ID,
  });

  console.log("\nV4.4 CONTROLLED LEARNING GATE\n");
  console.table(gate.checks.map((item) => ({
    Check: item.label,
    Status: item.status,
    Detail: item.message,
  })));
  console.table({
    Status: gate.status,
    Progress: `${gate.independentSelections} / ${gate.minimumSample}`,
    Percentage: `${gate.progressPercentage.toFixed(1)}%`,
    Remaining: gate.remainingSelections,
    "Manual review package": gate.manualReviewPackageAllowed ? "ALLOWED" : "BLOCKED",
    Champion: gate.production.champion,
    "Production change": gate.productionChangeAllowed ? "FAIL" : "LOCKED",
    "Automatic activation": gate.automaticActivationAllowed ? "FAIL" : "LOCKED",
  });
  console.log("No model weight or production setting was changed.");
}

main().catch((error: unknown) => {
  console.error("Controlled learning gate audit failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
