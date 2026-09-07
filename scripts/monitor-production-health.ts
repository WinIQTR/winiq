import "dotenv/config";

import { monitorProductionHealth } from "@/lib/production-health-alert";

async function main(): Promise<void> {
  const result = await monitorProductionHealth();

  console.log("\nPRODUCTION HEALTH EVENT\n");
  console.table({
    "Overall level": result.health.overallLevel,
    "Previous level": result.event.previousLevel ?? "NONE",
    Reason: result.event.reason,
    "Snapshot level": result.event.metrics.snapshotLevel,
    "Odds level": result.event.metrics.oddsLevel,
    "Drift status": result.event.metrics.driftStatus,
    "Independent results": result.event.metrics.independentSelections,
    Notification: result.notificationPath ? "CREATED" : "NOT DUE",
    Champion: result.event.production.champion,
    "Production lock": result.event.production.automaticModelChangeAllowed
      ? "FAIL"
      : "PASS",
  });

  console.log("Production health event recorded.");

  if (result.health.overallLevel === "CRITICAL") {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
