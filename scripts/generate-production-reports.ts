import "dotenv/config";

import { generateProductionReports } from "@/lib/production-report";

async function main(): Promise<void> {
  const reports = await generateProductionReports();

  console.log("\nPRODUCTION PERFORMANCE REPORTS\n");
  console.table({
    "Daily report": reports.daily.period.key,
    "Daily settled": reports.daily.settled.settled,
    "Daily ROI": reports.daily.settled.roi === null
      ? "collecting"
      : `${reports.daily.settled.roi.toFixed(1)}%`,
    "Weekly report": reports.weekly.period.key,
    "Weekly settled": reports.weekly.settled.settled,
    "Weekly ROI": reports.weekly.settled.roi === null
      ? "collecting"
      : `${reports.weekly.settled.roi.toFixed(1)}%`,
    "Model health": reports.daily.modelHealth.overallLevel,
    Champion: reports.daily.production.champion,
    "Production lock": reports.daily.production.automaticModelChangeAllowed
      ? "FAIL"
      : "PASS",
  });

  console.log("Daily and weekly production reports generated.");
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
