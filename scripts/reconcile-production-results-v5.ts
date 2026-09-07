import "dotenv/config";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  settleArchivedPredictions,
} from "@/lib/prediction-archive";

import {
  buildProductionResultReconciliation,
} from "@/lib/production-result-reconciliation";

import {
  saveProductionResultReconciliationSnapshot,
  type ProductionResultReconciliationSnapshot,
} from "@/lib/production-result-reconciliation-snapshot";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "V5.3 PRODUCTION RESULT RECONCILIATION",
  );
  console.log("");

  const settlement =
    await settleArchivedPredictions();
  const generatedAt = new Date();
  const reconciliation =
    await buildProductionResultReconciliation(
      generatedAt,
    );

  const snapshot:
    ProductionResultReconciliationSnapshot = {
    schemaVersion: 1,
    generatedAt:
      generatedAt.toISOString(),
    seasonYear:
      ACTIVE_SEASON_YEAR,
    ...reconciliation,
    settlementRun: settlement,
    production: {
      champion:
        "20% ML / 80% Poisson",
      automaticModelChangeAllowed:
        false,
      externalNotificationSent:
        false,
    },
  };

  await saveProductionResultReconciliationSnapshot(
    snapshot,
  );

  console.table({
    Status: snapshot.status,
    Season: snapshot.seasonYear,
    Fixtures: snapshot.totalFixtures,
    Finished: snapshot.finishedFixtures,
    "Archived matches": snapshot.archivedMatches,
    "Settled in this run":
      settlement.won +
      settlement.lost +
      settlement.voided,
    "Missing final scores":
      snapshot.missingFinalScores,
    "Pending settlements":
      snapshot.pendingSettlements,
    "Archive score mismatches":
      snapshot.archiveScoreMismatches,
    "Overdue match statuses":
      snapshot.overdueStatuses,
    "Total alerts": snapshot.issueCount,
    Champion:
      snapshot.production.champion,
    "Automatic model change": "LOCKED",
  });

  if (snapshot.issues.length > 0) {
    console.log("");
    console.table(
      snapshot.issues.map((issue) => ({
        Severity: issue.severity,
        Code: issue.code,
        League: issue.leagueName,
        Match: issue.match,
        Kickoff: issue.kickoffAt,
      })),
    );
  }

  console.log(
    "Production result reconciliation snapshot generated.",
  );
  console.log(
    "No external notification was sent and no model setting was changed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
