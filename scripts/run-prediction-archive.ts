import "dotenv/config";

import {
  runPredictionArchiveAutomation,
} from "@/lib/prediction-archive";

import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  console.log("Running prediction archive automation...");

  const summary =
    await runPredictionArchiveAutomation();

  console.log("");
  console.log("PUBLICATION SUMMARY");
  console.table(summary.publication);

  console.log("");
  console.log("SETTLEMENT SUMMARY");
  console.table(summary.settlement);

  console.log("");
  console.log("DASHBOARD SNAPSHOT");
  console.table({
    Predictions:
      summary.dashboardSnapshot.predictions,
    "Generated at":
      summary.dashboardSnapshot.generatedAt.toISOString(),
    File:
      summary.dashboardSnapshot.filePath,
  });

  console.log("");
  console.log("Prediction archive automation completed.");
}

main()
  .catch((error: unknown) => {
    console.error("Prediction archive automation failed.");
    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
